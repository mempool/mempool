import DB from '../../database';
import logger from '../../logger';
import channelsApi from '../../api/explorer/channels.api';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import config from '../../config';
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
    logger.info(`Starting lightning network sync service`, logger.tags.ln);

    this.loggerTimer = new Date().getTime() / 1000;

    await this.$runTasks();
  }

  private async $runTasks(): Promise<void> {
    const taskStartTime = Date.now();
    try {
      logger.debug(`Updating nodes and channels`, logger.tags.ln);

      const networkGraph = await lightningApi.$getNetworkGraph();
      if (networkGraph.nodes.length === 0 || networkGraph.edges.length === 0) {
        logger.info(`LN Network graph is empty, retrying in 10 seconds`, logger.tags.ln);
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
      logger.err(`$runTasks() error: ${e instanceof Error ? e.message : e}`, logger.tags.ln);
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
      node.last_update = Math.max(node.last_update ?? 0, latestUpdated);

      await nodesApi.$saveNode(node);
      graphNodesPubkeys.push(node.pub_key);
      ++progress;

      const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
      if (elapsedSeconds > config.LIGHTNING.LOGGER_UPDATE_INTERVAL) {
        logger.debug(`Updating node ${progress}/${nodes.length}`, logger.tags.ln);
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
    logger.debug(`${progress} nodes updated. ${deletedSockets} sockets deleted. ${deletedRecords} custom records deleted.`);

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
        if (elapsedSeconds > config.LIGHTNING.LOGGER_UPDATE_INTERVAL) {
          logger.debug(`Updating channel ${progress}/${channels.length}`, logger.tags.ln);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }

      logger.debug(`${progress} channels updated`, logger.tags.ln);

      // If a channel if not present in the graph, mark it as inactive
      await channelsApi.$setChannelsInactive(graphChannelsIds);
    } catch (e) {
      logger.err(` Cannot update channel list. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.ln);
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
          ++updated;
          await DB.query(query, params);
        }
        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > config.LIGHTNING.LOGGER_UPDATE_INTERVAL) {
          logger.debug(`Updating node first seen date ${progress}/${nodes.length}`, logger.tags.ln);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }
      if (updated > 0) {
        logger.debug(`Updated ${updated} node first seen dates`, logger.tags.ln);
      }
    } catch (e) {
      logger.err(`$updateNodeFirstSeen() error: ${e instanceof Error ? e.message : e}`, logger.tags.ln);
    }
  }

  private async $lookUpCreationDateFromChain(): Promise<void> {
    let progress = 0;

    logger.debug(`Running channel creation date lookup`, logger.tags.ln);
    try {
      const channels = await channelsApi.$getChannelsWithoutCreatedDate();
      for (const channel of channels) {
        const transaction = await fundingTxFetcher.$fetchChannelOpenTx(channel.short_id);
        if (!transaction) {
          continue;
        }
        await DB.query(`
          UPDATE channels SET created = FROM_UNIXTIME(?) WHERE channels.id = ?`,
          [transaction.timestamp, channel.id]
        );
        ++progress;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > config.LIGHTNING.LOGGER_UPDATE_INTERVAL) {
          logger.debug(`Updating channel creation date ${progress}/${channels.length}`, logger.tags.ln);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }

      if (channels.length > 0) {
        logger.debug(`Updated ${channels.length} channels' creation date`, logger.tags.ln);
      }      
    } catch (e) {
      logger.err(`$lookUpCreationDateFromChain() error: ${e instanceof Error ? e.message : e}`, logger.tags.ln);
    }
  }

  /**
   * If a channel does not have any active node linked to it, then also
   * mark that channel as inactive
   */
  private async $deactivateChannelsWithoutActiveNodes(): Promise<void> {
    logger.debug(`Find channels which nodes are offline`, logger.tags.ln);

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
        logger.debug(`Marked ${result[0].changedRows} channels as inactive because they are not linked to any active node`, logger.tags.ln);
      }
    } catch (e) {
      logger.err(`$deactivateChannelsWithoutActiveNodes() error: ${e instanceof Error ? e.message : e}`, logger.tags.ln);
    }
  }

  private async $scanForClosedChannels(): Promise<void> {
    let currentBlockHeight = blocks.getCurrentBlockHeight();
    if (config.MEMPOOL.ENABLED === false) { // https://github.com/mempool/mempool/issues/3582
      currentBlockHeight = await bitcoinApi.$getBlockHeightTip();
    }
    if (this.closedChannelsScanBlock === currentBlockHeight) {
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
      logger.debug(`${log}`, logger.tags.ln);

      const allChannels = await channelsApi.$getChannelsByStatus([0, 1]);

      const sliceLength = Math.ceil(config.ESPLORA.BATCH_QUERY_BASE_SIZE / 2);
      // process batches of 5000 channels
      for (let i = 0; i < Math.ceil(allChannels.length / sliceLength); i++) {
        const channels = allChannels.slice(i * sliceLength, (i + 1) * sliceLength);
        const outspends = await bitcoinApi.$getOutSpendsByOutpoint(channels.map(channel => {
          return { txid: channel.transaction_id, vout: channel.transaction_vout };
        }));

        for (const [index, channel] of channels.entries()) {
          const spendingTx = outspends[index];
          if (spendingTx.spent === true && spendingTx.status?.confirmed === true) {
            // logger.debug(`Marking channel: ${channel.id} as closed.`, logger.tags.ln);
            await DB.query(`UPDATE channels SET status = 2, closing_date = FROM_UNIXTIME(?) WHERE id = ?`,
              [spendingTx.status.block_time, channel.id]);
            if (spendingTx.txid && !channel.closing_transaction_id) {
              await DB.query(`UPDATE channels SET closing_transaction_id = ? WHERE id = ?`, [spendingTx.txid, channel.id]);
            }
          }
        }

        progress += channels.length;
        const elapsedSeconds = Math.round((new Date().getTime() / 1000) - this.loggerTimer);
        if (elapsedSeconds > config.LIGHTNING.LOGGER_UPDATE_INTERVAL) {
          logger.debug(`Checking if channel has been closed ${progress}/${allChannels.length}`, logger.tags.ln);
          this.loggerTimer = new Date().getTime() / 1000;
        }
      }

      this.closedChannelsScanBlock = currentBlockHeight;
      logger.debug(`Closed channels scan completed at block ${this.closedChannelsScanBlock}`, logger.tags.ln);
    } catch (e) {
      logger.err(`$scanForClosedChannels() error: ${e instanceof Error ? e.message : e}`, logger.tags.ln);
    }
  }
}

export default new NetworkSyncService();
