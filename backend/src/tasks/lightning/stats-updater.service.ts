import logger from '../../logger';
import lightningApi from '../../api/lightning/lightning-api-factory';
import LightningStatsImporter from './sync-tasks/stats-importer';
import config from '../../config';
import { Common } from '../../api/common';

class LightningStatsUpdater {
  public async $startService(): Promise<void> {
    logger.info('Starting Lightning Stats service');

    await this.$runTasks();
    LightningStatsImporter.$run();
  }

  private async $runTasks(): Promise<void> {
    await this.$logStatsDaily();

    setTimeout(() => { this.$runTasks(); }, 1000 * config.LIGHTNING.STATS_REFRESH_INTERVAL);
  }

  /**
   * Update the latest entry for each node every config.LIGHTNING.STATS_REFRESH_INTERVAL seconds
   */
  private async $logStatsDaily(): Promise<void> {
    const date = new Date();
    Common.setDateMidnight(date);
    const networkGraph = await lightningApi.$getNetworkGraph();
    await LightningStatsImporter.computeNetworkStats(date.getTime() / 1000, networkGraph);
    
    logger.info(`Updated latest network stats`);
  }
}

export default new LightningStatsUpdater();
