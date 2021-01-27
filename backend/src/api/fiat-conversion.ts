import logger from '../logger';
import axios from 'axios';
import { IConversionRates } from '../mempool.interfaces';

class FiatConversion {
  private conversionRates: IConversionRates = {
    'USD': 0,
    'SEK': 0,
    // @todo add all currencies we have locales for, make sure they exist in getAllMarketPrices first
  };
  private ratesChangedCallback: ((rates: IConversionRates) => void) | undefined;

  constructor() { }

  public setProgressChangedCallback(fn: (rates: IConversionRates) => void) {
    this.ratesChangedCallback = fn;
  }

  public startService() {
    logger.info('Starting currency rates service');
    setInterval(this.updateCurrency.bind(this), 1000 * 60 * 60);
    this.updateCurrency();
  }

  public getConversionRates() {
    return this.conversionRates;
  }

  private async updateCurrency(): Promise<void> {
    try {
      const response = await axios.get('https://price.bisq.wiz.biz/getAllMarketPrices', { timeout: 10000 });
      const conversionRates = {};
      response.data.data.find((item: any) => (Object.keys(this.conversionRates).includes(item.currencyCode))).forEach((item: any) => {
        conversionRates[item.currencyCode] = item.price;
      });
      this.conversionRates = conversionRates;
      if (this.ratesChangedCallback) {
        this.ratesChangedCallback(this.conversionRates);
      }
    } catch (e) {
      logger.err('Error updating fiat conversion rates: ' + e);
    }
  }
}

export default new FiatConversion();
