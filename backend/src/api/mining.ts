import { PoolInfo, PoolStats } from '../mempool.interfaces';
import BlocksRepository, { EmptyBlocks } from '../repositories/BlocksRepository';
import PoolsRepository from '../repositories/PoolsRepository';
import bitcoinClient from './bitcoin/bitcoin-client';

class Mining {
  constructor() {
  }

  /**
   * Generate high level overview of the pool ranks and general stats
   */
  public async $getPoolsStats(interval: string | null) : Promise<object> {
    let sqlInterval: string | null = null;
    switch (interval) {
      case '24h': sqlInterval = '1 DAY'; break;
      case '3d': sqlInterval = '3 DAY'; break;
      case '1w': sqlInterval = '1 WEEK'; break;
      case '1m': sqlInterval = '1 MONTH'; break;
      case '3m': sqlInterval = '3 MONTH'; break;
      case '6m': sqlInterval = '6 MONTH'; break;
      case '1y': sqlInterval = '1 YEAR'; break;
      case '2y': sqlInterval = '2 YEAR'; break;
      case '3y': sqlInterval = '3 YEAR'; break;
      default: sqlInterval = null; break;
    }

    const poolsStatistics = {};

    const poolsInfo: PoolInfo[] = await PoolsRepository.$getPoolsInfo(sqlInterval);
    const emptyBlocks: EmptyBlocks[] = await BlocksRepository.$countEmptyBlocks(sqlInterval);

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

    const blockCount: number = await BlocksRepository.$blockCount(sqlInterval);
    poolsStatistics['blockCount'] = blockCount;

    const blockHeightTip = await bitcoinClient.getBlockCount();
    const lastBlockHashrate = await bitcoinClient.getNetworkHashPs(120, blockHeightTip);
    poolsStatistics['lastEstimatedHashrate'] = lastBlockHashrate;

    return poolsStatistics;
  }
}

export default new Mining();
