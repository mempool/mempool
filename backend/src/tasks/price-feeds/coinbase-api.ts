import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

class CoinbaseApi implements PriceFeed {
  public name: string = 'Coinbase';
  public currencies: string[] = ['USD', 'EUR', 'GBP'];

  public url: string = 'https://api.coinbase.com/v2/prices/BTC-{CURRENCY}/spot';
  public urlHist: string = 'https://api.exchange.coinbase.com/products/BTC-{CURRENCY}/candles?granularity={GRANULARITY}';

  constructor() {
  }

  public async $fetchPrice(currency): Promise<number> {
    const response = await query(this.url.replace('{CURRENCY}', currency));
    if (response && response['data'] && response['data']['amount']) {
      return parseInt(response['data']['amount'], 10);
    } else {
      return -1;
    }
  }

  public async $fetchRecentPrice(currencies: string[], type: 'hour' | 'day'): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};

    for (const currency of currencies) {
      if (this.currencies.includes(currency) === false) {
        continue;
      }

      const response = await query(this.urlHist.replace('{GRANULARITY}', type === 'hour' ? '3600' : '86400').replace('{CURRENCY}', currency));
      const pricesRaw = response ? response : [];

      for (const price of pricesRaw as any[]) {
        if (priceHistory[price[0]] === undefined) {
          priceHistory[price[0]] = priceUpdater.getEmptyPricesObj();
        }
        priceHistory[price[0]][currency] = price[4];
      }
    }

    return priceHistory;
  }
}

export default CoinbaseApi;
