import DB from '../database';
import logger from '../logger';
import { query } from './replicator';
import config from '../config';
import { Common } from '../api/common';
import statistics from '../api/statistics/statistics-api';
import backendInfo from '../api/backend-info';
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

const listMethods: Record<string, () => Promise<OptimizedStatistic[]>> = {
  '24h': () => statistics.$list24H(),
  '1w': () => statistics.$list1W(),
  '1m': () => statistics.$list1M(),
  '3m': () => statistics.$list3M(),
  '6m': () => statistics.$list6M(),
  '2y': () => statistics.$list2Y(),
  'all': () => statistics.$listAll(),
};

const RETRY_COOLDOWN = 60 * 60 * 24 * 1000;
const VSIZES_LENGTH = 39;
const MAX_DEVIATION = 0.1;
const MAX_POLLUTION = 0.1;
const CHUNK_SLOTS = 60;
const SAMPLE_PEERS = 3;
const MAX_PEERS = 8;
const CONSENSUS_PEERS = 3;
const SLOT_TOLERANCE = 0.05;
const JUMP_MARGIN = 2;
const VARIATION_MARGIN = 3;
const STEP_MARGIN = 3;

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
      let results;
      try {
        results = await this.$syncStatistics(interval, missingStatistics[interval]);
      } catch (e: any) {
        this.failedAttempts[interval] = Date.now();
        logger.err(`Failed to sync statistics in '${interval}' timespan. Reason: ` + (e instanceof Error ? e.message : e), logger.tags.replication);
        continue;
      }
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
    const step = steps[interval];
    const path = `/api/v1/statistics/${interval}`;
    const localSlots = this.mapBySlot(await listMethods[interval](), step);
    const servers = config.REPLICATION.SERVERS.filter(server => server !== backendInfo.getBackendInfo().hostname);
    if (servers.length < CONSENSUS_PEERS) {
      logger.warn(`Only ${servers.length} of ${CONSENSUS_PEERS} servers needed for consensus, '${interval}' gaps without prior local data will be skipped`, logger.tags.replication);
    }
    Common.shuffleArray(servers);
    const peers = new Map<string, Map<number, OptimizedStatistic>>();
    await this.$addPeers(peers, servers, path, step, SAMPLE_PEERS);
    if (peers.size === 0) {
      logger.warn(`An error occurred when trying to fetch ${path}`, logger.tags.replication);
      return { success, synced, missed: missed.size };
    }

    for (const chunk of this.chunk(Array.from(missingTimes).sort((a, b) => a - b), step)) {
      let source = this.pickSource(chunk, localSlots, peers, step);
      while (!source && peers.size < MAX_PEERS && servers.length > 0) {
        await this.$addPeers(peers, servers, path, step, peers.size + 1);
        source = this.pickSource(chunk, localSlots, peers, step);
      }
      if (!source) {
        logger.warn(`No peer is good enough for ${chunk.length} statistics rows from ${chunk[0]} in '${interval}' timespan`, logger.tags.replication);
        continue;
      }
      success = true;

      for (const time of chunk) {
        const stat = peers.get(source)?.get(time);
        if (stat && await statistics.$create(statistics.mapOptimizedStatisticToStatistic([stat])[0], true) !== undefined) {
          localSlots.set(time, stat);
          if (missed.delete(time)) {
            synced++;
          }
        }
      }
    }

    return { success, synced, missed: missed.size };
  }

  /** @asyncSafe */
  private async $addPeers(peers: Map<string, Map<number, OptimizedStatistic>>, servers: string[], path: string, step: number, target: number): Promise<void> {
    while (peers.size < target && servers.length > 0) {
      const server = servers.shift() as string;
      try {
        const result = await query(`https://${server}${path}`) as OptimizedStatistic[];
        if (this.isValidResult(result)) {
          peers.set(server, this.mapBySlot(result, step));
        } else {
          logger.warn(`Invalid statistics from ${server} at ${path}`, logger.tags.replication);
        }
      } catch (e: any) {
        logger.debug(`Failed to fetch ${path} from ${server}. Reason: ` + (e instanceof Error ? e.message : e), logger.tags.replication);
      }
    }
  }

  private chunk(times: number[], step: number): number[][] {
    const chunks: number[][] = [];
    for (const time of times) {
      const last = chunks[chunks.length - 1];
      if (last && last.length < CHUNK_SLOTS && time === last[last.length - 1] + step) {
        last.push(time);
      } else {
        chunks.push([time]);
      }
    }
    return chunks;
  }

  private pickSource(chunk: number[], localSlots: Map<number, OptimizedStatistic>, peers: Map<string, Map<number, OptimizedStatistic>>, step: number): string | null {
    const candidates = Array.from(peers).filter(([, slots]) => chunk.some(time => slots.has(time)));

    const previous: [number, OptimizedStatistic][] = [];
    for (let time = chunk[0] - step; time >= chunk[0] - CHUNK_SLOTS * step && localSlots.has(time); time -= step) {
      previous.unshift([time, localSlots.get(time) as OptimizedStatistic]);
    }

    if (previous.length >= 2) {
      const ours = previous.map(([, stat]) => stat);
      const ownVariation = this.meanStep(ours);
      const ownMaxStep = this.maxStep(ours);
      let continuous: string | null = null;
      let mostCovered = 0;
      let smallestJump = Infinity;
      for (const [server, slots] of candidates) {
        const jump = this.continuityJump(chunk, previous, ownVariation, ownMaxStep, slots);
        const covered = chunk.filter(time => slots.has(time)).length;
        if (jump !== null && (covered > mostCovered || (covered === mostCovered && jump < smallestJump))) {
          continuous = server;
          mostCovered = covered;
          smallestJump = jump;
        }
      }
      if (continuous) {
        return continuous;
      }
    }

    let agreed: string | null = null;
    let mostAgreements = CONSENSUS_PEERS - 2;
    let agreedCoverage = 0;
    for (const [server, slots] of candidates) {
      const agreements = candidates.filter(([other, otherSlots]) => other !== server && this.agree(chunk, slots, otherSlots)).length;
      const covered = chunk.filter(time => slots.has(time)).length;
      if (agreements > mostAgreements || (agreed !== null && agreements === mostAgreements && covered > agreedCoverage)) {
        agreed = server;
        mostAgreements = agreements;
        agreedCoverage = covered;
      }
    }
    return agreed;
  }

  private continuityJump(chunk: number[], previous: [number, OptimizedStatistic][], ownVariation: number, ownMaxStep: number, slots: Map<number, OptimizedStatistic>): number | null {
    const shared = previous.filter(([time]) => slots.has(time));
    if (shared.length < previous.length / 2) {
      return null;
    }
    const ourRows = shared.map(([, stat]) => stat);
    const peerRows = shared.map(([time]) => slots.get(time) as OptimizedStatistic);
    if (this.meanDistance(ourRows, peerRows) > SLOT_TOLERANCE) {
      return null;
    }

    const peerChunk = chunk.filter(time => slots.has(time)).map(time => slots.get(time) as OptimizedStatistic);
    const jump = this.distance(previous[previous.length - 1][1], peerChunk[0]);
    if (jump > ownVariation * JUMP_MARGIN) {
      return null;
    }
    if (peerChunk.length >= 2) {
      const peerVariation = this.meanStep(peerChunk);
      if (peerVariation < ownVariation / VARIATION_MARGIN || peerVariation > ownVariation * VARIATION_MARGIN || this.maxStep(peerChunk) > ownMaxStep * STEP_MARGIN) {
        return null;
      }
    }
    return jump;
  }

  private steps(stats: OptimizedStatistic[]): number[] {
    const steps: number[] = [];
    for (let index = 1; index < stats.length; index++) {
      steps.push(this.distance(stats[index - 1], stats[index]));
    }
    return steps;
  }

  private meanStep(stats: OptimizedStatistic[]): number {
    const steps = this.steps(stats);
    return this.sumArr(steps) / steps.length;
  }

  private maxStep(stats: OptimizedStatistic[]): number {
    return Math.max(...this.steps(stats));
  }

  private meanDistance(stats1: OptimizedStatistic[], stats2: OptimizedStatistic[]): number {
    let total = 0;
    for (let index = 0; index < stats1.length; index++) {
      total += this.distance(stats1[index], stats2[index]);
    }
    return total / stats1.length;
  }

  private agree(chunk: number[], slots1: Map<number, OptimizedStatistic>, slots2: Map<number, OptimizedStatistic>): boolean {
    const shared = chunk.filter(time => slots1.has(time) && slots2.has(time));
    const deviating = shared.filter(time => this.distance(slots1.get(time) as OptimizedStatistic, slots2.get(time) as OptimizedStatistic) > MAX_DEVIATION).length;
    return shared.length >= chunk.length / 2 && deviating <= Math.floor(shared.length * MAX_POLLUTION);
  }

  private isValidResult(result: OptimizedStatistic[]): boolean {
    return Array.isArray(result) && result.length > 0 && result.every(stat =>
      stat && typeof stat === 'object'
      && Number.isFinite(Number(stat.added))
      && Number.isFinite(stat.count)
      && Array.isArray(stat.vsizes)
      && stat.vsizes.length === VSIZES_LENGTH
      && stat.vsizes.every(vsize => Number.isFinite(vsize))
    );
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

  private distance(stat1: OptimizedStatistic, stat2: OptimizedStatistic): number {
    const sum1 = this.sumArr(stat1.vsizes);
    const sum2 = this.sumArr(stat2.vsizes);
    let shareDiffBand = 0;
    for (let index = 0; index < stat1.vsizes.length; index++) {
      shareDiffBand += Math.abs((stat1.vsizes[index] / (sum1 || 1)) - (stat2.vsizes[index] / (sum2 || 1)));
    }
    return Math.max(this.relativeDiff(stat1.count, stat2.count), this.relativeDiff(sum1, sum2), shareDiffBand / 2);
  }

  private relativeDiff(value1: number, value2: number): number {
    return Math.abs(value1 - value2) / (Math.max(value1, value2) || 1);
  }

  private sumArr(arr: number[]): number {
    return arr.reduce((acc, val) => acc + val, 0);
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
        return arr[i + 1] === time + step || arr[i - 1] === time - step;
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

