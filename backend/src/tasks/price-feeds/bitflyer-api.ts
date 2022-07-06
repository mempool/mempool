import { query } from '../../utils/axios-query';
import { PriceFeed, PriceHistory } from '../price-updater';

class BitflyerApi implements PriceFeed {
  public name: string = 'Bitflyer';
  public currencies: string[] = ['USD', 'EUR', 'JPY'];

  public url: string = 'https://api.bitflyer.com/v1/ticker?product_code=BTC_';
  public urlHist: string = '';

  constructor() {
  }

  public async $fetchPrice(currency): Promise<number> {
    const response = await query(this.url + currency);
    return response ? parseInt(response['ltp'], 10) : -1;
  }

  public async $fetchRecentHourlyPrice(currencies: string[]): Promise<PriceHistory> {
    return [];
  }
}

export default BitflyerApi;
