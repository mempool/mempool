import logger from '../logger';
import axios from 'axios';
import { IConversionRates } from '../mempool.interfaces';

class FiatConversion {
  private conversionRates: IConversionRates = {
    'USD': 0,
    'EGP': 0,
    'CZK': 0,
    'EUR': 0,
    'IRR': 0,
    'KRW': 0,
    'GEL': 0,
    'HUF': 0,
    'JPY': 0,
    'NOK': 0,
    'BRL': 0,
    'SEK': 0,
    'TRY': 0,
    'UAH': 0,
    'VND': 0,
    'CNY': 0,
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
