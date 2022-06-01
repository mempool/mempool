import DB from '../database';
import logger from '../logger';
import { IConversionRates } from '../mempool.interfaces';

class RatesRepository {
  public async $saveRate(height: number, rates: IConversionRates) {
    try {
      await DB.query(`INSERT INTO rates(height, bisq_rates) VALUE (?, ?)`, [height, JSON.stringify(rates)]);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Rate already exists for block ${height}, ignoring`);
      } else {
        logger.err(`Cannot save exchange rate into db for block ${height} Reason: ` + (e instanceof Error ? e.message : e));
        throw e;
      }
    }
  }
}

export default new RatesRepository();

