import DB from '../database';
import logger from '../logger';
import { Prices } from '../tasks/price-updater';

class PricesRepository {
  public async $savePrices(time: number, prices: Prices): Promise<void> {
    try {
      await DB.query(`
        INSERT INTO prices(time,             USD, EUR, GBP, CAD, CHF, AUD, JPY)
        VALUE             (FROM_UNIXTIME(?), ?,   ?,   ?,   ?,   ?,   ?,   ?  )`,
        [time, prices.USD, prices.EUR, prices.GBP, prices.CAD, prices.CHF, prices.AUD, prices.JPY]
      );
    } catch (e: any) {
      logger.err(`Cannot save exchange rate into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getOldestPriceTime(): Promise<number> {
    const [oldestRow] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices ORDER BY time LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getLatestPriceTime(): Promise<number> {
    const [oldestRow] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices ORDER BY time DESC LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getPricesTimes(): Promise<number[]> {
    const [times]: any[] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices`);
    return times.map(time => time.time);
  }
}

export default new PricesRepository();

