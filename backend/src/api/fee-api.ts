const config = require('../../mempool-config.json');
import projectedBlocks from './mempool-blocks';

class FeeApi {
  constructor() { }

  defaultFee = config.LIQUID ? 0.1 : 1;

  public getRecommendedFee() {
    const pBlocks = projectedBlocks.getMempoolBlocks();
    if (!pBlocks.length) {
      return {
        'fastestFee': 0,
        'halfHourFee': 0,
        'hourFee': 0,
      };
    }
    let firstMedianFee = Math.ceil(pBlocks[0].medianFee);

    if (pBlocks.length === 1 && pBlocks[0].blockVSize <= 500000) {
      firstMedianFee = this.defaultFee;
    }

    const secondMedianFee = pBlocks[1] ? Math.ceil(pBlocks[1].medianFee) : this.defaultFee;
    const thirdMedianFee = pBlocks[2] ? Math.ceil(pBlocks[2].medianFee) : this.defaultFee;

    return {
      'fastestFee': firstMedianFee,
      'halfHourFee': secondMedianFee,
      'hourFee': thirdMedianFee,
    };
  }
}

export default new FeeApi();
