import * as request from 'request';

class FiatConversion {
  private tickers = {
    'BTCUSD': {
      'USD': 4110.78
    },
  };

  constructor() { }

  public startService() {
    console.log('Starting currency rates service');
    setInterval(this.updateCurrency.bind(this), 1000 * 60 * 60);
    this.updateCurrency();
  }

  public getTickers() {
    return this.tickers;
  }

  private updateCurrency() {
    request('https://api.opennode.co/v1/rates', { json: true }, (err, res, body) => {
      if (err) { return console.log(err); }
      if (body && body.data) {
        this.tickers = body.data;
      }
    });
  }
}

export default new FiatConversion();
