import DB from '../database';
import logger from '../logger';
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
const ApiPriceFields = `
  UNIX_TIMESTAMP(time) as time,
  USD,
  EUR,
  GBP,
  CAD,
  CHF,
  AUD,
  JPY
`;

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
  public async $savePrices(time: number, prices: ApiPrice): Promise<void> {
    if (prices.USD === -1) {
      // Some historical price entries have no USD prices, so we just ignore them to avoid future UX issues
      // As of today there are only 4 (on 2013-09-05, 2013-0909, 2013-09-12 and 2013-09-26) so that's fine
      return;
    }

    // Sanity check
    for (const currency of Object.keys(prices)) {
      if (prices[currency] < -1 || prices[currency] > MAX_PRICES[currency]) { // We use -1 to mark a "missing data, so it's a valid entry"
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
    } catch (e) {
      logger.err(`Cannot save exchange rate into db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getOldestPriceTime(): Promise<number> {
    const [oldestRow] = await DB.query(`
      SELECT UNIX_TIMESTAMP(time) AS time
      FROM prices
      ORDER BY time
      LIMIT 1
    `);
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getLatestPriceId(): Promise<number | null> {
    const [oldestRow] = await DB.query(`
      SELECT id
      FROM prices
      ORDER BY time DESC
      LIMIT 1`
    );
    return oldestRow[0] ? oldestRow[0].id : null;
  }

  public async $getLatestPriceTime(): Promise<number> {
    const [oldestRow] = await DB.query(`
      SELECT UNIX_TIMESTAMP(time) AS time
      FROM prices
      ORDER BY time DESC
      LIMIT 1`
    );
    return oldestRow[0] ? oldestRow[0].time : 0;
  }

  public async $getPricesTimes(): Promise<number[]> {
    const [times] = await DB.query(`
      SELECT UNIX_TIMESTAMP(time) AS time
      FROM prices
      WHERE USD != -1
      ORDER BY time
    `);
    if (!Array.isArray(times)) {
      return [];
    }
    return times.map(time => time.time);
  }

  public async $getPricesTimesAndId(): Promise<{time: number, id: number, USD: number}[]> {
    const [times] = await DB.query(`
      SELECT
        UNIX_TIMESTAMP(time) AS time,
        id,
        USD
      FROM prices
      ORDER BY time
    `);
    return times as {time: number, id: number, USD: number}[];
  }

  public async $getLatestConversionRates(): Promise<ApiPrice> {
    const [rates] = await DB.query(`
      SELECT ${ApiPriceFields}
      FROM prices
      ORDER BY time DESC
      LIMIT 1`
    );

    if (!Array.isArray(rates) || rates.length === 0) {
      return priceUpdater.getEmptyPricesObj();
    }
    return rates[0] as ApiPrice;
  }

  public async $getNearestHistoricalPrice(timestamp: number | undefined): Promise<Conversion | null> {
    try {
      const [rates] = await DB.query(`
        SELECT ${ApiPriceFields}
        FROM prices
        WHERE UNIX_TIMESTAMP(time) < ?
        ORDER BY time DESC
        LIMIT 1`,
        [timestamp]
      );
      if (!Array.isArray(rates)) {
        throw Error(`Cannot get single historical price from the database`);
      }

      // Compute fiat exchange rates
      let latestPrice = rates[0] as ApiPrice;
      if (!latestPrice || latestPrice.USD === -1) {
        latestPrice = priceUpdater.getEmptyPricesObj();
      }

      const computeFx = (usd: number, other: number): number =>
        Math.round(Math.max(other, 0) / Math.max(usd, 1) * 100) / 100;
      
      const exchangeRates: ExchangeRates = {
        USDEUR: computeFx(latestPrice.USD, latestPrice.EUR),
        USDGBP: computeFx(latestPrice.USD, latestPrice.GBP),
        USDCAD: computeFx(latestPrice.USD, latestPrice.CAD),
        USDCHF: computeFx(latestPrice.USD, latestPrice.CHF),
        USDAUD: computeFx(latestPrice.USD, latestPrice.AUD),
        USDJPY: computeFx(latestPrice.USD, latestPrice.JPY),
      };

      return {
        prices: rates as ApiPrice[],
        exchangeRates: exchangeRates
      };
    } catch (e) {
      logger.err(`Cannot fetch single historical prices from the db. Reason ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }

  public async $getHistoricalPrices(): Promise<Conversion | null> {
    try {
      const [rates] = await DB.query(`
        SELECT ${ApiPriceFields}
        FROM prices
        ORDER BY time DESC
      `);
      if (!Array.isArray(rates)) {
        throw Error(`Cannot get average historical price from the database`);
      }

      // Compute fiat exchange rates
      let latestPrice = rates[0] as ApiPrice;
      if (latestPrice.USD === -1) {
        latestPrice = priceUpdater.getEmptyPricesObj();
      }

      const computeFx = (usd: number, other: number): number =>
        Math.round(Math.max(other, 0) / Math.max(usd, 1) * 100) / 100;
      
      const exchangeRates: ExchangeRates = {
        USDEUR: computeFx(latestPrice.USD, latestPrice.EUR),
        USDGBP: computeFx(latestPrice.USD, latestPrice.GBP),
        USDCAD: computeFx(latestPrice.USD, latestPrice.CAD),
        USDCHF: computeFx(latestPrice.USD, latestPrice.CHF),
        USDAUD: computeFx(latestPrice.USD, latestPrice.AUD),
        USDJPY: computeFx(latestPrice.USD, latestPrice.JPY),
      };

      return {
        prices: rates as ApiPrice[],
        exchangeRates: exchangeRates
      };
    } catch (e) {
      logger.err(`Cannot fetch historical prices from the db. Reason ${e instanceof Error ? e.message : e}`);
      return null;
    }
  }
}

export default new PricesRepository();

