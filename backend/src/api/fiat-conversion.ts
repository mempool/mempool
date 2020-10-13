import * as request from 'request';
import logger from '../logger';

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

  private updateCurrency() {
    request('https://api.opennode.co/v1/rates', { json: true }, (err, res, body) => {
      if (err) { return logger.info(err); }
      if (body && body.data) {
        this.tickers = body.data;
      }
    });
  }
}

export default new FiatConversion();
