import projectedBlocks from './mempool-blocks';

class FeeApi {
  constructor() { }

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
      firstMedianFee = 1;
    }

    const secondMedianFee = pBlocks[1] ? Math.ceil(pBlocks[1].medianFee) : firstMedianFee;
    const thirdMedianFee = pBlocks[2] ? Math.ceil(pBlocks[2].medianFee) : secondMedianFee;

    return {
      'fastestFee': firstMedianFee,
      'halfHourFee': secondMedianFee,
      'hourFee': thirdMedianFee,
    };
  }
}

export default new FeeApi();
