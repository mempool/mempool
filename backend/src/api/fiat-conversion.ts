import logger from '../logger';
import axios from 'axios';
import { IConversionRates } from '../mempool.interfaces';
import config from '../config';

class FiatConversion {
  private conversionRates: IConversionRates = {
    'USD': 0
  };
  private ratesChangedCallback: ((rates: IConversionRates) => void) | undefined;

  constructor() { }

  public setProgressChangedCallback(fn: (rates: IConversionRates) => void) {
    this.ratesChangedCallback = fn;
  }

  public startService() {
    logger.info('Starting currency rates service');
    setInterval(this.updateCurrency.bind(this), 1000 * config.MEMPOOL.PRICE_FEED_UPDATE_INTERVAL);
    this.updateCurrency();
  }

  public getConversionRates() {
    return this.conversionRates;
  }

  private async updateCurrency(): Promise<void> {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin-cash&vs_currencies=usd', { timeout: 10000 });
      const exchangerate = response.data.data.find((item: any));
      this.conversionRates = {
        'USD': exchangerate.usd,
      };
      if (this.ratesChangedCallback) {
        this.ratesChangedCallback(this.conversionRates);
      }
    } catch (e) {
      logger.err('Error updating fiat conversion rates: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new FiatConversion();
