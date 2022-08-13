import DB from '../../database';
import logger from '../../logger';
import lightningApi from '../../api/lightning/lightning-api-factory';
import LightningStatsImporter from './sync-tasks/stats-importer';
import config from '../../config';

class LightningStatsUpdater {
  public async $startService(): Promise<void> {
    logger.info('Starting Lightning Stats service');

    await this.$runTasks();
    LightningStatsImporter.$run();
  }

  private setDateMidnight(date: Date): void {
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);
  }

  private async $runTasks(): Promise<void> {
    await this.$logStatsDaily();

    setTimeout(() => {
      this.$runTasks();
    }, 1000 * config.LIGHTNING.NODE_STATS_REFRESH_INTERVAL);
  }

  /**
   * Update the latest entry for each node every config.LIGHTNING.NODE_STATS_REFRESH_INTERVAL seconds
   */
  private async $logStatsDaily(): Promise<void> {
    const date = new Date();
    this.setDateMidnight(date);

    logger.info(`Updating latest networks stats`);
    const networkGraph = await lightningApi.$getNetworkGraph();
    LightningStatsImporter.computeNetworkStats(date.getTime() / 1000, networkGraph);
  }
}

export default new LightningStatsUpdater();
