import { PoolInfo, PoolStats } from '../mempool.interfaces';
import BlocksRepository, { EmptyBlocks } from '../repositories/BlocksRepository';
import PoolsRepository from '../repositories/PoolsRepository';
import bitcoinClient from './bitcoin/bitcoin-client';
import { Common } from './common';

class Mining {
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
    const lastBlockHashrate = await bitcoinClient.getNetworkHashPs(120, blockHeightTip);
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
}

export default new Mining();
