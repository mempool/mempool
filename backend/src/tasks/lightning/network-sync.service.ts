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
        await this.$runClosedChannelsForensics();
      }

    } catch (e) {
      logger.err('$runTasks() error: ' + (e instanceof Error ? e.message : e));
    }

    setTimeout(() => { this.$runTasks(); }, 1000 * config.LIGHTNING.GRAPH_REFRESH_INTERVAL);
  }

  /**
   * Update the `nodes` table to reflect the current network graph state
   */
  private async $updateNodesList(nodes: ILightningApi.Node[]): Promise<void> {
    let progress = 0;

    let deletedSockets = 0;
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
    }
    logger.info(`${progress} nodes updated. ${deletedSockets} sockets deleted`);

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

  /*
    1. Mutually closed
    2. Forced closed
    3. Forced closed with penalty
  */

  private async $runClosedChannelsForensics(): Promise<void> {
    if (!config.ESPLORA.REST_API_URL) {
      return;
    }

    let progress = 0;

    try {
      logger.info(`Started running closed channel forensics...`);
      const channels = await channelsApi.$getClosedChannelsWithoutReason();
      for (const channel of channels) {
        let reason = 0;
        // Only Esplora backend can retrieve spent transaction outputs
        try {
          let outspends: IEsploraApi.Outspend[] | undefined;
          try {
            outspends = await bitcoinApi.$getOutspends(channel.closing_transaction_id);
          } catch (e) {
            logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + channel.closing_transaction_id + '/outspends'}. Reason ${e instanceof Error ? e.message : e}`);
            continue;
          }
          const lightningScriptReasons: number[] = [];
          for (const outspend of outspends) {
            if (outspend.spent && outspend.txid) {
              let spendingTx: IEsploraApi.Transaction | undefined;
              try {
                spendingTx = await bitcoinApi.$getRawTransaction(outspend.txid);
              } catch (e) {
                logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + outspend.txid}. Reason ${e instanceof Error ? e.message : e}`);
                continue;
              }
              const lightningScript = this.findLightningScript(spendingTx.vin[outspend.vin || 0]);
              lightningScriptReasons.push(lightningScript);
            }
          }
          if (lightningScriptReasons.length === outspends.length
            && lightningScriptReasons.filter((r) => r === 1).length === outspends.length) {
            reason = 1;
          } else {
            const filteredReasons = lightningScriptReasons.filter((r) => r !== 1);
            if (filteredReasons.length) {
              if (filteredReasons.some((r) => r === 2 || r === 4)) {
                reason = 3;
              } else {
                reason = 2;
              }
            } else {
              /*
                We can detect a commitment transaction (force close) by reading Sequence and Locktime
                https://github.com/lightning/bolts/blob/master/03-transactions.md#commitment-transaction
              */
              let closingTx: IEsploraApi.Transaction | undefined;
              try {
                closingTx = await bitcoinApi.$getRawTransaction(channel.closing_transaction_id);
              } catch (e) {
                logger.err(`Failed to call ${config.ESPLORA.REST_API_URL + '/tx/' + channel.closing_transaction_id}. Reason ${e instanceof Error ? e.message : e}`);
                continue;
              }
              const sequenceHex: string = closingTx.vin[0].sequence.toString(16);
              const locktimeHex: string = closingTx.locktime.toString(16);
              if (sequenceHex.substring(0, 2) === '80' && locktimeHex.substring(0, 2) === '20') {
                reason = 2; // Here we can't be sure if it's a penalty or not
              } else {
                reason = 1;
              }
            }
          }
          if (reason) {
            logger.debug('Setting closing reason ' + reason + ' for channel: ' + channel.id + '.');
            await DB.query(`UPDATE channels SET closing_reason = ? WHERE id = ?`, [reason, channel.id]);
          }
        } catch (e) {
          logger.err(`$runClosedChannelsForensics() failed for channel ${channel.short_id}. Reason: ${e instanceof Error ? e.message : e}`);
        }

        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > 10) {
          logger.info(`Updating channel closed channel forensics ${progress}/${channels.length}`);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }
      logger.info(`Closed channels forensics scan complete.`);
    } catch (e) {
      logger.err('$runClosedChannelsForensics() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private findLightningScript(vin: IEsploraApi.Vin): number {
    const topElement = vin.witness[vin.witness.length - 2];
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
        if (topElement.length === 66) {
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
}

export default new NetworkSyncService();
