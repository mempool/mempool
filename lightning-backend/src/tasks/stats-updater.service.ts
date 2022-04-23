
import DB from '../database';
import logger from '../logger';
import lightningApi from '../api/lightning-api-factory';

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
      }, 1000 * 60 * 60);
    }, difference);
  }

  private async $logLightningStats() {
    const networkInfo = await lightningApi.$getNetworkInfo();

    try {
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
