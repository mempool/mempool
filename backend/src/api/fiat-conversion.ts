import logger from '../logger';
import axios from 'axios';
import { IConversionRates } from '../mempool.interfaces';

class FiatConversion {
  private conversionRates: IConversionRates = {
    USD: 0,
  };
  private ratesChangedCallback: ((rates: IConversionRates) => void) | undefined;

  constructor() {}

  public setProgressChangedCallback(fn: (rates: IConversionRates) => void) {
    this.ratesChangedCallback = fn;
  }

  public startService() {
    logger.info('Starting currency rates service');
    setInterval(this.updateCurrency.bind(this), 1000 * 60);
    this.updateCurrency();
  }

  public getConversionRates() {
    return this.conversionRates;
  }

  private async updateCurrency(): Promise<void> {
    try {
      const response = await axios.get('https://price.bisq.wiz.biz/getAllMarketPrices', { timeout: 10000 });
      const usd = response.data.data.find((item: any) => item.currencyCode === 'USD');
      this.conversionRates = {
        USD: usd.price,
      };
      if (this.ratesChangedCallback) {
        this.ratesChangedCallback(this.conversionRates);
      }
    } catch (e) {
      logger.err('Error updating fiat conversion rates: ' + e);
    }
  }
}

export default new FiatConversion();
