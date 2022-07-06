import { IndexedDifficultyAdjustment, PoolInfo, PoolStats, RewardStats } from '../mempool.interfaces';
import BlocksRepository from '../repositories/BlocksRepository';
import PoolsRepository from '../repositories/PoolsRepository';
import HashratesRepository from '../repositories/HashratesRepository';
import bitcoinClient from './bitcoin/bitcoin-client';
import logger from '../logger';
import { Common } from './common';
import loadingIndicators from './loading-indicators';
import { escape } from 'mysql2';
import indexer from '../indexer';
import DifficultyAdjustmentsRepository from '../repositories/DifficultyAdjustmentsRepository';
import config from '../config';

class Mining {
  constructor() {
  }

  /**
   * Get historical block total fee
   */
  public async $getHistoricalBlockFees(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockFees(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block rewards
   */
  public async $getHistoricalBlockRewards(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockRewards(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block fee rates percentiles
   */
   public async $getHistoricalBlockFeeRates(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockFeeRates(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block sizes
   */
   public async $getHistoricalBlockSizes(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockSizes(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Get historical block weights
   */
   public async $getHistoricalBlockWeights(interval: string | null = null): Promise<any> {
    return await BlocksRepository.$getHistoricalBlockWeights(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
  }

  /**
   * Generate high level overview of the pool ranks and general stats
   */
  public async $getPoolsStats(interval: string | null): Promise<object> {
    const poolsStatistics = {};

    const poolsInfo: PoolInfo[] = await PoolsRepository.$getPoolsInfo(interval);
    const emptyBlocks: any[] = await BlocksRepository.$countEmptyBlocks(null, interval);

    const poolsStats: PoolStats[] = [];
    let rank = 1;

    poolsInfo.forEach((poolInfo: PoolInfo) => {
      const emptyBlocksCount = emptyBlocks.filter((emptyCount) => emptyCount.poolId === poolInfo.poolId);
      const poolStat: PoolStats = {
        poolId: poolInfo.poolId, // mysql row id
        name: poolInfo.name,
        link: poolInfo.link,
        blockCount: poolInfo.blockCount,
        rank: rank++,
        emptyBlocks: emptyBlocksCount.length > 0 ? emptyBlocksCount[0]['count'] : 0,
        slug: poolInfo.slug,
      };
      poolsStats.push(poolStat);
    });

    poolsStatistics['pools'] = poolsStats;

    const blockCount: number = await BlocksRepository.$blockCount(null, interval);
    poolsStatistics['blockCount'] = blockCount;

    const totalBlock24h: number = await BlocksRepository.$blockCount(null, '24h');

    try {
      poolsStatistics['lastEstimatedHashrate'] = await bitcoinClient.getNetworkHashPs(totalBlock24h);
    } catch (e) {
      poolsStatistics['lastEstimatedHashrate'] = 0;
      logger.debug('Bitcoin Core is not available, using zeroed value for current hashrate');
    }

    return poolsStatistics;
  }

  /**
   * Get all mining pool stats for a pool
   */
  public async $getPoolStat(slug: string): Promise<object> {
    const pool = await PoolsRepository.$getPool(slug);
    if (!pool) {
      throw new Error('This mining pool does not exist ' + escape(slug));
    }

    const blockCount: number = await BlocksRepository.$blockCount(pool.id);
    const totalBlock: number = await BlocksRepository.$blockCount(null, null);

    const blockCount24h: number = await BlocksRepository.$blockCount(pool.id, '24h');
    const totalBlock24h: number = await BlocksRepository.$blockCount(null, '24h');

    const blockCount1w: number = await BlocksRepository.$blockCount(pool.id, '1w');
    const totalBlock1w: number = await BlocksRepository.$blockCount(null, '1w');

    let currentEstimatedHashrate = 0;
    try {
      currentEstimatedHashrate = await bitcoinClient.getNetworkHashPs(totalBlock24h);
    } catch (e) {
      logger.debug('Bitcoin Core is not available, using zeroed value for current hashrate');
    }

    return {
      pool: pool,
      blockCount: {
        'all': blockCount,
        '24h': blockCount24h,
        '1w': blockCount1w,
      },
      blockShare: {
        'all': blockCount / totalBlock,
        '24h': blockCount24h / totalBlock24h,
        '1w': blockCount1w / totalBlock1w,
      },
      estimatedHashrate: currentEstimatedHashrate * (blockCount24h / totalBlock24h),
      reportedHashrate: null,
    };
  }

  /**
   * Get miner reward stats
   */
  public async $getRewardStats(blockCount: number): Promise<RewardStats> {
    return await BlocksRepository.$getBlockStats(blockCount);
  }

  /**
   * [INDEXING] Generate weekly mining pool hashrate history
   */
  public async $generatePoolHashrateHistory(): Promise<void> {
    const now = new Date();

    try {
      const lastestRunDate = await HashratesRepository.$getLatestRun('last_weekly_hashrates_indexing');

      // Run only if:
      // * lastestRunDate is set to 0 (node backend restart, reorg)
      // * we started a new week (around Monday midnight)
      const runIndexing = lastestRunDate === 0 || now.getUTCDay() === 1 && lastestRunDate !== now.getUTCDate();
      if (!runIndexing) {
        return;
      }
    } catch (e) {
      throw e;
    }

    try {
      const indexedTimestamp = await HashratesRepository.$getWeeklyHashrateTimestamps();
      const hashrates: any[] = [];
      const genesisTimestamp = 1231006505000; // bitcoin-cli getblock 000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f

      const lastMonday = new Date(now.setDate(now.getDate() - (now.getDay() + 6) % 7));
      const lastMondayMidnight = this.getDateMidnight(lastMonday);
      let toTimestamp = lastMondayMidnight.getTime();

      const totalWeekIndexed = (await BlocksRepository.$blockCount(null, null)) / 1008;
      let indexedThisRun = 0;
      let totalIndexed = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      logger.debug(`Indexing weekly mining pool hashrate`);
      loadingIndicators.setProgress('weekly-hashrate-indexing', 0);

      while (toTimestamp > genesisTimestamp) {
        const fromTimestamp = toTimestamp - 604800000;

        // Skip already indexed weeks
        if (indexedTimestamp.includes(toTimestamp / 1000)) {
          toTimestamp -= 604800000;
          ++totalIndexed;
          continue;
        }

        // Check if we have blocks for the previous week (which mean that the week
        // we are currently indexing has complete data)
        const blockStatsPreviousWeek: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, (fromTimestamp - 604800000) / 1000, (toTimestamp - 604800000) / 1000);
        if (blockStatsPreviousWeek.blockCount === 0) { // We are done indexing
          break;
        }

        const blockStats: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, fromTimestamp / 1000, toTimestamp / 1000);
        const lastBlockHashrate = await bitcoinClient.getNetworkHashPs(blockStats.blockCount,
          blockStats.lastBlockHeight);

        let pools = await PoolsRepository.$getPoolsInfoBetween(fromTimestamp / 1000, toTimestamp / 1000);
        const totalBlocks = pools.reduce((acc, pool) => acc + pool.blockCount, 0);
        pools = pools.map((pool: any) => {
          pool.hashrate = (pool.blockCount / totalBlocks) * lastBlockHashrate;
          pool.share = (pool.blockCount / totalBlocks);
          return pool;
        });

        for (const pool of pools) {
          hashrates.push({
            hashrateTimestamp: toTimestamp / 1000,
            avgHashrate: pool['hashrate'],
            poolId: pool.poolId,
            share: pool['share'],
            type: 'weekly',
          });
        }

        newlyIndexed += hashrates.length;
        await HashratesRepository.$saveHashrates(hashrates);
        hashrates.length = 0;

        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 1) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const weeksPerSeconds = Math.max(1, Math.round(indexedThisRun / elapsedSeconds));
          const progress = Math.round(totalIndexed / totalWeekIndexed * 10000) / 100;
          const timeLeft = Math.round((totalWeekIndexed - totalIndexed) / weeksPerSeconds);
          const formattedDate = new Date(fromTimestamp).toUTCString();
          logger.debug(`Getting weekly pool hashrate for ${formattedDate} | ~${weeksPerSeconds.toFixed(2)} weeks/sec | total: ~${totalIndexed}/${Math.round(totalWeekIndexed)} (${progress}%) | elapsed: ${runningFor} seconds | left: ~${timeLeft} seconds`);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
          loadingIndicators.setProgress('weekly-hashrate-indexing', progress, false);
        }

        toTimestamp -= 604800000;
        ++indexedThisRun;
        ++totalIndexed;
      }
      await HashratesRepository.$setLatestRun('last_weekly_hashrates_indexing', new Date().getUTCDate());
      if (newlyIndexed > 0) {
        logger.notice(`Weekly mining pools hashrates indexing completed: indexed ${newlyIndexed}`);
      }
      loadingIndicators.setProgress('weekly-hashrate-indexing', 100);
    } catch (e) {
      loadingIndicators.setProgress('weekly-hashrate-indexing', 100);
      logger.err(`Weekly mining pools hashrates indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  /**
   * [INDEXING] Generate daily hashrate data
   */
  public async $generateNetworkHashrateHistory(): Promise<void> {
    try {
      // We only run this once a day around midnight
      const latestRunDate = await HashratesRepository.$getLatestRun('last_hashrates_indexing');
      const now = new Date().getUTCDate();
      if (now === latestRunDate) {
        return;
      }
    } catch (e) {
      throw e;
    }

    try {
      const indexedTimestamp = (await HashratesRepository.$getNetworkDailyHashrate(null)).map(hashrate => hashrate.timestamp);
      const genesisTimestamp = 1231006505000; // bitcoin-cli getblock 000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
      const lastMidnight = this.getDateMidnight(new Date());
      let toTimestamp = Math.round(lastMidnight.getTime());
      const hashrates: any[] = [];

      const totalDayIndexed = (await BlocksRepository.$blockCount(null, null)) / 144;
      let indexedThisRun = 0;
      let totalIndexed = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      logger.debug(`Indexing daily network hashrate`);
      loadingIndicators.setProgress('daily-hashrate-indexing', 0);

      while (toTimestamp > genesisTimestamp) {
        const fromTimestamp = toTimestamp - 86400000;

        // Skip already indexed days
        if (indexedTimestamp.includes(toTimestamp / 1000)) {
          toTimestamp -= 86400000;
          ++totalIndexed;
          continue;
        }

        // Check if we have blocks for the previous day (which mean that the day
        // we are currently indexing has complete data)
        const blockStatsPreviousDay: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, (fromTimestamp - 86400000) / 1000, (toTimestamp - 86400000) / 1000);
        if (blockStatsPreviousDay.blockCount === 0 && config.MEMPOOL.NETWORK === 'mainnet') { // We are done indexing
          break;
        }

        const blockStats: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, fromTimestamp / 1000, toTimestamp / 1000);
        const lastBlockHashrate = await bitcoinClient.getNetworkHashPs(blockStats.blockCount,
          blockStats.lastBlockHeight);

        hashrates.push({
          hashrateTimestamp: toTimestamp / 1000,
          avgHashrate: lastBlockHashrate,
          poolId: 0,
          share: 1,
          type: 'daily',
        });

        if (hashrates.length > 10) {
          newlyIndexed += hashrates.length;
          await HashratesRepository.$saveHashrates(hashrates);
          hashrates.length = 0;
        }

        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 1) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const daysPerSeconds = Math.max(1, Math.round(indexedThisRun / elapsedSeconds));
          const progress = Math.round(totalIndexed / totalDayIndexed * 10000) / 100;
          const timeLeft = Math.round((totalDayIndexed - totalIndexed) / daysPerSeconds);
          const formattedDate = new Date(fromTimestamp).toUTCString();
          logger.debug(`Getting network daily hashrate for ${formattedDate} | ~${daysPerSeconds.toFixed(2)} days/sec | total: ~${totalIndexed}/${Math.round(totalDayIndexed)} (${progress}%) | elapsed: ${runningFor} seconds | left: ~${timeLeft} seconds`);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
          loadingIndicators.setProgress('daily-hashrate-indexing', progress);
        }

        toTimestamp -= 86400000;
        ++indexedThisRun;
        ++totalIndexed;
      }

      // Add genesis block manually
      if (toTimestamp <= genesisTimestamp && !indexedTimestamp.includes(genesisTimestamp)) {
        hashrates.push({
          hashrateTimestamp: genesisTimestamp / 1000,
          avgHashrate: await bitcoinClient.getNetworkHashPs(1, 1),
          poolId: 0,
          share: 1,
          type: 'daily',
        });
      }

      newlyIndexed += hashrates.length;
      await HashratesRepository.$saveHashrates(hashrates);

      await HashratesRepository.$setLatestRun('last_hashrates_indexing', new Date().getUTCDate());
      if (newlyIndexed > 0) {
        logger.notice(`Daily network hashrate indexing completed: indexed ${newlyIndexed} days`);
      }
      loadingIndicators.setProgress('daily-hashrate-indexing', 100);
    } catch (e) {
      loadingIndicators.setProgress('daily-hashrate-indexing', 100);
      logger.err(`Daily network hashrate indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  /**
   * Index difficulty adjustments
   */
  public async $indexDifficultyAdjustments(): Promise<void> {
    const indexedHeightsArray = await DifficultyAdjustmentsRepository.$getAdjustmentsHeights();
    const indexedHeights = {};
    for (const height of indexedHeightsArray) {
      indexedHeights[height] = true;
    }

    const blocks: any = await BlocksRepository.$getBlocksDifficulty();

    let currentDifficulty = 0;
    let totalIndexed = 0;

    if (indexedHeights[0] === false) {
      await DifficultyAdjustmentsRepository.$saveAdjustments({
        time: 1231006505,
        height: 0,
        difficulty: 1.0,
        adjustment: 0.0,
      });
    }

    for (const block of blocks) {
      if (block.difficulty !== currentDifficulty) {
        if (block.height === 0 || indexedHeights[block.height] === true) { // Already indexed
          currentDifficulty = block.difficulty;
          continue;          
        }

        let adjustment = block.difficulty / Math.max(1, currentDifficulty);
        adjustment = Math.round(adjustment * 1000000) / 1000000; // Remove float point noise

        await DifficultyAdjustmentsRepository.$saveAdjustments({
          time: block.time,
          height: block.height,
          difficulty: block.difficulty,
          adjustment: adjustment,
        });

        totalIndexed++;
        currentDifficulty = block.difficulty;
      }
    }

    if (totalIndexed > 0) {
      logger.notice(`Indexed ${totalIndexed} difficulty adjustments`);
    }
  }

  private getDateMidnight(date: Date): Date {
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);

    return date;
  }

  private getTimeRange(interval: string | null): number {
    switch (interval) {
      case '3y': return 43200; // 12h
      case '2y': return 28800; // 8h
      case '1y': return 28800; // 8h
      case '6m': return 10800; // 3h
      case '3m': return 7200; // 2h
      case '1m': return 1800; // 30min
      case '1w': return 300; // 5min
      case '3d': return 1;
      case '24h': return 1;
      default: return 86400; // 24h
    }
  }
}

export default new Mining();
