import DB from '../database';
import logger from '../logger';
import { $sync } from './replicator';
import config from '../config';
import { Common } from '../api/common';
import statistics from '../api/statistics/statistics-api';
import { OptimizedStatistic } from '../mempool.interfaces';

interface MissingStatistics {
  '24h': Set<number>;
  '1w': Set<number>;
  '1m': Set<number>;
  '3m': Set<number>;
  '6m': Set<number>;
  '2y': Set<number>;
  'all': Set<number>;
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

const MAX_EMPTINESS = 0.1;
const MAX_POLLUTION = 0.1;
const MAX_DEVIATION = 0.1;
const VSIZES_LENGTH = 39;
const RETRY_COOLDOWN = 24 * 60 * 60 * 1000;

/**
 * Syncs missing statistics data from trusted servers
 */
class StatisticsReplication {
  inProgress: boolean = false;
  failedAttempts: Record<string, number> = {};

  /** @asyncUnsafe */
  public async $sync(): Promise<void> {
    if (!config.REPLICATION.ENABLED || !config.REPLICATION.STATISTICS || !config.STATISTICS.ENABLED) {
      // replication not enabled, or statistics not enabled
      return;
    }
    if (this.inProgress) {
      logger.info(`StatisticsReplication sync already in progress`, logger.tags.replication);
      return;
    }
    this.inProgress = true;

    try {
      const missingStatistics = await this.$getMissingStatistics();
      const missingIntervals = Object.keys(missingStatistics).filter(key => missingStatistics[key].size > 0 && !this.isInCooldown(key));
      const totalMissing =  missingIntervals.reduce((total, key) => total + missingStatistics[key].size, 0);

      if (totalMissing === 0) {
        logger.info(`No missing statistics rows to replicate`, logger.tags.replication);
        return;
      }

      for (const interval of missingIntervals) {
        logger.debug(`Missing ${missingStatistics[interval].size} statistics rows in '${interval}' timespan`, logger.tags.replication);
      }
      logger.debug(`Fetching ${missingIntervals.join(', ')} statistics endpoints from trusted servers to fill ${totalMissing} rows missing in statistics`, logger.tags.replication);

      let totalSynced = 0;
      let totalMissed = 0;

      for (const interval of missingIntervals) {
        const results = await this.$syncStatistics(interval, missingStatistics[interval]);
        totalSynced += results.synced;
        totalMissed += results.missed;

        if (results.synced === 0) {
          this.failedAttempts[interval] = Date.now();
        }

        logger.info(`Found ${totalSynced} / ${totalSynced + totalMissed} of ${totalMissing} missing statistics rows`, logger.tags.replication);
        await Common.sleep$(3000);
      }

      logger.debug(`Synced ${totalSynced} statistics rows, ${totalMissed} still missing`, logger.tags.replication);
    } finally {
      this.inProgress = false;
    }
  }

  private isInCooldown(interval: string): boolean {
    const failedAt = this.failedAttempts[interval];
    return failedAt !== undefined && Date.now() - failedAt <= RETRY_COOLDOWN;
  }

  /** @asyncUnsafe */
  private async $syncStatistics(interval: string, missingTimes: Set<number>): Promise<any> {

    let success = false;
    let synced = 0;
    const missed = new Set(missingTimes);
    const syncResult = await $sync(`/api/v1/statistics/${interval}`, this.performSanityCheck.bind(this));
    if (syncResult && syncResult.data?.length && this.isValidResult(syncResult.data)) {
      success = true;
      logger.info(`Fetched /api/v1/statistics/${interval} from ${syncResult.server}`, logger.tags.replication);

      for (const stat of syncResult.data) {
        const time = this.roundToNearestStep(stat.added, steps[interval]);
        if (missingTimes.has(time)) {
          try {
            await statistics.$create(statistics.mapOptimizedStatisticToStatistic([stat])[0], true);
            if (missed.delete(time)) {
              synced++;
            }
          } catch (e: any) {
            logger.err(`Failed to insert statistics row at ${stat.added} (${interval}) from ${syncResult.server}. Reason: ` + (e instanceof Error ? e.message : e));
          }
        }
      }

    } else {
      logger.warn(`An error occurred when trying to fetch /api/v1/statistics/${interval}`, logger.tags.replication);
    }

    return { success, synced, missed: missed.size };
  }

  /**
   * Iterates over the list of results from trusted servers and compares each result against the others
   * to make sure their responses don't vary too much
   *
   * @param resultsPerServer responses keyed by the server that returned each result
   * @param path the path of the endpoint gotten, used to get its timespan parameter
   * @returns the healthiest result
   */
  private performSanityCheck(resultsPerServer: Record<string, OptimizedStatistic[]>, path: string): {serverPicked: string, sanitizedResult: OptimizedStatistic[]} {
    const servers = Object.keys(resultsPerServer);
    const results = Object.values(resultsPerServer);
    if (Object.entries(resultsPerServer).length === 0) {
      logger.err(`Early returned in the sanity check due to empty dataset at ${path}`, logger.tags.replication);
      return this.emptyResult();
    }

    const routes = path.split('/');
    const interval = routes[routes.length - 1];
    const step = steps[interval];

    const slottedResults: Map<number, OptimizedStatistic>[] = [];
    for (const result of results) {
      slottedResults.push(this.isValidResult(result) ? this.mapBySlot(result, step) : new Map());
    }

    logger.info(`Performing sanity check among ${servers.length} servers to pick the best result for ${path}`, logger.tags.replication);

    const alreadyScanned: Record<string, boolean> = {};
    const sanityResults: Record<string, boolean> = {};
    const emptyResult: Record<number, boolean> = {};
    for (let i = 0; i < results.length; i++) {
      if (emptyResult[i] || !Array.isArray(results[i]) || results[i].length === 0) {
        logger.warn(`Empty result detected in ${servers[i]} at ${path}`, logger.tags.replication);
        emptyResult[i] = true;
        continue;
      }
      for (let j = 0; j < results.length; j++) {
        if (i === j) {
          continue;
        }
        const checksKey = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (alreadyScanned[checksKey]) {
          continue;
        }
        if (emptyResult[j] || !Array.isArray(results[j]) || results[j].length === 0) {
          logger.warn(`Empty result detected in ${servers[j]} at ${path}`, logger.tags.replication);
          emptyResult[j] = true;
          continue;
        }

        const slots1 = slottedResults[i];
        const slots2 = slottedResults[j];
        const longest = Math.max(slots1.size, slots2.size);
        const sharedSlotCount = Array.from(slots1.keys()).filter(slot => slots2.has(slot)).length;
        const percentageEmptiness = (longest - sharedSlotCount) / longest;

        if (percentageEmptiness > MAX_EMPTINESS) {
          sanityResults[checksKey] = false;
          alreadyScanned[checksKey] = true;
          continue;
        }

        const sharedSlots: [OptimizedStatistic, OptimizedStatistic][] = [];
        for (const [slot, stat1] of slots1) {
          const stat2 = slots2.get(slot);
          if (stat2) {
            sharedSlots.push([stat1, stat2]);
          }
        }

        if (sharedSlots.length === 0) {
          sanityResults[checksKey] = false;
          alreadyScanned[checksKey] = true;
          continue;
        }

        const pollutionThreshold = Math.floor(sharedSlots.length * MAX_POLLUTION);
        let pollutionCounter = 0;

        for (const [stat1, stat2] of sharedSlots) {
          if (pollutionCounter > pollutionThreshold) {
            logger.warn(`Unhealthy result detected between ${servers[i]} and ${servers[j]} at ${path}`, logger.tags.replication);
            break;
          }

          if (this.deviates(stat1, stat2)) {
            pollutionCounter++;
          }
        }

        sanityResults[checksKey] = pollutionCounter <= pollutionThreshold;
        alreadyScanned[checksKey] = true;
      }
    }

    const candidatesRanking = this.getCandidatesRanking(sanityResults);

    let bestCandidateIndex = -1;
    let bestCandidateRanking = -1;
    for (const [index, ranking] of Object.entries(candidatesRanking)) { // We pick the candidate with the highest ranking
      if (ranking > bestCandidateRanking) {
        bestCandidateIndex = Number(index);
        bestCandidateRanking = ranking;
      }
    }

    if (bestCandidateIndex === -1 || candidatesRanking[bestCandidateIndex] < Math.floor(results.length / 2)) {
      logger.err(`The sanity check didn't reach majority agreement among ${servers.length} servers for ${path}`, logger.tags.replication);
      return this.emptyResult();
    }

    logger.info(`Best server after performing sanity check: ${servers[bestCandidateIndex]} for ${path}`, logger.tags.replication);

    return {serverPicked: servers[bestCandidateIndex], sanitizedResult: Array.from(slottedResults[bestCandidateIndex].values())};
  }

  private isValidResult(result: OptimizedStatistic[]): boolean {
    return Array.isArray(result) && result.every(stat =>
        stat && typeof stat === 'object'
        && Number.isFinite(Number(stat.added))
        && Number.isFinite(stat.count)
        && Array.isArray(stat.vsizes)
        && stat.vsizes.length === VSIZES_LENGTH
        && stat.vsizes.every(vsize => Number.isFinite(vsize))
      );
  }

  private deviates(stat1: OptimizedStatistic, stat2: OptimizedStatistic): boolean {
    const sum1 = this.sumArr(stat1.vsizes);
    const sum2 = this.sumArr(stat2.vsizes);
    return this.differs(stat1.count, stat2.count)
      || this.differs(sum1, sum2)
      || this.shareOfBandsDiffers(stat1.vsizes, sum1, stat2.vsizes, sum2);
  }

  private differs(value1: number, value2: number): boolean {
    return Math.abs(value1 - value2) > Math.max(value1, value2) * MAX_DEVIATION;
  }

  private sumArr(arr: number[]): number {
    return arr.reduce((acc, val) => acc + val, 0);
  }

  private shareOfBandsDiffers(vsizes1: number[], sum1: number, vsizes2: number[], sum2: number): boolean {
    let shareDiffBand = 0;
    for (let index = 0; index < vsizes1.length; index++) {
      shareDiffBand += Math.abs((vsizes1[index] / sum1) - (vsizes2[index] / sum2));
    }
    return shareDiffBand / 2 > MAX_DEVIATION;
  }

  private getCandidatesRanking(sanityResults: Record<string, boolean>): Record<number, number> {
    const candidatesRanking: Record<number, number> = {};
    for (const [key, result] of Object.entries(sanityResults)) {
      const [i, j] = key.split('-');

      if (result) {
        if (!candidatesRanking[i]) {
          candidatesRanking[i] = 0;
        }
        if (!candidatesRanking[j]) {
          candidatesRanking[j] = 0;
        }
        candidatesRanking[i]++;
        candidatesRanking[j]++;
      }
    }
    return candidatesRanking;
  }

  private emptyResult(): {serverPicked: string, sanitizedResult: never[]} {
    return {serverPicked: '', sanitizedResult: []};
  }

  private mapBySlot(stats: OptimizedStatistic[], step: number): Map<number, OptimizedStatistic> {
    const slots = new Map<number, OptimizedStatistic>();
    for (const stat of stats) {
      const slot = this.roundToNearestStep(Number(stat.added), step);
      if (!slots.has(slot)) {
        slots.set(slot, stat);
      }
    }
    return slots;
  }

  /** @asyncUnsafe */
  private async $getMissingStatistics(): Promise<MissingStatistics> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const day = 60 * 60 * 24;

      const startTime = this.getStartTimeFromConfig();

      const missingStatistics: MissingStatistics = {
        '24h': new Set<number>(),
        '1w': new Set<number>(),
        '1m': new Set<number>(),
        '3m': new Set<number>(),
        '6m': new Set<number>(),
        '2y': new Set<number>(),
        'all': new Set<number>()
      };

      const intervals = [              // [start,               end,                 label ]
                                          [now - day + 600,     now - 60,            '24h']       , // from 24 hours ago to now = 1 minute granularity
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
      logger.err(`Cannot fetch missing statistics times from db. Reason: ` + (e instanceof Error ? e.message : e), logger.tags.replication);
      throw e;
    }
  }

  /** @asyncUnsafe */
  private async $getMissingStatisticsInterval(interval: any, startTime: number): Promise<Set<number>> {
    try {
      const start = interval[0];
      const end = interval[1];
      const step = steps[interval[2]];

      const [rows]: any[] = await DB.query(`
        SELECT UNIX_TIMESTAMP(added) as added
        FROM statistics
        WHERE added >= FROM_UNIXTIME(?) AND added <= FROM_UNIXTIME(?)
        GROUP BY UNIX_TIMESTAMP(added) DIV ${step} ORDER BY statistics.added DESC
      `, [start, end]);

      const startingTime = Math.max(startTime, start) - Math.max(startTime, start) % step;

      const timeSteps: number[] = [];
      for (let time = startingTime; time < end; time += step) {
        timeSteps.push(time);
      }

      if (timeSteps.length === 0) {
        return new Set<number>();
      }

      const roundedTimesAlreadyHere = new Set<number>(rows.map(row => this.roundToNearestStep(row.added, step)));

      const missingTimes = timeSteps.filter(time => !roundedTimesAlreadyHere.has(time)).filter((time, i, arr) => {
        // Remove outsiders
        if (i === 0) {
          return arr[i + 1] === time + step;
        } else if (i === arr.length - 1) {
          return arr[i - 1] === time - step;
        }
        return (arr[i + 1] === time + step) && (arr[i - 1] === time - step);
      });

      // Don't bother fetching if very few rows are missing
      if (missingTimes.length < timeSteps.length * 0.01) {
        return new Set();
      }

      return new Set(missingTimes);
    } catch (e: any) {
      logger.err(`Cannot fetch missing statistics times from db. Reason: ` + (e instanceof Error ? e.message : e), logger.tags.replication);
      throw e;
    }
  }

  private roundToNearestStep(time: number, step: number): number {
    const remainder = time % step;
    if (remainder < step / 2) {
      return time - remainder;
    } else {
      return time + (step - remainder);
    }
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

