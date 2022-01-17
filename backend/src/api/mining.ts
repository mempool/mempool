import { PoolInfo, PoolStats } from "../mempool.interfaces";
import BlocksRepository, { EmptyBlocks } from "../repositories/BlocksRepository";
import PoolsRepository from "../repositories/PoolsRepository";
import bitcoinClient from "./bitcoin/bitcoin-client";
import BitcoinApi from "./bitcoin/bitcoin-api";

class Mining {
  private bitcoinApi: BitcoinApi;

  constructor() {
    this.bitcoinApi = new BitcoinApi(bitcoinClient);
  }

  /**
   * Generate high level overview of the pool ranks and general stats
   */
  public async $getPoolsStats(interval: string = "100 YEAR") : Promise<object> {
    let poolsStatistics = {};

    const blockHeightTip = await this.bitcoinApi.$getBlockHeightTip();
    const lastBlockHashrate = await this.bitcoinApi.$getEstimatedHashrate(blockHeightTip);
    const poolsInfo: PoolInfo[] = await PoolsRepository.$getPoolsInfo(interval);
    const blockCount: number = await BlocksRepository.$blockCount(interval);
    const emptyBlocks: EmptyBlocks[] = await BlocksRepository.$countEmptyBlocks(interval);

    let poolsStats: PoolStats[] = [];
    let rank = 1;

    poolsInfo.forEach((poolInfo: PoolInfo) => {
      let poolStat: PoolStats = {
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
    })

    poolsStatistics["blockCount"] = blockCount;
    poolsStatistics["lastEstimatedHashrate"] = lastBlockHashrate;
    poolsStatistics["pools"] = poolsStats;

    return poolsStatistics;
  }
}

export default new Mining();