import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

class BitfinexApi implements PriceFeed {
  public name: string = 'Bitfinex';
  public currencies: string[] = ['USD', 'EUR', 'GPB', 'JPY'];

  public url: string = 'https://api.bitfinex.com/v1/pubticker/BTC';
  public urlHist: string = 'https://api-pub.bitfinex.com/v2/candles/trade:{GRANULARITY}:tBTC{CURRENCY}/hist';

  public async $fetchPrice(currency): Promise<number> {
    const response = await query(this.url + currency);
    if (response && response['last_price']) {
      return parseInt(response['last_price'], 10);
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

      const response = await query(this.urlHist.replace('{GRANULARITY}', type === 'hour' ? '1h' : '1D').replace('{CURRENCY}', currency));
      const pricesRaw = response ? response : [];

      for (const price of pricesRaw as any[]) {
        const time = Math.round(price[0] / 1000);
        if (priceHistory[time] === undefined) {
          priceHistory[time] = priceUpdater.getEmptyPricesObj();
        }
        priceHistory[time][currency] = price[2];
      }
    }

    return priceHistory;
  }
}

export default BitfinexApi;
