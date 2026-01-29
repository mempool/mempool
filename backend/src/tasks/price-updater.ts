import * as fs from 'fs';
import path from 'path';
import config from '../config';
import logger from '../logger';
import PricesRepository, { ApiPrice, MAX_PRICES } from '../repositories/PricesRepository';
import BitfinexApi from './price-feeds/bitfinex-api';
import BitflyerApi from './price-feeds/bitflyer-api';
import CoinbaseApi from './price-feeds/coinbase-api';
import GeminiApi from './price-feeds/gemini-api';
import KrakenApi from './price-feeds/kraken-api';
import FreeCurrencyApi from './price-feeds/free-currency-api';

export interface PriceFeed {
  name: string;
  url: string;
  urlHist: string;
  currencies: string[];

  $fetchPrice(currency): Promise<number>;
  $fetchRecentPrice(currencies: string[], type: string): Promise<PriceHistory>;
}

export interface PriceHistory {
  [timestamp: number]: ApiPrice;
}

export interface ConversionFeed {
  $getQuota(): Promise<any>;
  $fetchLatestConversionRates(): Promise<ConversionRates>;
  $fetchConversionRates(date: string): Promise<ConversionRates>;
}

export interface ConversionRates {
  [currency: string]: number
}

function getMedian(arr: number[]): number {
  const sortedArr = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sortedArr.length / 2);
  return sortedArr.length % 2 !== 0
      ? sortedArr[mid]
      : (sortedArr[mid - 1] + sortedArr[mid]) / 2;
}

class PriceUpdater {
  public historyInserted = false;
  private additionalCurrenciesHistoryInserted = false;
  private additionalCurrenciesHistoryRunning = false;
  private lastFailedHistoricalRun = 0;
  private timeBetweenUpdatesMs = 360_0000 / config.MEMPOOL.PRICE_UPDATES_PER_HOUR;
  private cyclePosition = -1;
  private firstRun = true;
  private lastTime = -1;
  private lastHistoricalRun = 0;
  private running = false;
  private feeds: PriceFeed[] = [];
  private currencies: string[] = ['USD', 'EUR', 'GBP', 'CAD', 'CHF', 'AUD', 'JPY'];
  private latestPrices: ApiPrice;
  private latestGoodPrices: ApiPrice;
  private currencyConversionFeed: ConversionFeed | undefined;
  private newCurrencies: string[] = ['BGN', 'BRL', 'CNY', 'CZK', 'DKK', 'HKD', 'HRK', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'KRW', 'MXN', 'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'RUB', 'SEK', 'SGD', 'THB', 'TRY', 'ZAR'];
  private lastTimeConversionsRatesFetched: number = 0;
  private latestConversionsRatesFromFeed: ConversionRates = { USD: -1 };
  private ratesChangedCallback: ((rates: ApiPrice) => void) | undefined;

  constructor() {
    this.latestPrices = this.getEmptyPricesObj();
    this.latestGoodPrices = this.getEmptyPricesObj();

    this.feeds.push(new BitflyerApi()); // Does not have historical endpoint
    this.feeds.push(new KrakenApi());
    this.feeds.push(new CoinbaseApi());
    this.feeds.push(new BitfinexApi());
    this.feeds.push(new GeminiApi());

    this.currencyConversionFeed = new FreeCurrencyApi();
    this.setCyclePosition();
  }

  public getLatestPrices(): ApiPrice {
    return this.latestGoodPrices;
  }

  public getEmptyPricesObj(): ApiPrice {
    return {
      time: 0,
      USD: -1,
      EUR: -1,
      GBP: -1,
      CAD: -1,
      CHF: -1,
      AUD: -1,
      JPY: -1,
      BGN: -1,
      BRL: -1,
      CNY: -1,
      CZK: -1,
      DKK: -1,
      HKD: -1,
      HRK: -1,
      HUF: -1,
      IDR: -1,
      ILS: -1,
      INR: -1,
      ISK: -1,
      KRW: -1,
      MXN: -1,
      MYR: -1,
      NOK: -1,
      NZD: -1,
      PHP: -1,
      PLN: -1,
      RON: -1,
      RUB: -1,
      SEK: -1,
      SGD: -1,
      THB: -1,
      TRY: -1,
      ZAR: -1,
    };
  }

  public setRatesChangedCallback(fn: (rates: ApiPrice) => void): void {
    this.ratesChangedCallback = fn;
  }

  /**
   * We execute this function before the websocket initialization since
   * the websocket init is not done asyncronously
   */
  public async $initializeLatestPriceWithDb(): Promise<void> {
    this.latestPrices = await PricesRepository.$getLatestConversionRates();
    this.latestGoodPrices = JSON.parse(JSON.stringify(this.latestPrices));
  }

  public async $run(): Promise<void> {
    if (['testnet', 'signet', 'testnet4', 'regtest'].includes(config.MEMPOOL.NETWORK)) {
      // Coins have no value on testnet/signet, so we want to always show 0
      return;
    }

    if (this.running === true) {
      return;
    }
    this.running = true;

    if ((Math.round(new Date().getTime() / 1000) - this.lastHistoricalRun) > 3600 * 24) {
      // Once a day, look for missing prices (could happen due to network connectivity issues)
      this.historyInserted = false;
      this.additionalCurrenciesHistoryInserted = false;
    }

    if (this.lastFailedHistoricalRun > 0 && (Math.round(new Date().getTime() / 1000) - this.lastFailedHistoricalRun) > 60) {
      // If the last attempt to insert missing prices failed, we try again after 60 seconds
      this.additionalCurrenciesHistoryInserted = false;
    }

    if (config.FIAT_PRICE.API_KEY && this.currencyConversionFeed && (Math.round(new Date().getTime() / 1000) - this.lastTimeConversionsRatesFetched) > 3600 * 24) {
      // Once a day, fetch conversion rates from api: we don't need more granularity for fiat currencies and have a limited number of requests
      try {
        this.latestConversionsRatesFromFeed = await this.currencyConversionFeed.$fetchLatestConversionRates();
        this.lastTimeConversionsRatesFetched = Math.round(new Date().getTime() / 1000);
        logger.debug(`Fetched currencies conversion rates from conversions API: ${JSON.stringify(this.latestConversionsRatesFromFeed)}`);
      } catch (e) {
        logger.err(`Cannot fetch conversion rates from conversions API. Reason: ${(e instanceof Error ? e.message : e)}`);
      }
    }

    try {
      await this.$updatePrice();
      if (this.historyInserted === false && config.DATABASE.ENABLED === true) {
        await this.$insertHistoricalPrices();
      }
      if (this.additionalCurrenciesHistoryInserted === false && config.DATABASE.ENABLED === true && config.FIAT_PRICE.API_KEY && !this.additionalCurrenciesHistoryRunning) {
        await this.$insertMissingAdditionalPrices();
      }

    } catch (e: any) {
      logger.err(`Cannot save BTC prices in db. Reason: ${e instanceof Error ? e.message : e}`, logger.tags.mining);
    }

    this.running = false;
  }

  private setLatestPrice(currency, price): void {
    this.latestPrices[currency] = price;
    if (price > 0) {
      this.latestGoodPrices[currency] = price;
      this.latestGoodPrices.time = Math.round(new Date().getTime() / 1000);
    }
  }

  private getMillisecondsSinceBeginningOfHour(): number {
    const now = new Date();
    const beginningOfHour = new Date(now);
    beginningOfHour.setMinutes(0, 0, 0);
    return now.getTime() - beginningOfHour.getTime();
  }

  private setCyclePosition(): void {
    const millisecondsSinceBeginningOfHour = this.getMillisecondsSinceBeginningOfHour();
    for (let i = 0; i < config.MEMPOOL.PRICE_UPDATES_PER_HOUR; i++) {
      if (this.timeBetweenUpdatesMs * i > millisecondsSinceBeginningOfHour) {
        this.cyclePosition = i;
        return;
      }
    }
    this.cyclePosition = config.MEMPOOL.PRICE_UPDATES_PER_HOUR;
  }

  /**
   * Fetch last BTC price from exchanges, average them, and save it in the database once every hour
   */
  private async $updatePrice(): Promise<void> {
    let forceUpdate = false;
    if (this.firstRun === true && config.DATABASE.ENABLED === true) {
      const lastUpdate = await PricesRepository.$getLatestPriceTime();
      if (new Date().getTime() / 1000 - lastUpdate > this.timeBetweenUpdatesMs / 1000) {
        forceUpdate = true;
      }
      this.firstRun = false;
    }

    const millisecondsSinceBeginningOfHour = this.getMillisecondsSinceBeginningOfHour();

    // Reset the cycle on new hour
    if (this.lastTime > millisecondsSinceBeginningOfHour) {
      this.cyclePosition = 0;
    }
    this.lastTime = millisecondsSinceBeginningOfHour;
    if (millisecondsSinceBeginningOfHour < this.timeBetweenUpdatesMs * this.cyclePosition && !forceUpdate && this.cyclePosition !== 0) {
      return;
    }

    for (const currency of this.currencies) {
      let prices: number[] = [];

      for (const feed of this.feeds) {
        // Fetch prices from API which supports `currency`
        if (feed.currencies.includes(currency)) {
          try {
            const price = await feed.$fetchPrice(currency);
            if (price > -1 && price < MAX_PRICES[currency]) {
              prices.push(price);
            }
            logger.debug(`${feed.name} BTC/${currency} price: ${price}`, logger.tags.mining);
          } catch (e) {
            logger.debug(`Could not fetch BTC/${currency} price at ${feed.name}. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
          }
        }
      }
      if (prices.length === 1) {
        logger.debug(`Only ${prices.length} feed available for BTC/${currency} price`, logger.tags.mining);
      }

      // Compute average price, non weighted
      prices = prices.filter(price => price > 0);
      if (prices.length === 0) {
        this.setLatestPrice(currency, -1);
      } else {
        this.setLatestPrice(currency, Math.round(getMedian(prices)));
      }
    }

    if (config.FIAT_PRICE.API_KEY && this.latestPrices.USD > 0 && Object.keys(this.latestConversionsRatesFromFeed).length > 0) {
      for (const conversionCurrency of this.newCurrencies) {
        if (this.latestConversionsRatesFromFeed[conversionCurrency] > 0 && this.latestPrices.USD * this.latestConversionsRatesFromFeed[conversionCurrency] < MAX_PRICES[conversionCurrency]) {
          this.setLatestPrice(conversionCurrency, Math.round(this.latestPrices.USD * this.latestConversionsRatesFromFeed[conversionCurrency]));
        }
      }
    }

    if (config.DATABASE.ENABLED === true && this.cyclePosition === 0) {
      // Save everything in db
      try {
        const p = 60 * 60 * 1000; // milliseconds in an hour
        const nowRounded = new Date(Math.round(new Date().getTime() / p) * p); // https://stackoverflow.com/a/28037042
        await PricesRepository.$savePrices(nowRounded.getTime() / 1000, this.latestPrices);
      } catch (e) {
        logger.err(`Cannot save latest prices into db. Trying again in 5 minutes. Reason: ${(e instanceof Error ? e.message : e)}`);
      }
    }

    this.latestPrices.time = Math.round(new Date().getTime() / 1000);

    if (!forceUpdate) {
      this.cyclePosition++;
    }

    if (this.latestPrices.USD === -1) {
      logger.warn(`No BTC price available, falling back to latest known price: ${JSON.stringify(this.latestGoodPrices)}`);
    } else {
      logger.info(`Latest BTC fiat averaged price: ${JSON.stringify(this.latestGoodPrices)}`);
    }

    if (this.ratesChangedCallback && this.latestGoodPrices.USD > 0) {
      this.ratesChangedCallback(this.latestGoodPrices);
    }
  }

  /**
   * Called once by the database migration to initialize historical prices data (weekly)
   * We use MtGox weekly price from July 19, 2010 to September 30, 2013
   * We use Kraken weekly price from October 3, 2013 up to last month
   * We use Kraken hourly price for the past month
   */
  private async $insertHistoricalPrices(): Promise<void> {
    const existingPriceTimes = await PricesRepository.$getPricesTimes();

    // Insert MtGox weekly prices
    const pricesJson: any[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'mtgox-weekly.json')).toString());
    const prices = this.getEmptyPricesObj();
    let insertedCount: number = 0;
    for (const price of pricesJson) {
      if (existingPriceTimes.includes(price['ct'])) {
        continue;
      }

      // From 1380758400 we will use Kraken price as it follows closely MtGox, but was not affected as much
      // by the MtGox exchange collapse a few months later
      if (price['ct'] > 1380758400) {
        break;
      }
      prices.USD = price['c'];
      await PricesRepository.$savePrices(price['ct'], prices);
      ++insertedCount;
    }
    if (insertedCount > 0) {
      logger.notice(`Inserted ${insertedCount} MtGox USD weekly price history into db`, logger.tags.mining);
    } else {
      logger.debug(`Inserted ${insertedCount} MtGox USD weekly price history into db`, logger.tags.mining);
    }

    // Insert Kraken weekly prices
    await new KrakenApi().$insertHistoricalPrice();

    // Insert missing recent hourly prices
    await this.$insertMissingRecentPrices('day');
    await this.$insertMissingRecentPrices('hour');

    this.historyInserted = true;
    this.lastHistoricalRun = Math.round(new Date().getTime() / 1000);
  }

  /**
   * Find missing hourly prices and insert them in the database
   * It has a limited backward range and it depends on which API are available
   */
  private async $insertMissingRecentPrices(type: 'hour' | 'day'): Promise<void> {
    const existingPriceTimes = await PricesRepository.$getPricesTimes();

    logger.debug(`Fetching ${type === 'day' ? 'dai' : 'hour'}ly price history from exchanges and saving missing ones into the database`, logger.tags.mining);

    const historicalPrices: PriceHistory[] = [];

    // Fetch all historical hourly prices
    for (const feed of this.feeds) {
      try {
        historicalPrices.push(await feed.$fetchRecentPrice(this.currencies, type));
      } catch (e) {
        logger.err(`Cannot fetch hourly historical price from ${feed.name}. Ignoring this feed. Reason: ${e instanceof Error ? e.message : e}`, logger.tags.mining);
      }
    }

    // Group them by timestamp and currency, for example
    // grouped[123456789]['USD'] = [1, 2, 3, 4];
    const grouped = {};
    for (const historicalEntry of historicalPrices) {
      for (const time in historicalEntry) {
        if (existingPriceTimes.includes(parseInt(time, 10))) {
          continue;
        }

        if (grouped[time] === undefined) {
          grouped[time] = {
            USD: [], EUR: [], GBP: [], CAD: [], CHF: [], AUD: [], JPY: []
          };
        }

        for (const currency of this.currencies) {
          const price = historicalEntry[time][currency];
          if (price > -1 && price < MAX_PRICES[currency]) {
            grouped[time][currency].push(typeof price === 'string' ? parseInt(price, 10) : price);
          }
        }
      }
    }

    // Average prices and insert everything into the db
    let totalInserted = 0;
    for (const time in grouped) {
      const prices: ApiPrice = this.getEmptyPricesObj();
      for (const currency in grouped[time]) {
        if (grouped[time][currency].length === 0) {
          continue;
        }
        prices[currency] = Math.round(getMedian(grouped[time][currency]));
      }
      await PricesRepository.$savePrices(parseInt(time, 10), prices);
      ++totalInserted;
    }

    if (totalInserted > 0) {
      logger.notice(`Inserted ${totalInserted} ${type === 'day' ? 'dai' : 'hour'}ly historical prices into the db`, logger.tags.mining);
    } else {
      logger.debug(`Inserted ${totalInserted} ${type === 'day' ? 'dai' : 'hour'}ly historical prices into the db`, logger.tags.mining);
    }
  }

  /**
   * Find missing prices for additional currencies and insert them in the database
   * We calculate the additional prices from the USD price and the conversion rates
   */
  private async $insertMissingAdditionalPrices(): Promise<void> {
    this.lastFailedHistoricalRun = 0;
    const priceTimesToFill = await PricesRepository.$getPricesTimesWithMissingFields();
    if (priceTimesToFill.length === 0) {
      return;
    }
    try {
      const remainingQuota = await this.currencyConversionFeed?.$getQuota();
      if (remainingQuota['month']['remaining'] < 500) { // We need some calls left for the daily updates
        logger.debug(`Not enough conversions API credit to insert missing prices in ${priceTimesToFill.length} rows (${remainingQuota['month']['remaining']} calls left).`, logger.tags.mining);
        this.additionalCurrenciesHistoryInserted = true; // Do not try again until next day
        return;
      }
    } catch (e) {
      logger.err(`Cannot fetch conversions API credit, insertion of missing prices aborted. Reason: ${(e instanceof Error ? e.message : e)}`);
      return;
    }

    this.additionalCurrenciesHistoryRunning = true;
    logger.debug(`Inserting missing historical conversion rates using conversions API to fill ${priceTimesToFill.length} rows`, logger.tags.mining);

    const conversionRates: { [timestamp: number]: ConversionRates } = {};
    let totalInserted = 0;

    for (let i = 0; i < priceTimesToFill.length; i++) {
      const priceTime = priceTimesToFill[i];
      const missingLegacyCurrencies = this.getMissingLegacyCurrencies(priceTime); // In the case a legacy currency (EUR, GBP, CAD, CHF, AUD, JPY)
      const year = new Date(priceTime.time * 1000).getFullYear();                 // is missing, we use the same process as for the new currencies
      const month = new Date(priceTime.time * 1000).getMonth();
      const yearMonthTimestamp = new Date(year, month, 1).getTime() / 1000;
      if (conversionRates[yearMonthTimestamp] === undefined) {
        try {
          if (year === new Date().getFullYear() && month === new Date().getMonth()) { // For rows in the current month, we use the latest conversion rates
            conversionRates[yearMonthTimestamp] = this.latestConversionsRatesFromFeed;
          } else {
            conversionRates[yearMonthTimestamp] = await this.currencyConversionFeed?.$fetchConversionRates(`${year}-${month + 1 < 10 ? `0${month + 1}` : `${month + 1}`}-15`) || { USD: -1 };
          }

          if (conversionRates[yearMonthTimestamp]['USD'] < 0) {
            throw new Error('Incorrect USD conversion rate');
          }
        } catch (e) {
          if ((e instanceof Error ? e.message : '').includes('429')) { // Continue 60 seconds later if and only if error is 429
            this.lastFailedHistoricalRun = Math.round(new Date().getTime() / 1000);
            logger.info(`Got a 429 error from conversions API. This is expected to happen a few times during the initial historical price insertion, process will resume in 60 seconds.`, logger.tags.mining);
          } else {
            logger.err(`Cannot fetch conversion rates from conversions API for ${year}-${month + 1 < 10 ? `0${month + 1}` : `${month + 1}`}-01, trying again next day. Error: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
          }
          break;
        }
      }

      const prices: ApiPrice = this.getEmptyPricesObj();

      let willInsert = false;
      for (const conversionCurrency of this.newCurrencies.concat(missingLegacyCurrencies)) {
        if (conversionRates[yearMonthTimestamp][conversionCurrency] > 0 && priceTime.USD * conversionRates[yearMonthTimestamp][conversionCurrency] < MAX_PRICES[conversionCurrency]) {
          prices[conversionCurrency] = year >= 2013 ? Math.round(priceTime.USD * conversionRates[yearMonthTimestamp][conversionCurrency]) : Math.round(priceTime.USD * conversionRates[yearMonthTimestamp][conversionCurrency] * 100) / 100;
          willInsert = true;
        } else {
          prices[conversionCurrency] = 0;
        }
      }

      if (willInsert) {
        await PricesRepository.$saveAdditionalCurrencyPrices(priceTime.time, prices, missingLegacyCurrencies);
        ++totalInserted;
      }
    }

    logger.debug(`Inserted ${totalInserted} missing additional currency prices into the db`, logger.tags.mining);
    this.additionalCurrenciesHistoryInserted = true;
    this.additionalCurrenciesHistoryRunning = false;
  }

  // Helper function to get legacy missing currencies in a row (EUR, GBP, CAD, CHF, AUD, JPY)
  private getMissingLegacyCurrencies(priceTime: any): string[] {
    const missingCurrencies: string[] = [];
    ['eur', 'gbp', 'cad', 'chf', 'aud', 'jpy'].forEach(currency => {
      if (priceTime[`${currency}_missing`]) {
        missingCurrencies.push(currency.toUpperCase());
      }
    });
    return missingCurrencies;
  }
}

export default new PriceUpdater();
