import { BlockPrice, PoolInfo, PoolStats, RewardStats } from '../../mempool.interfaces';
import BlocksRepository from '../../repositories/BlocksRepository';
import PoolsRepository from '../../repositories/PoolsRepository';
import HashratesRepository from '../../repositories/HashratesRepository';
import bitcoinClient from '../bitcoin/bitcoin-client';
import logger from '../../logger';
import { Common } from '../common';
import loadingIndicators from '../loading-indicators';
import { escape } from 'mysql2';
import DifficultyAdjustmentsRepository from '../../repositories/DifficultyAdjustmentsRepository';
import config from '../../config';
import BlocksAuditsRepository from '../../repositories/BlocksAuditsRepository';
import PricesRepository from '../../repositories/PricesRepository';
import bitcoinApi from '../bitcoin/bitcoin-api-factory';
import { IEsploraApi } from '../bitcoin/esplora-api.interface';
import database from '../../database';

interface DifficultyBlock {
  timestamp: number,
  height: number,
  bits: number,
  difficulty: number,
}

class Mining {
  private blocksPriceIndexingRunning = false;
  public lastHashrateIndexingDate: number | null = null;
  public lastWeeklyHashrateIndexingDate: number | null = null;
  
  public reindexHashrateRequested = false;
  public reindexDifficultyAdjustmentRequested = false;

  /**
   * Get historical blocks health
   */
  public async $getBlocksHealthHistory(interval: string | null = null): Promise<any> {
    return await BlocksAuditsRepository.$getBlocksHealthHistory(
      this.getTimeRange(interval),
      Common.getSqlInterval(interval)
    );
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
   * Get timespan block total fees
   */
  public async $getBlockFeesTimespan(from: number, to: number): Promise<number> {
    return await BlocksRepository.$getHistoricalBlockFees(
      this.getTimeRangeFromTimespan(from, to),
      null,
      {from, to}
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
        avgMatchRate: poolInfo.avgMatchRate !== null ? Math.round(100 * poolInfo.avgMatchRate) / 100 : null,
        avgFeeDelta: poolInfo.avgFeeDelta,
        poolUniqueId: poolInfo.poolUniqueId
      };
      poolsStats.push(poolStat);
    });

    poolsStatistics['pools'] = poolsStats;

    const blockCount: number = await BlocksRepository.$blockCount(null, interval);
    poolsStatistics['blockCount'] = blockCount;

    const totalBlock24h: number = await BlocksRepository.$blockCount(null, '24h');
    const totalBlock3d: number = await BlocksRepository.$blockCount(null, '3d');
    const totalBlock1w: number = await BlocksRepository.$blockCount(null, '1w');

    try {
      poolsStatistics['lastEstimatedHashrate'] = await bitcoinClient.getNetworkHashPs(totalBlock24h);
      poolsStatistics['lastEstimatedHashrate3d'] = await bitcoinClient.getNetworkHashPs(totalBlock3d);
      poolsStatistics['lastEstimatedHashrate1w'] = await bitcoinClient.getNetworkHashPs(totalBlock1w);
    } catch (e) {
      poolsStatistics['lastEstimatedHashrate'] = 0;
      logger.debug('Bitcoin Core is not available, using zeroed value for current hashrate', logger.tags.mining);
    }

    return poolsStatistics;
  }

  /**
   * Get all mining pool stats for a pool
   */
  public async $getPoolStat(slug: string): Promise<object> {
    const pool = await PoolsRepository.$getPool(slug);
    if (!pool) {
      throw new Error('This mining pool does not exist');
    }

    const blockCount: number = await BlocksRepository.$blockCount(pool.id);
    const totalBlock: number = await BlocksRepository.$blockCount(null, null);

    const blockCount24h: number = await BlocksRepository.$blockCount(pool.id, '24h');
    const totalBlock24h: number = await BlocksRepository.$blockCount(null, '24h');

    const blockCount1w: number = await BlocksRepository.$blockCount(pool.id, '1w');
    const totalBlock1w: number = await BlocksRepository.$blockCount(null, '1w');

    const avgHealth = await BlocksRepository.$getAvgBlockHealthPerPoolId(pool.id);    
    const totalReward = await BlocksRepository.$getTotalRewardForPoolId(pool.id);    

    let currentEstimatedHashrate = 0;
    try {
      currentEstimatedHashrate = await bitcoinClient.getNetworkHashPs(totalBlock24h);
    } catch (e) {
      logger.debug('Bitcoin Core is not available, using zeroed value for current hashrate', logger.tags.mining);
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
      avgBlockHealth: avgHealth,
      totalReward: totalReward,
    };
  }

  /**
   * Get miner reward stats
   */
  public async $getRewardStats(blockCount: number): Promise<RewardStats> {
    return await BlocksRepository.$getBlockStats(blockCount);
  }

  /**
   * Generate weekly mining pool hashrate history
   */
  public async $generatePoolHashrateHistory(): Promise<void> {
    const now = new Date();

    // Run only if:
    // * this.lastWeeklyHashrateIndexingDate is set to null (node backend restart, reorg)
    // * we started a new week (around Monday midnight)
    const runIndexing = this.lastWeeklyHashrateIndexingDate === null ||
      now.getUTCDay() === 1 && this.lastWeeklyHashrateIndexingDate !== now.getUTCDate();
    if (!runIndexing) {
      logger.debug(`Pool hashrate history indexing is up to date, nothing to do`, logger.tags.mining);
      return;
    }

    try {
      const oldestConsecutiveBlockTimestamp = 1000 * (await BlocksRepository.$getOldestConsecutiveBlock()).timestamp;

      const genesisBlock: IEsploraApi.Block = await bitcoinApi.$getBlock(await bitcoinApi.$getBlockHash(0));
      const genesisTimestamp = genesisBlock.timestamp * 1000;

      const indexedTimestamp = await HashratesRepository.$getWeeklyHashrateTimestamps();
      const hashrates: any[] = [];
 
      const lastMonday = new Date(now.setDate(now.getDate() - (now.getDay() + 6) % 7));
      const lastMondayMidnight = this.getDateMidnight(lastMonday);
      let toTimestamp = lastMondayMidnight.getTime();

      const totalWeekIndexed = (await BlocksRepository.$blockCount(null, null)) / 1008;
      let indexedThisRun = 0;
      let totalIndexed = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      logger.debug(`Indexing weekly mining pool hashrate`, logger.tags.mining);
      loadingIndicators.setProgress('weekly-hashrate-indexing', 0);

      while (toTimestamp > genesisTimestamp && toTimestamp > oldestConsecutiveBlockTimestamp) {
        const fromTimestamp = toTimestamp - 604800000;

        // Skip already indexed weeks
        if (indexedTimestamp.includes(toTimestamp / 1000)) {
          toTimestamp -= 604800000;
          ++totalIndexed;
          continue;
        }

        const blockStats: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, fromTimestamp / 1000, toTimestamp / 1000);
        const lastBlockHashrate = await bitcoinClient.getNetworkHashPs(blockStats.blockCount,
          blockStats.lastBlockHeight);

        let pools = await PoolsRepository.$getPoolsInfoBetween(fromTimestamp / 1000, toTimestamp / 1000);
        const totalBlocks = pools.reduce((acc, pool) => acc + pool.blockCount, 0);
        if (totalBlocks > 0) {
          pools = pools.map((pool: any) => {
            pool.hashrate = (pool.blockCount / totalBlocks) * lastBlockHashrate;
            pool.share = (pool.blockCount / totalBlocks);
            return pool;
          });

          for (const pool of pools) {
            hashrates.push({
              hashrateTimestamp: toTimestamp / 1000,
              avgHashrate: pool['hashrate'] ,
              poolId: pool.poolId,
              share: pool['share'],
              type: 'weekly',
            });
          }

          newlyIndexed += hashrates.length / Math.max(1, pools.length);
          await HashratesRepository.$saveHashrates(hashrates);
          hashrates.length = 0;
        }

        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 1) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const weeksPerSeconds = Math.max(1, Math.round(indexedThisRun / elapsedSeconds));
          const progress = Math.round(totalIndexed / totalWeekIndexed * 10000) / 100;
          const formattedDate = new Date(fromTimestamp).toUTCString();
          logger.debug(`Getting weekly pool hashrate for ${formattedDate} | ~${weeksPerSeconds.toFixed(2)} weeks/sec | total: ~${totalIndexed}/${Math.round(totalWeekIndexed)} (${progress}%) | elapsed: ${runningFor} seconds`, logger.tags.mining);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
          loadingIndicators.setProgress('weekly-hashrate-indexing', progress, false);
        }

        toTimestamp -= 604800000;
        ++indexedThisRun;
        ++totalIndexed;
      }
      this.lastWeeklyHashrateIndexingDate = new Date().getUTCDate();
      if (newlyIndexed > 0) {
        logger.info(`Weekly mining pools hashrates indexing completed: indexed ${newlyIndexed} weeks`, logger.tags.mining);
      } else {
        logger.debug(`Weekly mining pools hashrates indexing completed: indexed ${newlyIndexed} weeks`, logger.tags.mining);
      }
      loadingIndicators.setProgress('weekly-hashrate-indexing', 100);
    } catch (e) {
      loadingIndicators.setProgress('weekly-hashrate-indexing', 100);
      logger.err(`Weekly mining pools hashrates indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
      throw e;
    }
  }

  /**
   * Generate daily hashrate data
   */
  public async $generateNetworkHashrateHistory(): Promise<void> {
    // If a re-index was requested, truncate first
    if (this.reindexHashrateRequested === true) {
      logger.notice(`hashrates will now be re-indexed`);
      await database.query(`TRUNCATE hashrates`);
      this.lastHashrateIndexingDate = 0;
      this.reindexHashrateRequested = false;
    }

    // We only run this once a day around midnight
    const today = new Date().getUTCDate();
    if (today === this.lastHashrateIndexingDate) {
      logger.debug(`Network hashrate history indexing is up to date, nothing to do`, logger.tags.mining);
      return;
    }

    const oldestConsecutiveBlockTimestamp = 1000 * (await BlocksRepository.$getOldestConsecutiveBlock()).timestamp;

    try {
      const genesisBlock: IEsploraApi.Block = await bitcoinApi.$getBlock(await bitcoinApi.$getBlockHash(0));
      const genesisTimestamp = genesisBlock.timestamp * 1000;
      const indexedTimestamp = (await HashratesRepository.$getRawNetworkDailyHashrate(null)).map(hashrate => hashrate.timestamp);
      const lastMidnight = this.getDateMidnight(new Date());
      let toTimestamp = Math.round(lastMidnight.getTime());
      const hashrates: any[] = [];

      const totalDayIndexed = (await BlocksRepository.$blockCount(null, null)) / 144;
      let indexedThisRun = 0;
      let totalIndexed = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      logger.debug(`Indexing daily network hashrate`, logger.tags.mining);
      loadingIndicators.setProgress('daily-hashrate-indexing', 0);

      while (toTimestamp > genesisTimestamp && toTimestamp > oldestConsecutiveBlockTimestamp) {
        const fromTimestamp = toTimestamp - 86400000;

        // Skip already indexed days
        if (indexedTimestamp.includes(toTimestamp / 1000)) {
          toTimestamp -= 86400000;
          ++totalIndexed;
          continue;
        }

        const blockStats: any = await BlocksRepository.$blockCountBetweenTimestamp(
          null, fromTimestamp / 1000, toTimestamp / 1000);
        const lastBlockHashrate = blockStats.blockCount === 0 ? 0 : await bitcoinClient.getNetworkHashPs(blockStats.blockCount,
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
          const formattedDate = new Date(fromTimestamp).toUTCString();
          logger.debug(`Getting network daily hashrate for ${formattedDate} | ~${daysPerSeconds.toFixed(2)} days/sec | total: ~${totalIndexed}/${Math.round(totalDayIndexed)} (${progress}%) | elapsed: ${runningFor} seconds`, logger.tags.mining);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
          loadingIndicators.setProgress('daily-hashrate-indexing', progress);
        }

        toTimestamp -= 86400000;
        ++indexedThisRun;
        ++totalIndexed;
      }

      // Add genesis block manually
      if (config.MEMPOOL.INDEXING_BLOCKS_AMOUNT === -1 && !indexedTimestamp.includes(genesisTimestamp / 1000)) {
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

      this.lastHashrateIndexingDate = new Date().getUTCDate();
      if (newlyIndexed > 0) {
        logger.info(`Daily network hashrate indexing completed: indexed ${newlyIndexed} days`, logger.tags.mining);
      } else {
        logger.debug(`Daily network hashrate indexing completed: indexed ${newlyIndexed} days`, logger.tags.mining);
      }
      loadingIndicators.setProgress('daily-hashrate-indexing', 100);
    } catch (e) {
      loadingIndicators.setProgress('daily-hashrate-indexing', 100);
      logger.err(`Daily network hashrate indexing failed. Trying again later. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
      throw e;
    }
  }

  /**
   * Index difficulty adjustments
   */
  public async $indexDifficultyAdjustments(): Promise<void> {
    // If a re-index was requested, truncate first
    if (this.reindexDifficultyAdjustmentRequested === true) {
      logger.notice(`difficulty_adjustments will now be re-indexed`);
      await database.query(`TRUNCATE difficulty_adjustments`);
      this.reindexDifficultyAdjustmentRequested = false;
    }

    const indexedHeightsArray = await DifficultyAdjustmentsRepository.$getAdjustmentsHeights();
    const indexedHeights = {};
    for (const height of indexedHeightsArray) {
      indexedHeights[height] = true;
    }

    // gets {time, height, difficulty, bits} of blocks in ascending order of height
    const blocks: any = await BlocksRepository.$getBlocksDifficulty();
    const genesisBlock: IEsploraApi.Block = await bitcoinApi.$getBlock(await bitcoinApi.$getBlockHash(0));
    let currentDifficulty = genesisBlock.difficulty;
    let currentBits = genesisBlock.bits;
    let totalIndexed = 0;

    if (config.MEMPOOL.INDEXING_BLOCKS_AMOUNT === -1 && indexedHeights[0] !== true) {
      await DifficultyAdjustmentsRepository.$saveAdjustments({
        time: genesisBlock.timestamp,
        height: 0,
        difficulty: currentDifficulty,
        adjustment: 0.0,
      });
    }

    if (!blocks?.length) {
      // no blocks in database yet
      return;
    }

    const oldestConsecutiveBlock = this.getOldestConsecutiveBlock(blocks);

    currentBits = oldestConsecutiveBlock.bits;
    currentDifficulty = oldestConsecutiveBlock.difficulty;

    let totalBlockChecked = 0;
    let timer = new Date().getTime() / 1000;

    for (const block of blocks) {
      // skip until the first block after the oldest consecutive block
      if (block.height <= oldestConsecutiveBlock.height) {
        continue;
      }

      // difficulty has changed between two consecutive blocks!
      if (block.bits !== currentBits) {
        // skip if already indexed
        if (indexedHeights[block.height] !== true) {
          let adjustment = block.difficulty / currentDifficulty;
          adjustment = Math.round(adjustment * 1000000) / 1000000; // Remove float point noise

          await DifficultyAdjustmentsRepository.$saveAdjustments({
            time: block.time,
            height: block.height,
            difficulty: block.difficulty,
            adjustment: adjustment,
          });

          totalIndexed++;
        }
        // update the current difficulty
        currentDifficulty = block.difficulty;
        currentBits = block.bits;
      }

      totalBlockChecked++;
      const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
      if (elapsedSeconds > 5) {
        const progress = Math.round(totalBlockChecked / blocks.length * 100);
        logger.debug(`Indexing difficulty adjustment at block #${block.height} | Progress: ${progress}%`, logger.tags.mining);
        timer = new Date().getTime() / 1000;
      }
    }

    if (totalIndexed > 0) {
      logger.info(`Indexed ${totalIndexed} difficulty adjustments`, logger.tags.mining);
    } else {
      logger.debug(`Indexed ${totalIndexed} difficulty adjustments`, logger.tags.mining);
    }
  }

  /**
   * Create a link between blocks and the latest price at when they were mined
   */
  public async $indexBlockPrices(): Promise<void> {
    if (this.blocksPriceIndexingRunning === true) {
      return;
    }
    this.blocksPriceIndexingRunning = true;

    let totalInserted = 0;
    try {
      const prices: any[] = await PricesRepository.$getPricesTimesAndId();    
      const blocksWithoutPrices: any[] = await BlocksRepository.$getBlocksWithoutPrice();

      const blocksPrices: BlockPrice[] = [];

      for (const block of blocksWithoutPrices) {
        // Quick optimisation, out mtgox feed only goes back to 2010-07-19 02:00:00, so skip the first 68951 blocks
        if (['mainnet', 'testnet'].includes(config.MEMPOOL.NETWORK) && block.height < 68951) {
          blocksPrices.push({
            height: block.height,
            priceId: prices[0].id,
          });
          continue;
        }
        for (const price of prices) {
          if (block.timestamp < price.time) {
            blocksPrices.push({
              height: block.height,
              priceId: price.id,
            });
            break;
          };
        }

        if (blocksPrices.length >= 100000) {
          totalInserted += blocksPrices.length;
          let logStr = `Linking ${blocksPrices.length} blocks to their closest price`;
          if (blocksWithoutPrices.length > 200000) {
            logStr += ` | Progress ${Math.round(totalInserted / blocksWithoutPrices.length * 100)}%`;
          }
          logger.debug(logStr, logger.tags.mining);
          await BlocksRepository.$saveBlockPrices(blocksPrices);
          blocksPrices.length = 0;
        }
      }

      if (blocksPrices.length > 0) {
        totalInserted += blocksPrices.length;
        let logStr = `Linking ${blocksPrices.length} blocks to their closest price`;
        if (blocksWithoutPrices.length > 200000) {
          logStr += ` | Progress ${Math.round(totalInserted / blocksWithoutPrices.length * 100)}%`;
        }
        logger.debug(logStr, logger.tags.mining);
        await BlocksRepository.$saveBlockPrices(blocksPrices);
      }
    } catch (e) {
      this.blocksPriceIndexingRunning = false;
      logger.err(`Cannot index block prices. ${e}`);
    }

    if (totalInserted > 0) {
      logger.info(`Indexing blocks prices completed. Indexed ${totalInserted}`, logger.tags.mining);
    } else {
      logger.debug(`Indexing blocks prices completed. Indexed 0.`, logger.tags.mining);
    }

    this.blocksPriceIndexingRunning = false;
  }

  /**
   * Index core coinstatsindex
   */
  public async $indexCoinStatsIndex(): Promise<void> {
    let timer = new Date().getTime() / 1000;
    let totalIndexed = 0;

    const blockchainInfo = await bitcoinClient.getBlockchainInfo();
    let currentBlockHeight = blockchainInfo.blocks;

    while (currentBlockHeight > 0) {
      const indexedBlocks = await BlocksRepository.$getBlocksMissingCoinStatsIndex(
        currentBlockHeight, currentBlockHeight - 10000);
        
      for (const block of indexedBlocks) {
        const txoutset = await bitcoinClient.getTxoutSetinfo('none', block.height);
        await BlocksRepository.$updateCoinStatsIndexData(block.hash, txoutset.txouts,
          Math.round(txoutset.block_info.prevout_spent * 100000000));        
        ++totalIndexed;

        const elapsedSeconds = Math.max(1, new Date().getTime() / 1000 - timer);
        if (elapsedSeconds > 5) {
          logger.info(`Indexing coinstatsindex data for block #${block.height}. Indexed ${totalIndexed} blocks.`, logger.tags.mining);
          timer = new Date().getTime() / 1000;
        }
      }

      currentBlockHeight -= 10000;
    }

    if (totalIndexed > 0) {
      logger.info(`Indexing missing coinstatsindex data completed. Indexed ${totalIndexed}`, logger.tags.mining);
    } else {
      logger.debug(`Indexing missing coinstatsindex data completed. Indexed 0.`, logger.tags.mining);
    }
  }

  /**
   * List existing mining pools
   */
  public async $listPools(): Promise<{name: string, slug: string, unique_id: number}[] | null> {
    const [rows] = await database.query(`
      SELECT
        name,
        slug,
        unique_id
      FROM pools`
    );
    return rows as {name: string, slug: string, unique_id: number}[];
  }

  private getDateMidnight(date: Date): Date {
    date.setUTCHours(0);
    date.setUTCMinutes(0);
    date.setUTCSeconds(0);
    date.setUTCMilliseconds(0);

    return date;
  }

  private getTimeRange(interval: string | null, scale = 1): number {
    switch (interval) {
      case '4y': return 43200 * scale; // 12h
      case '3y': return 43200 * scale; // 12h
      case '2y': return 28800 * scale; // 8h
      case '1y': return 28800 * scale; // 8h
      case '6m': return 10800 * scale; // 3h
      case '3m': return 7200 * scale; // 2h
      case '1m': return 1800 * scale; // 30min
      case '1w': return 300 * scale; // 5min
      case '3d': return 1 * scale;
      case '24h': return 1 * scale;
      default: return 86400 * scale;
    }
  }

  private getTimeRangeFromTimespan(from: number, to: number, scale = 1): number {
    const timespan = to - from;
    switch (true) {
      case timespan > 3600 * 24 * 365 * 4: return 86400 * scale; // 24h
      case timespan > 3600 * 24 * 365 * 3: return 43200 * scale; // 12h
      case timespan > 3600 * 24 * 365 * 2: return 43200 * scale; // 12h
      case timespan > 3600 * 24 * 365: return 28800 * scale; // 8h
      case timespan > 3600 * 24 * 30 * 6: return 28800 * scale; // 8h
      case timespan > 3600 * 24 * 30 * 3: return 10800 * scale; // 3h
      case timespan > 3600 * 24 * 30: return 7200 * scale; // 2h
      case timespan > 3600 * 24 * 7: return 1800 * scale; // 30min
      case timespan > 3600 * 24 * 3: return 300 * scale; // 5min
      case timespan > 3600 * 24: return 1 * scale;
      default: return 1 * scale;
    }
  }
  

  // Finds the oldest block in a consecutive chain back from the tip
  // assumes `blocks` is sorted in ascending height order
  private getOldestConsecutiveBlock(blocks: DifficultyBlock[]): DifficultyBlock {
    for (let i = blocks.length - 1; i > 0; i--) {
      if ((blocks[i].height - blocks[i - 1].height) > 1) {
        return blocks[i];
      }
    }
    return blocks[0];
  }
}

export default new Mining();
