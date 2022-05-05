import { chanNumber } from 'bolt07';
import DB from '../database';
import logger from '../logger';
import lightningApi from '../api/lightning/lightning-api-factory';
import { ILightningApi } from '../api/lightning/lightning-api.interface';
import channelsApi from '../api/explorer/channels.api';
import bitcoinClient from '../api/bitcoin/bitcoin-client';

class NodeSyncService {
  constructor() {}

  public async startService() {
    logger.info('Starting node sync service');

    this.$updateNodes();

    setInterval(async () => {
      await this.$updateNodes();
    }, 1000 * 60 * 60);
  }

  private async $updateNodes() {
    try {
      const networkGraph = await lightningApi.$getNetworkGraph();

      for (const node of networkGraph.nodes) {
        await this.$saveNode(node);
      }
      logger.debug(`Nodes updated`);

      await this.$setChannelsInactive();

      for (const channel of networkGraph.channels) {
        await this.$saveChannel(channel);
      }
      logger.debug(`Channels updated`);

      await this.$findInactiveNodesAndChannels();
      logger.debug(`Inactive channels scan complete`);

      await this.$scanForClosedChannels();
      logger.debug(`Closed channels scan complete`);

      await this.$lookUpCreationDateFromChain();
      logger.debug(`Channel creation dates scan complete`);

      await this.$updateNodeFirstSeen();
      logger.debug(`Node first seen dates scan complete`);

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
    } catch (e) {
      logger.err('$updateNodeFirstSeen() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $lookUpCreationDateFromChain() {
    try {
      const channels = await channelsApi.$getChannelsWithoutCreatedDate();
      for (const channel of channels) {
        const transaction = await bitcoinClient.getRawTransaction(channel.transaction_id, 1);
        await DB.query(`UPDATE channels SET created = FROM_UNIXTIME(?) WHERE channels.id = ?`, [transaction.blocktime, channel.id]);
      }
    } catch (e) {
      logger.err('$setCreationDateFromChain() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  // Looking for channels whos nodes are inactive
  private async $findInactiveNodesAndChannels(): Promise<void> {
    try {
      // @ts-ignore
      const [channels]: [ILightningApi.Channel[]] = await DB.query(`SELECT channels.id FROM channels WHERE channels.status = 1 AND ((SELECT COUNT(*) FROM nodes WHERE nodes.public_key = channels.node1_public_key) = 0 OR (SELECT COUNT(*) FROM nodes WHERE nodes.public_key = channels.node2_public_key) = 0)`);

      for (const channel of channels) {
        await this.$updateChannelStatus(channel.id, 0);
      }
    } catch (e) {
      logger.err('$findInactiveNodesAndChannels() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $scanForClosedChannels(): Promise<void> {
    try {
      const channels = await channelsApi.$getChannelsByStatus(0);
      for (const channel of channels) {
        const outspends = await bitcoinClient.getTxOut(channel.transaction_id, channel.transaction_vout);
        if (outspends === null) {
          logger.debug('Marking channel: ' + channel.id + ' as closed.');
          await DB.query(`UPDATE channels SET status = 2 WHERE id = ?`, [channel.id]);
        }
      }
    } catch (e) {
      logger.err('$updateNodes() error: ' + (e instanceof Error ? e.message : e));
    }
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
      const sockets = node.sockets.join(', ');
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
