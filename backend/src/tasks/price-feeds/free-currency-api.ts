import config from '../../config';
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

type PaidCurrencyData = {
  [key: string]: {
      code: string;
      value: number;
  }
};

type FreeCurrencyData = {
  [key: string]: number;
};

class FreeCurrencyApi implements ConversionFeed {
  private API_KEY = config.FIAT_PRICE.API_KEY;
  private PAID = config.FIAT_PRICE.PAID;
  private API_URL_PREFIX: string = this.PAID ? `https://api.currencyapi.com/v3/` : `https://api.freecurrencyapi.com/v1/`;

  constructor() { }

  public async $getQuota(): Promise<any> {
    const response = await query(`${this.API_URL_PREFIX}status?apikey=${this.API_KEY}`);
    if (response && response['quotas']) {
      return response['quotas'];
    }
    return null;
  }

  public async $fetchLatestConversionRates(): Promise<ConversionRates> {
    const response = await query(`${this.API_URL_PREFIX}latest?apikey=${this.API_KEY}`);
    if (response && response['data']) {
      if (this.PAID) {
        response['data'] = this.convertData(response['data']);
      }
      return response['data'];
    }
    return emptyRates;
  }

  public async $fetchConversionRates(date: string): Promise<ConversionRates> {
    const response = await query(`${this.API_URL_PREFIX}historical?date=${date}&apikey=${this.API_KEY}`, true);
    if (response && response['data'] && (response['data'][date] || this.PAID)) {
      if (this.PAID) {
        response['data'] = this.convertData(response['data']);
        response['data'][response['meta'].last_updated_at.substr(0, 10)] = response['data'];
      }
      return response['data'][date];
    }
    return emptyRates;
  }

  private convertData(data: PaidCurrencyData): FreeCurrencyData {
    const simplifiedData: FreeCurrencyData = {};
    for (const key in data) {
      simplifiedData[key] = data[key].value;
    }
    return simplifiedData;
  }

}

export default FreeCurrencyApi;
