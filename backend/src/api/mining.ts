import { PoolInfo, PoolStats } from '../mempool.interfaces';
import BlocksRepository, { EmptyBlocks } from '../repositories/BlocksRepository';
import PoolsRepository from '../repositories/PoolsRepository';
import HashratesRepository from '../repositories/HashratesRepository';
import bitcoinClient from './bitcoin/bitcoin-client';
import logger from '../logger';

class Mining {
  hashrateIndexingStarted = false;

  constructor() {
  }

  /**
   * Generate high level overview of the pool ranks and general stats
   */
  public async $getPoolsStats(interval: string | null) : Promise<object> {
    const poolsStatistics = {};

    const poolsInfo: PoolInfo[] = await PoolsRepository.$getPoolsInfo(interval);
    const emptyBlocks: EmptyBlocks[] = await BlocksRepository.$getEmptyBlocks(null, interval);

    const poolsStats: PoolStats[] = [];
    let rank = 1;

    poolsInfo.forEach((poolInfo: PoolInfo) => {
      const poolStat: PoolStats = {
        poolId: poolInfo.poolId, // mysql row id
        name: poolInfo.name,
        link: poolInfo.link,
        blockCount: poolInfo.blockCount,
        rank: rank++,
        emptyBlocks: 0, 
      }
      for (let i = 0; i < emptyBlocks.length; ++i) {
        if (emptyBlocks[i].poolId === poolInfo.poolId) {
          poolStat.emptyBlocks++;
        }
      }
      poolsStats.push(poolStat);
    });

    poolsStatistics['pools'] = poolsStats;

    const oldestBlock = new Date(await BlocksRepository.$oldestBlockTimestamp());
    poolsStatistics['oldestIndexedBlockTimestamp'] = oldestBlock.getTime();

    const blockCount: number = await BlocksRepository.$blockCount(null, interval);
    poolsStatistics['blockCount'] = blockCount;

    const blockHeightTip = await bitcoinClient.getBlockCount();
    const lastBlockHashrate = await bitcoinClient.getNetworkHashPs(144, blockHeightTip);
    poolsStatistics['lastEstimatedHashrate'] = lastBlockHashrate;

    return poolsStatistics;
  }

  /**
   * Get all mining pool stats for a pool
   */
  public async $getPoolStat(interval: string | null, poolId: number): Promise<object> {
    const pool = await PoolsRepository.$getPool(poolId);
    if (!pool) {
      throw new Error(`This mining pool does not exist`);
    }

    const blockCount: number = await BlocksRepository.$blockCount(poolId, interval);
    const emptyBlocks: EmptyBlocks[] = await BlocksRepository.$getEmptyBlocks(poolId, interval);

    return {
      pool: pool,
      blockCount: blockCount,
      emptyBlocks: emptyBlocks,
    };
  }

  /**
   * Return the historical difficulty adjustments and oldest indexed block timestamp
   */
  public async $getHistoricalDifficulty(interval: string | null): Promise<object> {
    const difficultyAdjustments = await BlocksRepository.$getBlocksDifficulty(interval);
    const oldestBlock = new Date(await BlocksRepository.$oldestBlockTimestamp());

    return {
      adjustments: difficultyAdjustments,
      oldestIndexedBlockTimestamp: oldestBlock.getTime(),
    }
  }

  /**
   * Return the historical hashrates and oldest indexed block timestamp
   */
   public async $getHistoricalHashrates(interval: string | null): Promise<object> {
    const hashrates = await HashratesRepository.$get(interval);
    const oldestBlock = new Date(await BlocksRepository.$oldestBlockTimestamp());

    return {
      hashrates: hashrates,
      oldestIndexedBlockTimestamp: oldestBlock.getTime(),
    }
  }

  /**
   * 
   */
  public async $generateNetworkHashrateHistory() : Promise<void> {
    if (this.hashrateIndexingStarted) {
      return;
    }
    this.hashrateIndexingStarted = true;

    const totalIndexed = await BlocksRepository.$blockCount(null, null);
    const indexedTimestamp = (await HashratesRepository.$get(null)).map(hashrate => hashrate.timestamp);

    const genesisTimestamp = 1231006505; // bitcoin-cli getblock 000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f
    const lastMidnight = new Date();
    lastMidnight.setUTCHours(0); lastMidnight.setUTCMinutes(0); lastMidnight.setUTCSeconds(0); lastMidnight.setUTCMilliseconds(0);
    let toTimestamp = Math.round(lastMidnight.getTime() / 1000);

    while (toTimestamp > genesisTimestamp) {
      const fromTimestamp = toTimestamp - 86400;
      if (indexedTimestamp.includes(fromTimestamp)) {
        toTimestamp -= 86400;
        continue;
      }

      const blockStats: any = await BlocksRepository.$blockCountBetweenTimestamp(
        null, fromTimestamp, toTimestamp
      );

      let lastBlockHashrate = 0;
      if (blockStats.blockCount > 0) {
        lastBlockHashrate = await bitcoinClient.getNetworkHashPs(blockStats.blockCount,
          blockStats.lastBlockHeight);
      }

      if (toTimestamp % 864000 === 0) {
        const progress = Math.round((totalIndexed - blockStats.lastBlockHeight) / totalIndexed * 100);
        const formattedDate = new Date(fromTimestamp * 1000).toUTCString();
        logger.debug(`Counting blocks and hashrate for ${formattedDate}. Progress: ${progress}%`);
      }

      await HashratesRepository.$saveDailyStat({
        hashrateTimestamp: fromTimestamp,
        avgHashrate: lastBlockHashrate,
        poolId: null,
      });

      toTimestamp -= 86400;
    }

    logger.info(`Hashrates indexing completed`);
  }

}

export default new Mining();
