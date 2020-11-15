import logger from '../logger';
import axios from 'axios';

class FiatConversion {
  private tickers = {
    'BTCUSD': {
      'USD': 4110.78
    },
  };

  constructor() { }

  public startService() {
    logger.info('Starting currency rates service');
    setInterval(this.updateCurrency.bind(this), 1000 * 60 * 60);
    this.updateCurrency();
  }

  public getTickers() {
    return this.tickers;
  }

  private async updateCurrency(): Promise<void> {
    try {
      const response = await axios.get('https://api.opennode.co/v1/rates');
      this.tickers = response.data.data;
    } catch (e) {
      logger.err('Error updating currency from OpenNode: ' + e);
    }
  }
}

export default new FiatConversion();
