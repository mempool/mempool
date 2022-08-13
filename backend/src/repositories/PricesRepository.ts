import DB from '../database';
import logger from '../logger';
import { Prices } from '../tasks/price-updater';

class PricesRepository {
  public async $savePrices(time: number, prices: Prices): Promise<void> {
    if (prices.USD === -1) {
      // Some historical price entries have not USD prices, so we just ignore them to avoid future UX issues
      // As of today there are only 4 (on 2013-09-05, 2013-09-19, 2013-09-12 and 2013-09-26) so that's fine
      return;
    }

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
    const [oldestRow] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices WHERE USD != -1 ORDER BY time LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getLatestPriceId(): Promise<number | null> {
    const [oldestRow] = await DB.query(`SELECT id from prices WHERE USD != -1 ORDER BY time DESC LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].id : null;
  }

  public async $getLatestPriceTime(): Promise<number> {
    const [oldestRow] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices WHERE USD != -1 ORDER BY time DESC LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getPricesTimes(): Promise<number[]> {
    const [times]: any[] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices WHERE USD != -1 ORDER BY time`);
    return times.map(time => time.time);
  }

  public async $getPricesTimesAndId(): Promise<number[]> {
    const [times]: any[] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time, id, USD from prices ORDER BY time`);
    return times;
  }
}

export default new PricesRepository();

