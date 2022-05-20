import logger from '../logger';
import * as http from 'http';
import * as https from 'https';
import axios, { AxiosResponse } from 'axios';
import { IConversionRates } from '../mempool.interfaces';
import config from '../config';
import backendInfo from './backend-info';
import { SocksProxyAgent } from 'socks-proxy-agent';

class FiatConversion {
  private debasingFiatCurrencies = ['AED', 'AUD', 'BDT', 'BHD', 'BMD', 'BRL', 'CAD', 'CHF', 'CLP',
    'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'JPY', 'KRW', 'KWD',
    'LKR', 'MMK', 'MXN', 'MYR', 'NGN', 'NOK', 'NZD', 'PHP', 'PKR', 'PLN', 'RUB', 'SAR', 'SEK',
    'SGD', 'THB', 'TRY', 'TWD', 'UAH', 'USD', 'VND', 'ZAR'];
  private conversionRates: IConversionRates = {};
  private ratesChangedCallback: ((rates: IConversionRates) => void) | undefined;
  public ratesInitialized = false; // If true, it means rates are ready for use

  constructor() {
    for (const fiat of this.debasingFiatCurrencies) {
      this.conversionRates[fiat] = 0;
    }
  }

  public setProgressChangedCallback(fn: (rates: IConversionRates) => void) {
    this.ratesChangedCallback = fn;
  }

  public startService() {
    logger.info('Starting currency rates service');
    if (config.SOCKS5PROXY.ENABLED) {
      logger.info(`Currency rates service will be queried over the Tor network using ${config.PRICE_DATA_SERVER.TOR_URL}`);
    } else {
      logger.info(`Currency rates service will be queried over clearnet using ${config.PRICE_DATA_SERVER.CLEARNET_URL}`);
    }
    setInterval(this.updateCurrency.bind(this), 1000 * config.MEMPOOL.PRICE_FEED_UPDATE_INTERVAL);
    this.updateCurrency();
  }

  public getConversionRates() {
    return this.conversionRates;
  }

  private async updateCurrency(): Promise<void> {
    type axiosOptions = {
      headers: {
        'User-Agent': string
      };
      timeout: number;
      httpAgent?: http.Agent;
      httpsAgent?: https.Agent;
    }
    const setDelay = (secs: number = 1): Promise<void> => new Promise(resolve => setTimeout(() => resolve(), secs * 1000));
    const fiatConversionUrl = (config.SOCKS5PROXY.ENABLED === true) && (config.SOCKS5PROXY.USE_ONION === true) ? config.PRICE_DATA_SERVER.TOR_URL : config.PRICE_DATA_SERVER.CLEARNET_URL;
    const isHTTP = (new URL(fiatConversionUrl).protocol.split(':')[0] === 'http') ? true : false;
    const axiosOptions: axiosOptions = {
      headers: {
        'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
      },
      timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000
    };

    let retry = 0;

    if (config.SOCKS5PROXY.ENABLED) {
      let socksOptions: any = {
        agentOptions: {
          keepAlive: true,
        },
        hostname: config.SOCKS5PROXY.HOST,
        port: config.SOCKS5PROXY.PORT
      };

      if (config.SOCKS5PROXY.USERNAME && config.SOCKS5PROXY.PASSWORD) {
        socksOptions.username = config.SOCKS5PROXY.USERNAME;
        socksOptions.password = config.SOCKS5PROXY.PASSWORD;
      }

      // Handle proxy agent for onion addresses
      if (isHTTP) {
        axiosOptions.httpAgent = new SocksProxyAgent(socksOptions);
      } else {
        axiosOptions.httpsAgent = new SocksProxyAgent(socksOptions);
      }
    }

    while(retry < config.MEMPOOL.EXTERNAL_MAX_RETRY) {
      try {
        logger.debug('Querying currency rates service...');

        const response: AxiosResponse = await axios.get(`${fiatConversionUrl}`, axiosOptions);

        if (response.statusText === 'error' || !response.data) {
          throw new Error(`Could not fetch data from ${fiatConversionUrl}, Error: ${response.status}`);
        }

        for (const rate of response.data.data) {
          if (this.debasingFiatCurrencies.includes(rate.currencyCode) && rate.provider === 'Bisq-Aggregate') {
            this.conversionRates[rate.currencyCode] = Math.round(100 * rate.price) / 100;
          }
        }

        this.ratesInitialized = true;
        logger.debug(`USD Conversion Rate: ${this.conversionRates.USD}`);

        if (this.ratesChangedCallback) {
          this.ratesChangedCallback(this.conversionRates);
        }
        break;
      } catch (e) {
        logger.err('Error updating fiat conversion rates: '  + (e instanceof Error ? e.message : e));
        await setDelay(config.MEMPOOL.EXTERNAL_RETRY_INTERVAL);
        retry++;
      }
    }
  }
}

export default new FiatConversion();
