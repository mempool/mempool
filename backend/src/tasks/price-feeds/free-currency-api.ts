import { query } from '../../utils/axios-query';
import { ConversionFeed, ConversionRates } from '../price-updater';

const emptyRates = {
  AUD: -1,
  BGN: -1,
  BRL: -1,
  CAD: -1,
  CHF: -1,
  CNY: -1,
  CZK: -1,
  DKK: -1,
  EUR: -1,
  GBP: -1,
  HKD: -1,
  HRK: -1,
  HUF: -1,
  IDR: -1,
  ILS: -1,
  INR: -1,
  ISK: -1,
  JPY: -1,
  KRW: -1,
  MXN: -1,
  MYR: -1,
  NOK: -1,
  NZD: -1,
  PHP: -1,
  PLN: -1,
  RON: -1,
  RUB: -1,
  SEK: -1,
  SGD: -1,
  THB: -1,
  TRY: -1,
  USD: -1,
  ZAR: -1,
};

class FreeCurrencyApi implements ConversionFeed {
  private API_KEY: string;

  constructor(apiKey: string) {
    this.API_KEY = apiKey;
  }

  public async $getQuota(): Promise<any> {
    const response = await query(`https://api.freecurrencyapi.com/v1/status?apikey=${this.API_KEY}`);
    if (response && response['quotas']) {
      return response['quotas'];
    }
    return null;
  }

  public async $fetchLatestConversionRates(): Promise<ConversionRates> {
    const response = await query(`https://api.freecurrencyapi.com/v1/latest?apikey=${this.API_KEY}`);
    if (response && response['data']) {
      return response['data'];
    }
    return emptyRates;
  }

  public async $fetchConversionRates(date: string): Promise<ConversionRates> {
    const response = await query(`https://api.freecurrencyapi.com/v1/historical?date=${date}&apikey=${this.API_KEY}`);
    if (response && response['data'] && response['data'][date]) {
      return response['data'][date];
    }
    return emptyRates;
  }

}

export default FreeCurrencyApi;
