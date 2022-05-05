
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
      setInterval(() => {
        this.$logLightningStats();
        this.$logNodeStatsDaily();
      }, 1000 * 60 * 60);
    }, difference);

    this.$logNodeStatsDaily();
  }

  private async $logNodeStatsDaily() {
    const currentDate = new Date().toISOString().split('T')[0];
    try {
      const [state]: any = await DB.query(`SELECT string FROM state WHERE name = 'last_node_stats'`);
      // Only store once per day
      if (state[0].string === currentDate) {
        return;
      }

      const query = `SELECT nodes.public_key, c1.channels_count_left, c2.channels_count_right, c1.channels_capacity_left, c2.channels_capacity_right FROM nodes LEFT JOIN (SELECT node1_public_key, COUNT(id) AS channels_count_left, SUM(capacity) AS channels_capacity_left FROM channels GROUP BY node1_public_key) c1 ON c1.node1_public_key = nodes.public_key LEFT JOIN (SELECT node2_public_key, COUNT(id) AS channels_count_right, SUM(capacity) AS channels_capacity_right FROM channels GROUP BY node2_public_key) c2 ON c2.node2_public_key = nodes.public_key`;
      const [nodes]: any = await DB.query(query);

      for (const node of nodes) {
        await DB.query(
          `INSERT INTO nodes_stats(public_key, added, capacity, channels) VALUES (?, NOW(), ?, ?)`,
          [node.public_key, (parseInt(node.channels_capacity_left || 0, 10)) + (parseInt(node.channels_capacity_right || 0, 10)),
            node.channels_count_left + node.channels_count_right]);
      }
      await DB.query(`UPDATE state SET string = ? WHERE name = 'last_node_stats'`, [currentDate]);
      logger.debug('Daily node stats has updated.');
    } catch (e) {
      logger.err('$logNodeStatsDaily() error: ' + (e instanceof Error ? e.message : e));
    }
  }

  private async $logLightningStats() {
    try {
      const networkGraph = await lightningApi.$getNetworkGraph();
      let total_capacity = 0;
      for (const channel of networkGraph.channels) {
        if (channel.capacity) {
          total_capacity += channel.capacity;
        }
      }

      const query = `INSERT INTO statistics(
          added,
          channel_count,
          node_count,
          total_capacity
        )
        VALUES (NOW(), ?, ?, ?)`;

      await DB.query(query, [
        networkGraph.channels.length,
        networkGraph.nodes.length,
        total_capacity,
      ]);
    } catch (e) {
      logger.err('$logLightningStats() error: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new LightningStatsUpdater();
