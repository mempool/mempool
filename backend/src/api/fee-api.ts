import { MempoolBlock } from '../mempool.interfaces';
import { Common } from './common';
import mempool from './mempool';
import projectedBlocks from './mempool-blocks';

class FeeApi {
  constructor() { }

  defaultFee = Common.isLiquid() ? 0.1 : 1;

  public getRecommendedFee() {
    const pBlocks = projectedBlocks.getMempoolBlocks();
    const mPool = mempool.getMempoolInfo();
    const minimumFee = Math.ceil(mPool.mempoolminfee * 100000);

    if (!pBlocks.length) {
      return {
        'fastestFee': this.defaultFee,
        'halfHourFee': this.defaultFee,
        'hourFee': this.defaultFee,
        'economyFee': minimumFee,
        'minimumFee': minimumFee,
      };
    }

    const firstMedianFee = this.optimizeMedianFee(pBlocks[0], pBlocks[1]);
    const secondMedianFee = pBlocks[1] ? this.optimizeMedianFee(pBlocks[1], pBlocks[2], firstMedianFee) : this.defaultFee;
    const thirdMedianFee = pBlocks[2] ? this.optimizeMedianFee(pBlocks[2], pBlocks[3], secondMedianFee) : this.defaultFee;

    return {
      'fastestFee': firstMedianFee,
      'halfHourFee': secondMedianFee,
      'hourFee': thirdMedianFee,
      'economyFee': Math.min(2 * minimumFee, thirdMedianFee),
      'minimumFee': minimumFee,
    };
  }

  private optimizeMedianFee(pBlock: MempoolBlock, nextBlock: MempoolBlock | undefined, previousFee?: number): number {
    const useFee = previousFee ? (pBlock.medianFee + previousFee) / 2 : pBlock.medianFee;
    if (pBlock.blockVSize <= 500000) {
      return this.defaultFee;
    }
    if (pBlock.blockVSize <= 950000 && !nextBlock) {
      const multiplier = (pBlock.blockVSize - 500000) / 500000;
      return Math.max(Math.round(useFee * multiplier), this.defaultFee);
    }
    return Math.ceil(useFee);
  }
}

export default new FeeApi();
