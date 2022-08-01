
import DB from '../../database';
import logger from '../../logger';
import lightningApi from '../../api/lightning/lightning-api-factory';
import channelsApi from '../../api/explorer/channels.api';
import { isIP } from 'net';
import LightningStatsImporter from './sync-tasks/stats-importer';

class LightningStatsUpdater {
  hardCodedStartTime = '2018-01-12';

  public async $startService(): Promise<void> {
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

  private async $lightningIsSynced(): Promise<boolean> {
    const nodeInfo = await lightningApi.$getInfo();
    return nodeInfo.synced_to_chain && nodeInfo.synced_to_graph;
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

    logger.info(`Running lightning daily stats log...`);
    const networkGraph = await lightningApi.$getNetworkGraph();
    LightningStatsImporter.computeNetworkStats(date.getTime(), networkGraph);
  }
}

export default new LightningStatsUpdater();
