import DB from '../../database';
import logger from '../../logger';
import channelsApi from '../../api/explorer/channels.api';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import config from '../../config';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import { ILightningApi } from '../../api/lightning/lightning-api.interface';
import { $lookupNodeLocation } from './sync-tasks/node-locations';
import lightningApi from '../../api/lightning/lightning-api-factory';
import nodesApi from '../../api/explorer/nodes.api';
import { ResultSetHeader } from 'mysql2';
import fundingTxFetcher from './sync-tasks/funding-tx-fetcher';
import NodesSocketsRepository from '../../repositories/NodesSocketsRepository';
import { Common } from '../../api/common';
import blocks from '../../api/blocks';
import NodeRecordsRepository from '../../repositories/NodeRecordsRepository';
import forensicsService from './forensics.service';

class NetworkSyncService {
  loggerTimer = 0;
  closedChannelsScanBlock = 0;

  constructor() {}

  public async $startService(): Promise<void> {
    logger.info('Starting lightning network sync service');

    this.loggerTimer = new Date().getTime() / 1000;

    await this.$runTasks();
  }

  private async $runTasks(): Promise<void> {
    const taskStartTime = Date.now();
    try {
      logger.info(`Updating nodes and channels`);

      const networkGraph = await lightningApi.$getNetworkGraph();
      if (networkGraph.nodes.length === 0 || networkGraph.edges.length === 0) {
        logger.info(`LN Network graph is empty, retrying in 10 seconds`);
        setTimeout(() => { this.$runTasks(); }, 10000);
        return;
      }

      await this.$updateNodesList(networkGraph.nodes);
      await this.$updateChannelsList(networkGraph.edges);
      await this.$deactivateChannelsWithoutActiveNodes();
      await this.$lookUpCreationDateFromChain();
      await this.$updateNodeFirstSeen();
      await this.$scanForClosedChannels();
      
      if (config.MEMPOOL.BACKEND === 'esplora') {
        // run forensics on new channels only
        await forensicsService.$runClosedChannelsForensics(true);
      }

    } catch (e) {
      logger.err('$runTasks() error: ' + (e instanceof Error ? e.message : e));
    }

    setTimeout(() => { this.$runTasks(); }, Math.max(1, (1000 * config.LIGHTNING.GRAPH_REFRESH_INTERVAL) - (Date.now() - taskStartTime)));
  }

  /**
   * Update the `nodes` table to reflect the current network graph state
   */
  private async $updateNodesList(nodes: ILightningApi.Node[]): Promise<void> {
    let progress = 0;

    let deletedSockets = 0;
    let deletedRecords = 0;
    const graphNodesPubkeys: string[] = [];
    for (const node of nodes) {
      const latestUpdated = await channelsApi.$getLatestChannelUpdateForNode(node.pub_key);
      node.last_update = Math.max(node.last_update, latestUpdated);

      await nodesApi.$saveNode(node);
      graphNodesPubkeys.push(node.pub_key);
      ++progress;

      const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
      if (elapsedSeconds > 10) {
        logger.info(`Updating node ${progress}/${nodes.length}`);
        this.loggerTimer = new Date().getTime() / 1000;
      }

      const addresses: string[] = [];
      for (const socket of node.addresses) {
        await NodesSocketsRepository.$saveSocket(Common.formatSocket(node.pub_key, socket));
        addresses.push(socket.addr);
      }
      deletedSockets += await NodesSocketsRepository.$deleteUnusedSockets(node.pub_key, addresses);

      const oldRecordTypes = await NodeRecordsRepository.$getRecordTypes(node.pub_key);
      const customRecordTypes: number[] = [];
      for (const [type, payload] of Object.entries(node.custom_records || {})) {
        const numericalType = parseInt(type);
        await NodeRecordsRepository.$saveRecord({
          publicKey: node.pub_key,
          type: numericalType,
          payload,
        });
        customRecordTypes.push(numericalType);
      }
      if (oldRecordTypes.reduce((changed, type) => changed || customRecordTypes.indexOf(type) === -1, false)) {
        deletedRecords += await NodeRecordsRepository.$deleteUnusedRecords(node.pub_key, customRecordTypes);
      }
    }
    logger.info(`${progress} nodes updated. ${deletedSockets} sockets deleted. ${deletedRecords} custom records deleted.`);

    // If a channel if not present in the graph, mark it as inactive
    await nodesApi.$setNodesInactive(graphNodesPubkeys);

    if (config.MAXMIND.ENABLED) {
      $lookupNodeLocation();
    }
  }

  /**
   * Update the `channels` table to reflect the current network graph state
   */
  private async $updateChannelsList(channels: ILightningApi.Channel[]): Promise<void> {
    try {
      const [closedChannelsRaw]: any[] = await DB.query(`SELECT id FROM channels WHERE status = 2`);
      const closedChannels = {};
      for (const closedChannel of closedChannelsRaw) {
        closedChannels[closedChannel.id] = true;
      }

      let progress = 0;

      const graphChannelsIds: string[] = [];
      for (const channel of channels) {
        if (!closedChannels[channel.channel_id]) {
          await channelsApi.$saveChannel(channel);
        }
        graphChannelsIds.push(channel.channel_id);
        ++progress;

        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.info(`Updating channel ${progress}/${channels.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }

      logger.info(`${progress} channels updated`);

      // If a channel if not present in the graph, mark it as inactive
      await channelsApi.$setChannelsInactive(graphChannelsIds);
    } catch (e) {
      logger.err(`Cannot update channel list. Reason: ${(e instanceof Error ? e.message : e)}`);
    }
  }

  // This method look up the creation date of the earliest channel of the node
  // and update the node to that date in order to get the earliest first seen date
  private async $updateNodeFirstSeen(): Promise<void> {
    let progress = 0;
    let updated = 0;

    try {
      const [nodes]: any[] = await DB.query(`
        SELECT nodes.public_key, UNIX_TIMESTAMP(nodes.first_seen) AS first_seen,
        (
          SELECT MIN(UNIX_TIMESTAMP(created))
          FROM channels
          WHERE channels.node1_public_key = nodes.public_key
        ) AS created1,
        (
          SELECT MIN(UNIX_TIMESTAMP(created))
          FROM channels
          WHERE channels.node2_public_key = nodes.public_key
        ) AS created2
        FROM nodes
      `);

      for (const node of nodes) {
        const lowest = Math.min(
          node.created1 ?? Number.MAX_SAFE_INTEGER,
          node.created2 ?? Number.MAX_SAFE_INTEGER,
          node.first_seen ?? Number.MAX_SAFE_INTEGER
        );
        if (lowest < node.first_seen) {
          const query = `UPDATE nodes SET first_seen = FROM_UNIXTIME(?) WHERE public_key = ?`;
          const params = [lowest, node.public_key];
          await DB.query(query, params);
        }
        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.info(`Updating node first seen date ${progress}/${nodes.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
          ++updated;
        }
      }
      logger.info(`Updated ${updated} node first seen dates`);
    } catch (e) {
      logger.err('$updateNodeFirstSeen() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $lookUpCreationDateFromChain(): Promise<void> {
    let progress = 0;

    logger.info(`Running channel creation date lookup`);
    try {
      const channels = await channelsApi.$getChannelsWithoutCreatedDate();
      for (const channel of channels) {
        const transaction = await fundingTxFetcher.$fetchChannelOpenTx(channel.short_id);
        await DB.query(`
          UPDATE channels SET created = FROM_UNIXTIME(?) WHERE channels.id = ?`,
          [transaction.timestamp, channel.id]
        );
        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.info(`Updating channel creation date ${progress}/${channels.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }
      logger.info(`Updated ${channels.length} channels' creation date`);
    } catch (e) {
      logger.err('$lookUpCreationDateFromChain() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * If a channel does not have any active node linked to it, then also
   * mark that channel as inactive
   */
  private async $deactivateChannelsWithoutActiveNodes(): Promise<void> {
    logger.info(`Find channels which nodes are offline`);

    try {
      const result = await DB.query<ResultSetHeader>(`
        UPDATE channels
        SET status = 0
        WHERE channels.status = 1
        AND (
          (
            SELECT COUNT(*)
            FROM nodes
            WHERE nodes.public_key = channels.node1_public_key
            AND nodes.status = 1
          ) = 0
        OR (
            SELECT COUNT(*)
            FROM nodes
            WHERE nodes.public_key = channels.node2_public_key
            AND nodes.status = 1
          ) = 0)
        `);

      if (result[0].changedRows ?? 0 > 0) {
        logger.info(`Marked ${result[0].changedRows} channels as inactive because they are not linked to any active node`);
      } else {
        logger.debug(`Marked ${result[0].changedRows} channels as inactive because they are not linked to any active node`);
      }
    } catch (e) {
      logger.err('$deactivateChannelsWithoutActiveNodes() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $scanForClosedChannels(): Promise<void> {
    if (this.closedChannelsScanBlock === blocks.getCurrentBlockHeight()) {
      logger.debug(`We've already scan closed channels for this block, skipping.`);
      return;
    }

    let progress = 0;

    try {
      let log = `Starting closed channels scan`;
      if (this.closedChannelsScanBlock > 0) {
        log += `. Last scan was at block ${this.closedChannelsScanBlock}`;
      } else {
        log += ` for the first time`;
      }
      logger.info(log);

      const channels = await channelsApi.$getChannelsByStatus([0, 1]);
      for (const channel of channels) {
        const spendingTx = await bitcoinApi.$getOutspend(channel.transaction_id, channel.transaction_vout);
        if (spendingTx.spent === true && spendingTx.status?.confirmed === true) {
          logger.debug('Marking channel: ' + channel.id + ' as closed.');
          await DB.query(`UPDATE channels SET status = 2, closing_date = FROM_UNIXTIME(?) WHERE id = ?`,
            [spendingTx.status.block_time, channel.id]);
          if (spendingTx.txid && !channel.closing_transaction_id) {
            await DB.query(`UPDATE channels SET closing_transaction_id = ? WHERE id = ?`, [spendingTx.txid, channel.id]);
          }
        }

        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.info(`Checking if channel has been closed ${progress}/${channels.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }

      this.closedChannelsScanBlock = blocks.getCurrentBlockHeight();
      logger.info(`Closed channels scan completed at block ${this.closedChannelsScanBlock}`);
    } catch (e) {
      logger.err('$scanForClosedChannels() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private findLightningScript(vin: IEsploraApi.Vin): number {
    const topElement = vin.witness ? vin.witness[vin.witness.length - 2] : '';
      if (/^OP_IF OP_PUSHBYTES_33 \w{66} OP_ELSE OP_PUSH(NUM_\d+|BYTES_(1 \w{2}|2 \w{4})) OP_CSV OP_DROP OP_PUSHBYTES_33 \w{66} OP_ENDIF OP_CHECKSIG$/.test(vin.inner_witnessscript_asm)) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#commitment-transaction-outputs
        if (topElement === '01') {
          // top element is '01' to get in the revocation path
          // 'Revoked Lightning Force Close';
          // Penalty force closed
          return 2;
        } else {
          // top element is '', this is a delayed to_local output
          // 'Lightning Force Close';
          return 3;
        }
      } else if (
        /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_NOTIF OP_DROP OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(vin.inner_witnessscript_asm) ||
        /^OP_DUP OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUAL OP_IF OP_CHECKSIG OP_ELSE OP_PUSHBYTES_33 \w{66} OP_SWAP OP_SIZE OP_PUSHBYTES_1 20 OP_EQUAL OP_IF OP_HASH160 OP_PUSHBYTES_20 \w{40} OP_EQUALVERIFY OP_PUSHNUM_2 OP_SWAP OP_PUSHBYTES_33 \w{66} OP_PUSHNUM_2 OP_CHECKMULTISIG OP_ELSE OP_DROP OP_PUSHBYTES_3 \w{6} OP_CLTV OP_DROP OP_CHECKSIG OP_ENDIF (OP_PUSHNUM_1 OP_CSV OP_DROP |)OP_ENDIF$/.test(vin.inner_witnessscript_asm)
      ) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#offered-htlc-outputs
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#received-htlc-outputs
        if (topElement?.length === 66) {
          // top element is a public key
          // 'Revoked Lightning HTLC'; Penalty force closed
          return 4;
        } else if (topElement) {
          // top element is a preimage
          // 'Lightning HTLC';
          return 5;
        } else {
          // top element is '' to get in the expiry of the script
          // 'Expired Lightning HTLC';
          return 6;
        }
      } else if (/^OP_PUSHBYTES_33 \w{66} OP_CHECKSIG OP_IFDUP OP_NOTIF OP_PUSHNUM_16 OP_CSV OP_ENDIF$/.test(vin.inner_witnessscript_asm)) {
        // https://github.com/lightning/bolts/blob/master/03-transactions.md#to_local_anchor-and-to_remote_anchor-output-option_anchors
        if (topElement) {
          // top element is a signature
          // 'Lightning Anchor';
          return 7;
        } else {
          // top element is '', it has been swept after 16 blocks
          // 'Swept Lightning Anchor';
          return 8;
        }
      }
      return 1;
  }

  // If a channel open tx spends funds from a another channel transaction,
  // we can attribute that output to a specific counterparty
  private async $runOpenedChannelsForensics(): Promise<void> {
    const runTimer = Date.now();
    let progress = 0;

    try {
      logger.info(`Started running open channel forensics...`);
      const channels = await channelsApi.$getChannelsWithoutSourceChecked();

      for (const openChannel of channels) {
        const openTx = await bitcoinApi.$getRawTransaction(openChannel.transaction_id);
        for (const input of openTx.vin) {
          const closeChannel = await channelsApi.$getChannelForensicsByClosingId(input.txid);
          if (closeChannel) {
            // this input directly spends a channel close output
            await this.$attributeChannelBalances(closeChannel, openChannel, input);
          } else {
            const prevOpenChannels = await channelsApi.$getChannelForensicsByOpeningId(input.txid);
            if (prevOpenChannels?.length) {
              // this input spends a channel open change output
              for (const prevOpenChannel of prevOpenChannels) {
                await this.$attributeChannelBalances(prevOpenChannel, openChannel, input, null, null, true);
              }
            } else {
              // check if this input spends any swept channel close outputs
              await this.$attributeSweptChannelCloses(openChannel, input);
            }
          }
        }
        // calculate how much of the total input value is attributable to the channel open output
        openChannel.funding_ratio = openTx.vout[openChannel.transaction_vout].value / ((openTx.vout.reduce((sum, v) => sum + v.value, 0) || 1) + openTx.fee);
        // save changes to the opening channel, and mark it as checked
        if (openTx?.vin?.length === 1) {
          openChannel.single_funded = true;
        }
        if (openChannel.node1_funding_balance || openChannel.node2_funding_balance || openChannel.node1_closing_balance || openChannel.node2_closing_balance || openChannel.closed_by) {
          await channelsApi.$updateOpeningInfo(openChannel);
        }
        await channelsApi.$markChannelSourceChecked(openChannel.id);

        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.info(`Updating opened channel forensics ${progress}/${channels?.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
        }
        if (Date.now() - runTimer > (config.LIGHTNING.GRAPH_REFRESH_INTERVAL * 1000)) {
          break;
        }
      }

      logger.info(`Open channels forensics scan complete.`);
    } catch (e) {
      logger.err('$runOpenedChannelsForensics() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  // Check if a channel open tx input spends the result of a swept channel close output
  private async $attributeSweptChannelCloses(openChannel: ILightningApi.Channel, input: IEsploraApi.Vin): Promise<void> {
    const sweepTx = await bitcoinApi.$getRawTransaction(input.txid);
    if (!sweepTx) {
      logger.err(`couldn't find input transaction for channel forensics ${openChannel.channel_id} ${input.txid}`);
      return;
    }
    const openContribution = sweepTx.vout[input.vout].value;
    for (const sweepInput of sweepTx.vin) {
      const lnScriptType = this.findLightningScript(sweepInput);
      if (lnScriptType > 1) {
        const closeChannel = await channelsApi.$getChannelForensicsByClosingId(sweepInput.txid);
        if (closeChannel) {
          const initiator = (lnScriptType === 2 || lnScriptType === 4) ? 'remote' : (lnScriptType === 3 ? 'local' : null);
          await this.$attributeChannelBalances(closeChannel, openChannel, sweepInput, openContribution, initiator);
        }
      }
    }
  }

  private async $attributeChannelBalances(
    prevChannel, openChannel, input: IEsploraApi.Vin, openContribution: number | null = null,
    initiator: 'remote' | 'local' | null = null, linkedOpenings: boolean = false
  ): Promise<void> {
    // figure out which node controls the input/output
    let openSide;
    let prevLocal;
    let prevRemote;
    let matched = false;
    let ambiguous = false; // if counterparties are the same in both channels, we can't tell them apart
    if (openChannel.node1_public_key === prevChannel.node1_public_key) {
      openSide = 1;
      prevLocal = 1;
      prevRemote = 2;
      matched = true;
    } else if (openChannel.node1_public_key === prevChannel.node2_public_key) {
      openSide = 1;
      prevLocal = 2;
      prevRemote = 1;
      matched = true;
    }
    if (openChannel.node2_public_key === prevChannel.node1_public_key) {
      openSide = 2;
      prevLocal = 1;
      prevRemote = 2;
      if (matched) {
        ambiguous = true;
      }
      matched = true;
    } else if (openChannel.node2_public_key === prevChannel.node2_public_key) {
      openSide = 2;
      prevLocal = 2;
      prevRemote = 1;
      if (matched) {
        ambiguous = true;
      }
      matched = true;
    }

    if (matched && !ambiguous) {
      // fetch closing channel transaction and perform forensics on the outputs
      let prevChannelTx: IEsploraApi.Transaction | undefined;
      let outspends: IEsploraApi.Outspend[] | undefined;
      try {
        prevChannelTx = await bitcoinApi.$getRawTransaction(input.txid);
        outspends = await bitcoinApi.$getOutspends(input.txid);
      } catch (e) {
        logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + input.txid + '/outspends'}. Reason ${e instanceof Error ? e.message : e}`);
      }
      if (!outspends || !prevChannelTx) {
        return;
      }
      if (!linkedOpenings) {
        if (!prevChannel.outputs) {
          prevChannel.outputs = prevChannel.outputs || prevChannelTx.vout.map(vout => {
            return {
              type: 0,
              value: vout.value,
            };
          });
        }
        for (let i = 0; i < outspends?.length; i++) {
          const outspend = outspends[i];
          const output = prevChannel.outputs[i];
          if (outspend.spent && outspend.txid) {
            try {
              const spendingTx = await bitcoinApi.$getRawTransaction(outspend.txid);
              if (spendingTx) {
                output.type = this.findLightningScript(spendingTx.vin[outspend.vin || 0]);
              }
            } catch (e) {
              logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + outspend.txid}. Reason ${e instanceof Error ? e.message : e}`);
            }
          } else {
            output.type = 0;
          }
        }

        // attribute outputs to each counterparty, and sum up total known balances
        prevChannel.outputs[input.vout].node = prevLocal;
        const isPenalty = prevChannel.outputs.filter((out) => out.type === 2 || out.type === 4)?.length > 0;
        const normalOutput = [1,3].includes(prevChannel.outputs[input.vout].type);
        let localClosingBalance = 0;
        let remoteClosingBalance = 0;
        for (const output of prevChannel.outputs) {
          if (isPenalty) {
            // penalty close, so local node takes everything
            localClosingBalance += output.value;
          } else if (output.node) {
            // this output determinstically linked to one of the counterparties
            if (output.node === prevLocal) {
              localClosingBalance += output.value;
            } else {
              remoteClosingBalance += output.value;
            }
          } else if (normalOutput && (output.type === 1 || output.type === 3)) {
            // local node had one main output, therefore remote node takes the other
            remoteClosingBalance += output.value;
          }
        }
        prevChannel[`node${prevLocal}_closing_balance`] = localClosingBalance;
        prevChannel[`node${prevRemote}_closing_balance`] = remoteClosingBalance;
        prevChannel.closing_fee = prevChannelTx.fee;

        if (initiator && !linkedOpenings) {
          const initiatorSide = initiator === 'remote' ? prevRemote : prevLocal;
          prevChannel.closed_by = prevChannel[`node${initiatorSide}_public_key`];
        }
  
        // save changes to the closing channel
        await channelsApi.$updateClosingInfo(prevChannel);
      } else {
        if (prevChannelTx.vin.length <= 1) {
          prevChannel[`node${prevLocal}_funding_balance`] = prevChannel.capacity;
          prevChannel.single_funded = true;
          prevChannel.funding_ratio = 1;
          // save changes to the closing channel
          await channelsApi.$updateOpeningInfo(prevChannel);
        }
      }
      openChannel[`node${openSide}_funding_balance`] = openChannel[`node${openSide}_funding_balance`] + (openContribution || prevChannelTx?.vout[input.vout]?.value || 0);
    }
  }
}

export default new NetworkSyncService();
