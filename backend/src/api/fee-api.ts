import projectedBlocks from './projected-blocks';
import { DB } from '../database';

class FeeApi {
  constructor() { }

  public getRecommendedFee() {
    const pBlocks = projectedBlocks.getProjectedBlocks();
    if (!pBlocks.length) {
      return {
        'fastestFee': 0,
        'halfHourFee': 0,
        'hourFee': 0,
      };
    }
    let firstMedianFee = Math.ceil(pBlocks[0].medianFee);

    if (pBlocks.length === 1 && pBlocks[0].blockWeight <= 2000000) {
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

  public async $getTransactionsForBlock(blockHeight: number): Promise<any[]> {
    try {
      const connection = await DB.pool.getConnection();
      const query = `SELECT feePerVsize AS fpv FROM transactions WHERE blockheight = ? ORDER BY feePerVsize ASC`;
      const [rows] = await connection.query<any>(query, [blockHeight]);
      connection.release();
      return rows;
    } catch (e) {
      console.log('$getTransactionsForBlock() error', e);
      return [];
    }
  }

}

export default new FeeApi();
