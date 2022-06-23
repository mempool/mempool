import { query } from '../../utils/axios-query';
import priceUpdater, { PriceFeed, PriceHistory } from '../price-updater';

class FtxApi implements PriceFeed {
  public name: string = 'FTX';
  public currencies: string[] = ['USD', 'BRZ', 'EUR', 'JPY', 'AUD'];

  public url: string = 'https://ftx.com/api/markets/BTC/';
  public urlHist: string = 'https://ftx.com/api/markets/BTC/{CURRENCY}/candles?resolution={GRANULARITY}';

  constructor() {
  }

  public async $fetchPrice(currency): Promise<number> {
    const response = await query(this.url + currency);
    return response ? parseInt(response['result']['last'], 10) : -1;
  }

  public async $fetchRecentHourlyPrice(currencies: string[]): Promise<PriceHistory> {
    const priceHistory: PriceHistory = {};

    for (const currency of currencies) {
      if (this.currencies.includes(currency) === false) {
        continue;
      }

      const response = await query(this.urlHist.replace('{GRANULARITY}', '3600').replace('{CURRENCY}', currency));
      const pricesRaw = response ? response['result'] : [];

      for (const price of pricesRaw as any[]) {
        const time = Math.round(price['time'] / 1000);
        if (priceHistory[time] === undefined) {
          priceHistory[time] = priceUpdater.getEmptyPricesObj();
        }
        priceHistory[time][currency] = price['close'];
      }
    }

    return priceHistory;
  }
}

export default FtxApi;
