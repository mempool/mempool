import logger from '../logger';
import axios from 'axios';

class FiatConversion {
  private conversionRates = {
    'USD': 0
  };

  constructor() { }

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
      const response = await axios.get('https://price.bisq.wiz.biz/getAllMarketPrices ');
      const usd = response.data.data.find((item: any) => item.currencyCode === 'USD');
      this.conversionRates = {
        'USD': usd.price,
      };
    } catch (e) {
      logger.err('Error updating fiat conversion rates: ' + e);
    }
  }
}

export default new FiatConversion();
