import DB from '../database';
import logger from '../logger';
import { $sync } from './replicator';
import config from '../config';
import { Common } from '../api/common';
import statistics from '../api/statistics/statistics-api';

interface MissingStatistics {
  '24h': number[];
  '1w': number[];
  '1m': number[];
  '3m': number[];
  '6m': number[];
  '2y': number[];
  'all': number[];
}

const steps = {
  '24h': 60,
  '1w': 300,
  '1m': 1800,
  '3m': 7200,
  '6m': 10800,
  '2y': 28800,
  'all': 43200,
};

/**
 * Syncs missing statistics data from trusted servers
 */
class StatisticsReplication {
  inProgress: boolean = false;
  skip: Set<number> = new Set();

  public async $sync(): Promise<void> {
    if (!config.REPLICATION.ENABLED || !config.REPLICATION.STATISTICS || !config.STATISTICS.ENABLED) {
      // replication not enabled, or statistics not enabled
      return;
    }
    if (this.inProgress) {
      logger.info(`StatisticsReplication sync already in progress`, 'Replication');
      return;
    }
    this.inProgress = true;

    const missingStatistics = await this.$getMissingStatistics();
    const missingIntervals = Object.keys(missingStatistics).filter(key => missingStatistics[key].length > 0);
    const totalMissing =  missingIntervals.reduce((total, key) => total + missingStatistics[key].length, 0);

    if (totalMissing === 0) {
      this.inProgress = false;
      logger.info(`Statistics table is complete, no replication needed`, 'Replication');
      return;
    }
    
    for (const interval of missingIntervals) {
      logger.debug(`Missing ${missingStatistics[interval].length} statistics rows in '${interval}' timespan`, 'Replication');
    }
    logger.debug(`Fetching ${missingIntervals.join(', ')} statistics endpoints from trusted servers to fill ${totalMissing} rows missing in statistics`, 'Replication');
    
    let totalSynced = 0;
    let totalMissed = 0;

    for (const interval of missingIntervals) {
      const results = await this.$syncStatistics(interval, missingStatistics[interval]);
      totalSynced += results.synced;
      totalMissed += results.missed;

      logger.info(`Found ${totalSynced} / ${totalSynced + totalMissed} of ${totalMissing} missing statistics rows`, 'Replication');
      await Common.sleep$(3000);
    }

    logger.debug(`Synced ${totalSynced} statistics rows, ${totalMissed} still missing`, 'Replication');

    this.inProgress = false;
  }

  private async $syncStatistics(interval: string, missingTimes: number[]): Promise<any> {
  
    let success = false;
    let synced = 0;
    let missed = 0;
    const syncResult = await $sync(`/api/v1/statistics/${interval}`);
    if (syncResult) {
      if (syncResult.data?.length) {
        success = true;
        logger.info(`Fetched /api/v1/statistics/${interval} from ${syncResult.server}`);
        const fetchedTimes = syncResult.data.map((stat: any) => stat.added);
        for (const time of missingTimes) {
          const closest = syncResult.data[this.getClosestElement(time, fetchedTimes).index];
          if (Math.abs(time - closest.added) < steps[interval]) {
            await statistics.$create(statistics.mapOptimizedStatisticToStatistic([closest])[0], true);
            synced++;
          } else {
            missed++;
            this.skip.add(time);
          }
        }
      }
    }

    return { success, synced, missed };
  }

  private async $getMissingStatistics(): Promise<MissingStatistics> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const day = 60 * 60 * 24;

      const startTime = this.getStartTimeFromConfig();

      const missingStatistics: MissingStatistics = { '24h': [], '1w': [], '1m': [], '3m': [], '6m': [], '2y': [], 'all': [] };

      const intervals = [              // [start,               end,                 label ]
                                          [now - day,           now - 60,            '24h']       , // from 24 hours ago to now = 1 minute granularity
        startTime < now - day ?           [now - day * 7,       now - day,           '1w' ] : null, // from 1 week ago to 24 hours ago = 5 minutes granularity
        startTime < now - day * 7 ?       [now - day * 30,      now - day * 7,       '1m' ] : null, // from 1 month ago to 1 week ago = 30 minutes granularity
        startTime < now - day * 30 ?      [now - day * 90,      now - day * 30,      '3m' ] : null, // from 3 months ago to 1 month ago = 2 hours granularity
        startTime < now - day * 90 ?      [now - day * 180,     now - day * 90,      '6m' ] : null, // from 6 months ago to 3 months ago = 3 hours granularity
        startTime < now - day * 180 ?     [now - day * 365 * 2, now - day * 180,     '2y' ] : null, // from 2 years ago to 6 months ago = 8 hours granularity
        startTime < now - day * 365 * 2 ? [startTime,           now - day * 365 * 2, 'all'] : null, // from start of statistics to 2 years ago = 12 hours granularity   
      ];

      for (const interval of intervals) {
        if (!interval) {
          continue;
        }
        missingStatistics[interval[2] as string] = await this.$getMissingStatisticsInterval(interval, startTime);
      }
      
      return missingStatistics;
    } catch (e: any) {
      logger.err(`Cannot fetch missing statistics times from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private async $getMissingStatisticsInterval(interval: any, startTime: number): Promise<number[]> {
    try {
      const start = interval[0];
      const end = interval[1];
      const step = steps[interval[2]];

      const [rows]: any[] = await DB.query(`
        SELECT UNIX_TIMESTAMP(added) as added
        FROM statistics
        WHERE added >= FROM_UNIXTIME(?) AND added <= FROM_UNIXTIME(?)
      `, [start, end]);
      const timesAlreadyHere = rows.map(row => row.added);

      const missingTimes: number[] = [];

      if (timesAlreadyHere.length === 0) {
        for (let time = Math.max(startTime, start); time < end; time += step) {
            missingTimes.push(time);
        }
        return missingTimes;
      }

      for (let time = Math.max(startTime, start); time < end; time += step) {
        const closest = this.getClosestElement(time, timesAlreadyHere);
        if (Math.abs(time - closest.value) > step && !this.skip.has(time)) { 
          missingTimes.push(time);
        }
      }

      return missingTimes;
    } catch (e: any) {
      logger.err(`Cannot fetch missing statistics times from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  private getClosestElement(element: number, list: number[]): {index: number, value: number} {
    let closest = list[0];
    let index = 0;
    for (let i = 0; i < list.length; i++) {
      if (Math.abs(list[i] - element) < Math.abs(closest - element)) {
        closest = list[i];
        index = i;
      }
    }
    return { index, value: closest };
  }

  private getStartTimeFromConfig(): number {
    const now = Math.floor(Date.now() / 1000);
    const day = 60 * 60 * 24;

    let startTime: number;
    if (typeof(config.REPLICATION.STATISTICS_START_TIME) === 'string' && ['24h', '1w', '1m', '3m', '6m', '2y', 'all'].includes(config.REPLICATION.STATISTICS_START_TIME)) {
      if (config.REPLICATION.STATISTICS_START_TIME === 'all') {
        startTime = 1481932800;
      } else if (config.REPLICATION.STATISTICS_START_TIME === '2y') {
        startTime = now - day * 365 * 2;
      } else if (config.REPLICATION.STATISTICS_START_TIME === '6m') {
        startTime = now - day * 180;
      } else if (config.REPLICATION.STATISTICS_START_TIME === '3m') {
        startTime = now - day * 90;
      } else if (config.REPLICATION.STATISTICS_START_TIME === '1m') {
        startTime = now - day * 30;
      } else if (config.REPLICATION.STATISTICS_START_TIME === '1w') {
        startTime = now - day * 7;
      } else {
        startTime = now - day;
      }
    } else {
      startTime = Math.max(config.REPLICATION.STATISTICS_START_TIME as number || 1481932800, 1481932800);
    }

    return startTime;
  }

}

export default new StatisticsReplication();

