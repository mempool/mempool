import DB from '../database';
import logger from '../logger';
import { IConversionRates } from '../mempool.interfaces';
import priceUpdater from '../tasks/price-updater';

export interface ApiPrice {
  time?: number,
  USD: number,
  EUR: number,
  GBP: number,
  CAD: number,
  CHF: number,
  AUD: number,
  JPY: number,
}

export interface ExchangeRates {
  USDEUR: number,
  USDGBP: number,
  USDCAD: number,
  USDCHF: number,
  USDAUD: number,
  USDJPY: number,
}

export interface Conversion {
  prices: ApiPrice[],
  exchangeRates: ExchangeRates;
}

export const MAX_PRICES = {
  USD: 100000000,
  EUR: 100000000,
  GBP: 100000000,
  CAD: 100000000,
  CHF: 100000000,
  AUD: 100000000,
  JPY: 10000000000,
};

class PricesRepository {
  public async $savePrices(time: number, prices: IConversionRates): Promise<void> {
    if (prices.USD === 0) {
      // Some historical price entries have no USD prices, so we just ignore them to avoid future UX issues
      // since we use USD as default/fallback when we don't have a price for another currency
      return;
    }

    // Sanity check
    for (const currency of Object.keys(prices)) {
      if (prices[currency] < 0 || prices[currency] > MAX_PRICES[currency]) {
        logger.info(`Ignore BTC${currency} price of ${prices[currency]}`);
        prices[currency] = 0;
      }
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
    const [oldestRow] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices WHERE USD != 0 ORDER BY time LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getLatestPriceId(): Promise<number | null> {
    const [oldestRow] = await DB.query(`SELECT id from prices WHERE USD != 0 ORDER BY time DESC LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].id : null;
  }

  public async $getLatestPriceTime(): Promise<number> {
    const [oldestRow] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices WHERE USD != 0 ORDER BY time DESC LIMIT 1`);
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getPricesTimes(): Promise<number[]> {
    const [times]: any[] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time from prices WHERE USD != 0 ORDER BY time`);
    return times.map(time => time.time);
  }

  public async $getPricesTimesAndId(): Promise<number[]> {
    const [times]: any[] = await DB.query(`SELECT UNIX_TIMESTAMP(time) as time, id, USD from prices ORDER BY time`);
    return times;
  }

  public async $getLatestConversionRates(): Promise<any> {
    const [rates]: any[] = await DB.query(`
      SELECT USD, EUR, GBP, CAD, CHF, AUD, JPY
      FROM prices
      ORDER BY time DESC
      LIMIT 1`
    );
    if (!rates || rates.length === 0) {
      return priceUpdater.getEmptyPricesObj();
    }
    return rates[0];
  }

  public async $getHistoricalPrice(): Promise<Conversion | null> {
    try {
      const [rates]: any[] = await DB.query(`SELECT *, UNIX_TIMESTAMP(time) as time FROM prices ORDER BY time DESC`);
      if (!rates) {
        throw Error(`Cannot get average historical price from the database`);
      }

      // Compute fiat exchange rates
      const latestPrice: ApiPrice = rates[0];
      const exchangeRates: ExchangeRates = {
        USDEUR: Math.round(latestPrice.EUR / latestPrice.USD * 100) / 100,
        USDGBP: Math.round(latestPrice.GBP / latestPrice.USD * 100) / 100,
        USDCAD: Math.round(latestPrice.CAD / latestPrice.USD * 100) / 100,
        USDCHF: Math.round(latestPrice.CHF / latestPrice.USD * 100) / 100,
        USDAUD: Math.round(latestPrice.AUD / latestPrice.USD * 100) / 100,
        USDJPY: Math.round(latestPrice.JPY / latestPrice.USD * 100) / 100,
      };

      return {
        prices: rates,
        exchangeRates: exchangeRates
      };
    } catch (e) {
      logger.err(`Cannot fetch averaged historical prices from the db. Reason ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}

export default new PricesRepository();

