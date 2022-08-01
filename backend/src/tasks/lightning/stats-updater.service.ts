
import DB from '../../database';
import logger from '../../logger';
import lightningApi from '../../api/lightning/lightning-api-factory';
import channelsApi from '../../api/explorer/channels.api';
import { isIP } from 'net';

class LightningStatsUpdater {
  hardCodedStartTime = '2018-01-12';

  public async $startService() {
    logger.info('Starting Lightning Stats service');
    let isInSync = false;
    let error: any;
    try {
      error = null;
      isInSync = await this.$lightningIsSynced();
    } catch (e) {
      error = e;
    }
    if (!isInSync) {
      if (error) {
        logger.warn('Was not able to fetch Lightning Node status: ' + (error instanceof Error ? error.message : error) + '. Retrying in 1 minute...');
      } else {
        logger.notice('The Lightning graph is not yet in sync. Retrying in 1 minute...');
      }
      setTimeout(() => this.$startService(), 60 * 1000);
      return;
    }

    setTimeout(() => {
      this.$runTasks();
    }, this.timeUntilMidnight());
  }

  private timeUntilMidnight(): number {
    const date = new Date();
    this.setDateMidnight(date);
    date.setUTCHours(24);
    return date.getTime() - new Date().getTime();
  }

  private setDateMidnight(date: Date): void {
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
  }

  private async $lightningIsSynced(): Promise<boolean> {
    const nodeInfo = await lightningApi.$getInfo();
    return nodeInfo.synced_to_chain && nodeInfo.synced_to_graph;
  }

  private async $runTasks(): Promise<void> {
    await this.$logLightningStatsDaily();
    await this.$logNodeStatsDaily();

    setTimeout(() => {
      this.$runTasks();
    }, this.timeUntilMidnight());
  }

  private async $logLightningStatsDaily() {
    try {
      logger.info(`Running lightning daily stats log...`);

      const networkGraph = await lightningApi.$getNetworkGraph();
      let total_capacity = 0;
      for (const channel of networkGraph.edges) {
        if (channel.capacity) {
          total_capacity += parseInt(channel.capacity);
        }
      }

      let clearnetNodes = 0;
      let torNodes = 0;
      let unannouncedNodes = 0;
      for (const node of networkGraph.nodes) {
        for (const socket of node.addresses) {
          const hasOnion = socket.addr.indexOf('.onion') !== -1;
          if (hasOnion) {
            torNodes++;
          }
          const hasClearnet = [4, 6].includes(isIP(socket.split(':')[0]));
          if (hasClearnet) {
            clearnetNodes++;
          }
        }
        if (node.addresses.length === 0) {
          unannouncedNodes++;
        }
      }

      const channelStats = await channelsApi.$getChannelsStats();

      const query = `INSERT INTO lightning_stats(
          added,
          channel_count,
          node_count,
          total_capacity,
          tor_nodes,
          clearnet_nodes,
          unannounced_nodes,
          avg_capacity,
          avg_fee_rate,
          avg_base_fee_mtokens,
          med_capacity,
          med_fee_rate,
          med_base_fee_mtokens
        )
        VALUES (NOW() - INTERVAL 1 DAY, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      await DB.query(query, [
        networkGraph.edges.length,
        networkGraph.nodes.length,
        total_capacity,
        torNodes,
        clearnetNodes,
        unannouncedNodes,
        channelStats.avgCapacity,
        channelStats.avgFeeRate,
        channelStats.avgBaseFee,
        channelStats.medianCapacity,
        channelStats.medianFeeRate,
        channelStats.medianBaseFee,
      ]);
      logger.info(`Lightning daily stats done.`);
    } catch (e) {
      logger.err('$logLightningStatsDaily() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $logNodeStatsDaily() {
    try {
      logger.info(`Running daily node stats update...`);

      const query = `
        SELECT nodes.public_key, c1.channels_count_left, c2.channels_count_right, c1.channels_capacity_left,
          c2.channels_capacity_right
        FROM nodes
        LEFT JOIN (
          SELECT node1_public_key, COUNT(id) AS channels_count_left, SUM(capacity) AS channels_capacity_left
          FROM channels
          WHERE channels.status = 1
          GROUP BY node1_public_key
        ) c1 ON c1.node1_public_key = nodes.public_key
        LEFT JOIN (
          SELECT node2_public_key, COUNT(id) AS channels_count_right, SUM(capacity) AS channels_capacity_right
          FROM channels WHERE channels.status = 1 GROUP BY node2_public_key
        ) c2 ON c2.node2_public_key = nodes.public_key
      `;
      
      const [nodes]: any = await DB.query(query);

      for (const node of nodes) {
        await DB.query(
          `INSERT INTO node_stats(public_key, added, capacity, channels) VALUES (?, NOW() - INTERVAL 1 DAY, ?, ?)`,
          [node.public_key, (parseInt(node.channels_capacity_left || 0, 10)) + (parseInt(node.channels_capacity_right || 0, 10)),
            node.channels_count_left + node.channels_count_right]);
      }
      logger.info('Daily node stats has updated.');
    } catch (e) {
      logger.err('$logNodeStatsDaily() error: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new LightningStatsUpdater();
