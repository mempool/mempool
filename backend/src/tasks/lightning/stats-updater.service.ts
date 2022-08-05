import DB from '../../database';
import logger from '../../logger';
import lightningApi from '../../api/lightning/lightning-api-factory';
import LightningStatsImporter from './sync-tasks/stats-importer';

class LightningStatsUpdater {
  hardCodedStartTime = '2018-01-12';

  public async $startService(): Promise<void> {
    logger.info('Starting Lightning Stats service');

    LightningStatsImporter.$run();
    
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

  private async $runTasks(): Promise<void> {
    await this.$logStatsDaily();

    setTimeout(() => {
      this.$runTasks();
    }, this.timeUntilMidnight());
  }

  private async $logStatsDaily(): Promise<void> {
    const date = new Date();
    this.setDateMidnight(date);
    date.setUTCHours(24);

    const [rows] = await DB.query(`SELECT UNIX_TIMESTAMP(MAX(added)) as lastAdded from lightning_stats`);
    if ((rows[0].lastAdded ?? 0) === date.getTime() / 1000) {
      return;
    }

    logger.info(`Running lightning daily stats log...`);
    const networkGraph = await lightningApi.$getNetworkGraph();
    LightningStatsImporter.computeNetworkStats(date.getTime() / 1000, networkGraph);
  }
}

export default new LightningStatsUpdater();
