import logger from '../../logger';
import PricesRepository from '../../repositories/PricesRepository';
import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

// Prices are stored in FLOAT columns, which MySQL returns rounded to six significant
// digits, so a stored price can differ from the exchange's value by up to 5 parts per million
function isSamePrice(stored: number, exchange: number): boolean {
  return Math.abs(stored - exchange) <= Math.abs(exchange) * 1e-5;
}

// Earlier versions stored the week's closing price at the start of the week. A stored value
// came from there if it is the closing price, or if no row an hour or a day either side of it
// exists (so neither the hourly updater nor the daily backfill wrote it) and it is nearer the
// closing price than the opening price
function holdsWeekClose(value: number, open: number, close: number, hasNeighbours: boolean): boolean {
  if (value <= 0 || isSamePrice(value, open)) {
    return false;
  }
  return isSamePrice(value, close) || (!hasNeighbours && Math.abs(value - close) < Math.abs(value - open));
}

class KrakenApi implements PriceFeed {
  public name: string = 'Kraken';
  public currencies: string[] = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY'];

  public url: string = 'https://api.kraken.com/0/public/Ticker?pair=XBT';
  public urlHist: string = 'https://api.kraken.com/0/public/OHLC?interval={GRANULARITY}&pair=XBT';

  constructor() {
  }

  private getTicker(currency) {
    let ticker = `XXBTZ${currency}`;
    if (['CHF', 'AUD'].includes(currency)) {
      ticker = `XBT${currency}`;
    }
    return ticker;
  }

  /** @asyncUnsafe */
  public async $fetchPrice(currency): Promise<number> {
    const response = await query(this.url + currency);
    const ticker = this.getTicker(currency);
    if (response && response['result'] && response['result'][ticker] &&
      response['result'][ticker]['c'] && response['result'][ticker]['c'].length > 0
    ) {
      return parseInt(response['result'][ticker]['c'][0], 10);
    } else {
      return -1;
    }
  }

  /** @asyncUnsafe */
  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};

    for (const currency of currencies) {
      if (this.currencies.includes(currency) === false) {
        continue;
      }

      const response = await query(this.urlHist.replace('{GRANULARITY}', '60') + currency);
      const pricesRaw = response ? response['result'][this.getTicker(currency)] : [];

      for (const price of pricesRaw) {
        if (priceHistory[price[0]] === undefined) {
          priceHistory[price[0]] = priceUpdater.getEmptyPricesObj();
        }
        // Candles are [time, open, high, low, close, vwap, volume, count]. The open is the price at `time`
        priceHistory[price[0]][currency] = price[1];
      }
    }

    return priceHistory;
  }

  /**
   * Fetch weekly price and save it into the database
   * @asyncUnsafe
   */
  public async $insertHistoricalPrice(): Promise<void> {
    const storedPrices = await PricesRepository.$getMainCurrencyPrices();

    // EUR weekly price history goes back to timestamp 1378339200 (September 5, 2013)
    // USD weekly price history goes back to timestamp 1380758400 (October 3, 2013)
    // GBP weekly price history goes back to timestamp 1415232000 (November 6, 2014)
    // JPY weekly price history goes back to timestamp 1415232000 (November 6, 2014)
    // CAD weekly price history goes back to timestamp 1436400000 (July 9, 2015)
    // CHF weekly price history goes back to timestamp 1575504000 (December 5, 2019)
    // AUD weekly price history goes back to timestamp 1591833600 (June 11, 2020)

    const priceHistory: any = {}; // map: timestamp -> Prices
    const corrections: { [time: number]: { [currency: string]: number } } = {};
    const candleCurrencies: { [time: number]: Set<string> } = {};
    let fetchFailed = false;

    for (const currency of this.currencies) {
      const response = await query(this.urlHist.replace('{GRANULARITY}', '10080') + currency);
      const priceHistoryRaw = response?.['result']?.[this.getTicker(currency)];
      if (!Array.isArray(priceHistoryRaw)) {
        fetchFailed = true;
        continue;
      }

      for (const [index, price] of priceHistoryRaw.entries()) {
        // price[0] = start of the week, price[1] = opening price, price[4] = closing price.
        // The row is stored at the start of the week, so it takes the opening price
        const time = parseInt(price[0], 10);
        const open = parseFloat(price[1]);
        const close = parseFloat(price[4]);
        candleCurrencies[time] = candleCurrencies[time] || new Set();
        candleCurrencies[time].add(currency);

        const stored = storedPrices.get(time);
        if (stored) {
          // The last candle is the current week, whose closing price is still changing
          const isCurrentWeek = index === priceHistoryRaw.length - 1;
          const hasNeighbours = [-86400, -3600, 3600, 86400].some(offset => storedPrices.has(time + offset));
          if (!isCurrentWeek && holdsWeekClose(stored[currency], open, close, hasNeighbours)) {
            corrections[time] = corrections[time] || {};
            corrections[time][currency] = open;
          }
          continue;
        }

        if (priceHistory[price[0]] === undefined) {
          priceHistory[price[0]] = priceUpdater.getEmptyPricesObj();
        }
        priceHistory[price[0]][currency] = price[1];
      }
    }

    for (const time in priceHistory) {
      if (priceHistory[time].USD === -1) {
        delete priceHistory[time];
        continue;
      }
      await PricesRepository.$savePrices(parseInt(time, 10), priceHistory[time]);
    }

    if (Object.keys(priceHistory).length > 0) {
      logger.info(`Inserted ${Object.keys(priceHistory).length} Kraken EUR, USD, GBP, JPY, CAD, CHF and AUD weekly price history into db`, logger.tags.mining);
    }

    if (fetchFailed) {
      // A currency with no answer would look like one Kraken has no history for, and be reset
      if (Object.keys(corrections).length > 0) {
        logger.warn(`Not correcting weekly price rows because Kraken did not return every currency; trying again on the next run`, logger.tags.mining);
      }
      return;
    }

    for (const time in corrections) {
      // Currencies Kraken has no candle for at this time were derived from USD, so they are
      // recalculated when USD changes
      const derivedCurrencies = this.currencies.filter(currency => !candleCurrencies[time].has(currency));
      await PricesRepository.$updateMainCurrencyPrices(parseInt(time, 10), corrections[time], derivedCurrencies);
    }

    if (Object.keys(corrections).length > 0) {
      logger.notice(`Corrected ${Object.keys(corrections).length} weekly price rows to the opening price of the week`, logger.tags.mining);
    }
  }
}

export default KrakenApi;
