import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

class GeminiApi implements PriceFeed {
  public name: string = 'Gemini';
  public currencies: string[] = ['USD', 'EUR', 'GBP', 'SGD'];

  public url: string = 'https://api.gemini.com/v1/pubticker/BTC';
  public urlHist: string = 'https://api.gemini.com/v2/candles/BTC{CURRENCY}/{GRANULARITY}';

  constructor() {
  }

  public async $fetchPrice(currency): Promise<number> {
    const response = await query(this.url + currency);
    return response ? parseInt(response['last'], 10) : -1;
  }

  public async $fetchRecentHourlyPrice(currencies: string[]): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};

    for (const currency of currencies) {
      if (this.currencies.includes(currency) === false) {
        continue;
      }

      const response = await query(this.urlHist.replace('{GRANULARITY}', '1hr').replace('{CURRENCY}', currency));
      const pricesRaw = response ? response : [];

      for (const price of pricesRaw as any[]) {
        const time = Math.round(price[0] / 1000);
        if (priceHistory[time] === undefined) {
          priceHistory[time] = priceUpdater.getEmptyPricesObj();
        }
        priceHistory[time][currency] = price[4];
      }
    }

    return priceHistory;
  }
}

export default GeminiApi;
