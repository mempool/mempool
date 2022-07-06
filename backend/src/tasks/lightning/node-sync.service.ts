import { chanNumber } from 'bolt07';
import DB from '../../database';
import logger from '../../logger';
import channelsApi from '../../api/explorer/channels.api';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import config from '../../config';
import { IEsploraApi } from '../../api/bitcoin/esplora-api.interface';
import lightningApi from '../../api/lightning/lightning-api-factory';
import { ILightningApi } from '../../api/lightning/lightning-api.interface';

class NodeSyncService {
  constructor() {}

  public async $startService() {
    logger.info('Starting node sync service');

    await this.$runUpdater();

    setInterval(async () => {
      await this.$runUpdater();
    }, 1000 * 60 * 60);
  }

  private async $runUpdater() {
    try {
      logger.info(`Updating nodes and channels...`);

      const networkGraph = await lightningApi.$getNetworkGraph();

      for (const node of networkGraph.nodes) {
        await this.$saveNode(node);
      }
      logger.info(`Nodes updated.`);

      await this.$setChannelsInactive();

      for (const channel of networkGraph.channels) {
        await this.$saveChannel(channel);
      }
      logger.info(`Channels updated.`);

      await this.$findInactiveNodesAndChannels();
      await this.$lookUpCreationDateFromChain();
      await this.$updateNodeFirstSeen();
      await this.$scanForClosedChannels();
      await this.$runClosedChannelsForensics();

    } catch (e) {
      logger.err('$updateNodes() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  // This method look up the creation date of the earliest channel of the node
  // and update the node to that date in order to get the earliest first seen date
  private async $updateNodeFirstSeen() {
    try {
      const [nodes]: any[] = await DB.query(`SELECT nodes.public_key, UNIX_TIMESTAMP(nodes.first_seen) AS first_seen, (SELECT UNIX_TIMESTAMP(created) FROM channels WHERE channels.node1_public_key = nodes.public_key ORDER BY created ASC LIMIT 1) AS created1, (SELECT UNIX_TIMESTAMP(created) FROM channels WHERE channels.node2_public_key = nodes.public_key ORDER BY created ASC LIMIT 1) AS created2 FROM nodes`);
      for (const node of nodes) {
        let lowest = 0;
        if (node.created1) {
          if (node.created2 && node.created2 < node.created1) {
            lowest = node.created2;
          } else {
            lowest = node.created1;
          }
        } else if (node.created2) {
          lowest = node.created2;
        }
        if (lowest && lowest < node.first_seen) {
          const query = `UPDATE nodes SET first_seen = FROM_UNIXTIME(?) WHERE public_key = ?`;
          const params = [lowest, node.public_key];
          await DB.query(query, params);
        }
      }
      logger.info(`Node first seen dates scan complete.`);
    } catch (e) {
      logger.err('$updateNodeFirstSeen() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $lookUpCreationDateFromChain() {
    logger.info(`Running channel creation date lookup...`);
    try {
      const channels = await channelsApi.$getChannelsWithoutCreatedDate();
      for (const channel of channels) {
        const transaction = await bitcoinClient.getRawTransaction(channel.transaction_id, 1);
        await DB.query(`UPDATE channels SET created = FROM_UNIXTIME(?) WHERE channels.id = ?`, [transaction.blocktime, channel.id]);
      }
      logger.info(`Channel creation dates scan complete.`);
    } catch (e) {
      logger.err('$setCreationDateFromChain() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  // Looking for channels whos nodes are inactive
  private async $findInactiveNodesAndChannels(): Promise<void> {
    logger.info(`Running inactive channels scan...`);

    try {
      // @ts-ignore
      const [channels]: [ILightningApi.Channel[]] = await DB.query(`SELECT channels.id FROM channels WHERE channels.status = 1 AND ((SELECT COUNT(*) FROM nodes WHERE nodes.public_key = channels.node1_public_key) = 0 OR (SELECT COUNT(*) FROM nodes WHERE nodes.public_key = channels.node2_public_key) = 0)`);

      for (const channel of channels) {
        await this.$updateChannelStatus(channel.id, 0);
      }
      logger.info(`Inactive channels scan complete.`);
    } catch (e) {
      logger.err('$findInactiveNodesAndChannels() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $scanForClosedChannels(): Promise<void> {
    try {
      logger.info(`Starting closed channels scan...`);
      const channels = await channelsApi.$getChannelsByStatus(0);
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
      }
      logger.info(`Closed channels scan complete.`);
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
    try {
      logger.info(`Started running closed channel forensics...`);
      const channels = await channelsApi.$getClosedChannelsWithoutReason();
      for (const channel of channels) {
        let reason = 0;
        // Only Esplora backend can retrieve spent transaction outputs
        const outspends = await bitcoinApi.$getOutspends(channel.closing_transaction_id);
        const lightningScriptReasons: number[] = [];
        for (const outspend of outspends) {
          if (outspend.spent && outspend.txid) {
            const spendingTx = await bitcoinApi.$getRawTransaction(outspend.txid);
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
            const closingTx = await bitcoinApi.$getRawTransaction(channel.closing_transaction_id);
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

  private async $saveChannel(channel: ILightningApi.Channel): Promise<void> {
    const fromChannel = chanNumber({ channel: channel.id }).number;

    try {
      const d = new Date(Date.parse(channel.updated_at));
      const query = `INSERT INTO channels
        (
          id,
          short_id,
          capacity,
          transaction_id,
          transaction_vout,
          updated_at,
          status,
          node1_public_key,
          node1_base_fee_mtokens,
          node1_cltv_delta,
          node1_fee_rate,
          node1_is_disabled,
          node1_max_htlc_mtokens,
          node1_min_htlc_mtokens,
          node1_updated_at,
          node2_public_key,
          node2_base_fee_mtokens,
          node2_cltv_delta,
          node2_fee_rate,
          node2_is_disabled,
          node2_max_htlc_mtokens,
          node2_min_htlc_mtokens,
          node2_updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          capacity = ?,
          updated_at = ?,
          status = 1,
          node1_public_key = ?,
          node1_base_fee_mtokens = ?,
          node1_cltv_delta = ?,
          node1_fee_rate = ?,
          node1_is_disabled = ?,
          node1_max_htlc_mtokens = ?,
          node1_min_htlc_mtokens = ?,
          node1_updated_at = ?,
          node2_public_key = ?,
          node2_base_fee_mtokens = ?,
          node2_cltv_delta = ?,
          node2_fee_rate = ?,
          node2_is_disabled = ?,
          node2_max_htlc_mtokens = ?,
          node2_min_htlc_mtokens = ?,
          node2_updated_at = ?
        ;`;

      await DB.query(query, [
        fromChannel,
        channel.id,
        channel.capacity,
        channel.transaction_id,
        channel.transaction_vout,
        channel.updated_at ? this.utcDateToMysql(channel.updated_at) : 0,
        channel.policies[0].public_key,
        channel.policies[0].base_fee_mtokens,
        channel.policies[0].cltv_delta,
        channel.policies[0].fee_rate,
        channel.policies[0].is_disabled,
        channel.policies[0].max_htlc_mtokens,
        channel.policies[0].min_htlc_mtokens,
        channel.policies[0].updated_at ? this.utcDateToMysql(channel.policies[0].updated_at) : 0,
        channel.policies[1].public_key,
        channel.policies[1].base_fee_mtokens,
        channel.policies[1].cltv_delta,
        channel.policies[1].fee_rate,
        channel.policies[1].is_disabled,
        channel.policies[1].max_htlc_mtokens,
        channel.policies[1].min_htlc_mtokens,
        channel.policies[1].updated_at ? this.utcDateToMysql(channel.policies[1].updated_at) : 0,
        channel.capacity,
        channel.updated_at ? this.utcDateToMysql(channel.updated_at) : 0,
        channel.policies[0].public_key,
        channel.policies[0].base_fee_mtokens,
        channel.policies[0].cltv_delta,
        channel.policies[0].fee_rate,
        channel.policies[0].is_disabled,
        channel.policies[0].max_htlc_mtokens,
        channel.policies[0].min_htlc_mtokens,
        channel.policies[0].updated_at ? this.utcDateToMysql(channel.policies[0].updated_at) : 0,
        channel.policies[1].public_key,
        channel.policies[1].base_fee_mtokens,
        channel.policies[1].cltv_delta,
        channel.policies[1].fee_rate,
        channel.policies[1].is_disabled,
        channel.policies[1].max_htlc_mtokens,
        channel.policies[1].min_htlc_mtokens,
        channel.policies[1].updated_at ? this.utcDateToMysql(channel.policies[1].updated_at) : 0,
      ]);
    } catch (e) {
      logger.err('$saveChannel() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $updateChannelStatus(channelShortId: string, status: number): Promise<void> {
    try {
      await DB.query(`UPDATE channels SET status = ? WHERE id = ?`, [status, channelShortId]);
    } catch (e) {
      logger.err('$updateChannelStatus() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $setChannelsInactive(): Promise<void> {
    try {
      await DB.query(`UPDATE channels SET status = 0 WHERE status = 1`);
    } catch (e) {
      logger.err('$setChannelsInactive() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $saveNode(node: ILightningApi.Node): Promise<void> {
    try {
      const updatedAt = this.utcDateToMysql(node.updated_at);
      const sockets = node.sockets.join(',');
      const query = `INSERT INTO nodes(
          public_key,
          first_seen,
          updated_at,
          alias,
          color,
          sockets
        )
        VALUES (?, NOW(), ?, ?, ?, ?) ON DUPLICATE KEY UPDATE updated_at = ?, alias = ?, color = ?, sockets = ?;`;

      await DB.query(query, [
        node.public_key,
        updatedAt,
        node.alias,
        node.color,
        sockets,
        updatedAt,
        node.alias,
        node.color,
        sockets,
      ]);
    } catch (e) {
      logger.err('$saveNode() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private utcDateToMysql(dateString: string): string {
    const d = new Date(Date.parse(dateString));
    return d.toISOString().split('T')[0] + ' ' + d.toTimeString().split(' ')[0];
  }
}

export default new NodeSyncService();
