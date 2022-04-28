
import DB from '../database';
import logger from '../logger';
import lightningApi from '../api/lightning/lightning-api-factory';

class LightningStatsUpdater {
  constructor() {}

  public async startService() {
    logger.info('Starting Stats service');

    const now = new Date();
    const nextHourInterval = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(now.getHours() / 1) + 1, 0, 0, 0);
    const difference = nextHourInterval.getTime() - now.getTime();

    setTimeout(() => {
      this.$logLightningStats();
      this.$logNodeStatsDaily();
      setInterval(() => {
        this.$logLightningStats();
        this.$logNodeStatsDaily();
      }, 1000 * 60 * 60);
    }, difference);
  }

  private async $logNodeStatsDaily() {
    const currentDate = new Date().toISOString().split('T')[0];
    try {
      const [state]: any = await DB.query(`SELECT string FROM state WHERE name = 'last_node_stats'`);
      // Only store once per day
      if (state[0] === currentDate) {
        return;
      }

      const query = `SELECT nodes.public_key, c1.channels_count_left, c2.channels_count_right, c1.channels_capacity_left, c2.channels_capacity_right FROM nodes LEFT JOIN (SELECT node1_public_key, COUNT(id) AS channels_count_left, SUM(capacity) AS channels_capacity_left FROM channels GROUP BY node1_public_key) c1 ON c1.node1_public_key = nodes.public_key LEFT JOIN (SELECT node2_public_key, COUNT(id) AS channels_count_right, SUM(capacity) AS channels_capacity_right FROM channels GROUP BY node2_public_key) c2 ON c2.node2_public_key = nodes.public_key`;
      const [nodes]: any = await DB.query(query);

      for (const node of nodes) {
        await DB.query(
          `INSERT INTO nodes_stats(public_key, added, capacity_left, capacity_right, channels_left, channels_right) VALUES (?, NOW(), ?, ?, ?, ?)`,
          [node.public_key, node.channels_capacity_left, node.channels_capacity_right,
            node.channels_count_left, node.channels_count_right]);
      }
      await DB.query(`UPDATE state SET string = ? WHERE name = 'last_node_stats'`, [currentDate]);
    } catch (e) {
      logger.err('$logNodeStatsDaily() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $logLightningStats() {
    try {
      const networkInfo = await lightningApi.$getNetworkInfo();

      const query = `INSERT INTO statistics(
          added,
          channel_count,
          node_count,
          total_capacity,
          average_channel_size
        )
        VALUES (NOW(), ?, ?, ?, ?)`;

      await DB.query(query, [
        networkInfo.channel_count,
        networkInfo.node_count,
        networkInfo.total_capacity,
        networkInfo.average_channel_size
      ]);
    } catch (e) {
      logger.err('$logLightningStats() error: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new LightningStatsUpdater();
