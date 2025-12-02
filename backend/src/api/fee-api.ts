import { MempoolBlock } from '../mempool.interfaces';
import { IBitcoinApi } from './bitcoin/bitcoin-api.interface';
import config from '../config';
import mempool from './mempool';
import projectedBlocks from './mempool-blocks';

const isLiquid = config.MEMPOOL.NETWORK === 'liquid' || config.MEMPOOL.NETWORK === 'liquidtestnet';

interface RecommendedFees {
  fastestFee: number,
  halfHourFee: number,
  hourFee: number,
  economyFee: number,
  minimumFee: number,
}

class FeeApi {
  constructor() { }

  minimumIncrement = isLiquid ? 0.1 : 1;
  minFastestFee = isLiquid ? 0.1 : 1;
  minHalfHourFee = isLiquid ? 0.1 : 0.5;
  priorityFactor = isLiquid ? 0 : 0.5;

  public getRecommendedFee(): RecommendedFees {
    const pBlocks = projectedBlocks.getMempoolBlocks();
    const mPool = mempool.getMempoolInfo();

    return this.calculateRecommendedFee(pBlocks, mPool);
  }

  public getPreciseRecommendedFee(): RecommendedFees {
    const pBlocks = projectedBlocks.getMempoolBlocks();
    const mPool = mempool.getMempoolInfo();

    // minimum non-zero minrelaytxfee / incrementalrelayfee is 1 sat/kvB = 0.001 sat/vB
    return this.calculateRecommendedFee(pBlocks, mPool, 0.001);
  }

  public calculateRecommendedFee(pBlocks: MempoolBlock[], mPool: IBitcoinApi.MempoolInfo, minIncrement: number = this.minimumIncrement): RecommendedFees {
    const purgeRate = this.roundUpToNearest(mPool.mempoolminfee * 100000, minIncrement);
    const minimumFee = Math.max(purgeRate, minIncrement);

    if (!pBlocks.length) {
      return {
        'fastestFee': minimumFee,
        'halfHourFee': minimumFee,
        'hourFee': minimumFee,
        'economyFee': minimumFee,
        'minimumFee': minimumFee,
      };
    }

    const firstMedianFee = this.optimizeMedianFee(pBlocks[0], pBlocks[1], undefined, minimumFee, minIncrement);
    const secondMedianFee = pBlocks[1] ? this.optimizeMedianFee(pBlocks[1], pBlocks[2], firstMedianFee, minimumFee, minIncrement) : minimumFee;
    const thirdMedianFee = pBlocks[2] ? this.optimizeMedianFee(pBlocks[2], pBlocks[3], secondMedianFee, minimumFee, minIncrement) : minimumFee;

    // explicitly enforce a minimum of ceil(mempoolminfee) on all recommendations.
    // simply rounding up recommended rates is insufficient, as the purging rate
    // can exceed the median rate of projected blocks in some extreme scenarios
    // (see https://bitcoin.stackexchange.com/a/120024)
    let fastestFee = Math.max(minimumFee, firstMedianFee);
    let halfHourFee = Math.max(minimumFee, secondMedianFee);
    let hourFee = Math.max(minimumFee, thirdMedianFee);
    const economyFee = Math.max(minimumFee, Math.min(2 * minimumFee, thirdMedianFee));

    // ensure recommendations always increase w/ priority
    fastestFee = Math.max(fastestFee, halfHourFee, hourFee, economyFee);
    halfHourFee = Math.max(halfHourFee, hourFee, economyFee);
    hourFee = Math.max(hourFee, economyFee);

    return {
      'fastestFee': Math.max(this.roundToNearest(fastestFee + this.priorityFactor, minIncrement), this.minFastestFee),
      'halfHourFee': Math.max(this.roundToNearest(halfHourFee + (this.priorityFactor / 2), minIncrement), this.minHalfHourFee),
      'hourFee': this.roundToNearest(hourFee, minIncrement),
      'economyFee': this.roundToNearest(economyFee, minIncrement),
      'minimumFee': this.roundToNearest(minimumFee, minIncrement),
    };
  }

  private optimizeMedianFee(pBlock: MempoolBlock, nextBlock: MempoolBlock | undefined, previousFee: number | undefined, minFee: number, minIncrement: number = this.minimumIncrement): number {
    const useFee = previousFee ? (pBlock.medianFee + previousFee) / 2 : pBlock.medianFee;
    if (pBlock.blockVSize <= 500000 || pBlock.medianFee < minFee) {
      return minFee;
    }
    if (pBlock.blockVSize <= 950000 && !nextBlock) {
      const multiplier = (pBlock.blockVSize - 500000) / 500000;
      return Math.max(this.roundToNearest(useFee * multiplier, minIncrement), minFee);
    }
    return Math.max(this.roundUpToNearest(useFee, minIncrement), minFee);
  }

  private roundUpToNearest(value: number, nearest: number): number {
    if (nearest !== 0) {
      return Math.ceil(value / nearest) * nearest;
    }
    return value;
  }

  private roundToNearest(value: number, nearest: number): number {
    if (nearest !== 0) {
      return Math.round(value / nearest) * nearest;
    }
    return value;
  }
}

export default new FeeApi();
