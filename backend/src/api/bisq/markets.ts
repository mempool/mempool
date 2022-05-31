import config from '../../config';
import * as fs from 'fs';
import { OffersData as OffersData, TradesData, Currency } from './interfaces';
import bisqMarket from './markets-api';
import logger from '../../logger';

class Bisq {
  private static FOLDER_WATCH_CHANGE_DETECTION_DEBOUNCE = 4000;
  private static MARKET_JSON_PATH = config.BISQ.DATA_PATH;
  private static MARKET_JSON_FILE_PATHS = {
    activeCryptoCurrency: '/active_crypto_currency_list.json',
    activeFiatCurrency: '/active_fiat_currency_list.json',
    cryptoCurrency: '/crypto_currency_list.json',
    fiatCurrency: '/fiat_currency_list.json',
    offers: '/offers_statistics.json',
    trades: '/trade_statistics.json',
  };

  private cryptoCurrencyLastMtime = new Date('2016-01-01');
  private fiatCurrencyLastMtime = new Date('2016-01-01');
  private offersLastMtime = new Date('2016-01-01');
  private tradesLastMtime = new Date('2016-01-01');

  private subdirectoryWatcher: fs.FSWatcher | undefined;

  constructor() {}

  startBisqService(): void {
    try {
      this.checkForBisqDataFolder();
    } catch (e) {
      logger.info('Retrying to start bisq service (markets) in 3 minutes');
      setTimeout(this.startBisqService.bind(this), 180000);
      return;
    }
    this.loadBisqDumpFile();
    this.startBisqDirectoryWatcher();
  }

  private checkForBisqDataFolder() {
    if (!fs.existsSync(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency)) {
      logger.err(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency + ` doesn't exist. Make sure Bisq is running and the config is correct before starting the server.`);
      throw new Error(`Cannot load BISQ ${Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency} file`);
    }
  }

  private startBisqDirectoryWatcher() {
    if (this.subdirectoryWatcher) {
      this.subdirectoryWatcher.close();
    }
    if (!fs.existsSync(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency)) {
      logger.warn(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency + ` doesn't exist. Trying to restart sub directory watcher again in 3 minutes.`);
      setTimeout(() => this.startBisqDirectoryWatcher(), 180000);
      return;
    }
    let fsWait: NodeJS.Timeout | null = null;
    this.subdirectoryWatcher = fs.watch(Bisq.MARKET_JSON_PATH, () => {
      if (fsWait) {
        clearTimeout(fsWait);
      }
      fsWait = setTimeout(() => {
        logger.debug(`Change detected in the Bisq market data folder.`);
        this.loadBisqDumpFile();
      }, Bisq.FOLDER_WATCH_CHANGE_DETECTION_DEBOUNCE);
    });
  }

  private async loadBisqDumpFile(): Promise<void> {
    const start = new Date().getTime();
    try {
      let marketsDataUpdated = false;
      const cryptoMtime = this.getFileMtime(Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency);
      const fiatMtime = this.getFileMtime(Bisq.MARKET_JSON_FILE_PATHS.fiatCurrency);
      if (cryptoMtime > this.cryptoCurrencyLastMtime || fiatMtime > this.fiatCurrencyLastMtime) {
        const cryptoCurrencyData = await this.loadData<Currency[]>(Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency);
        const fiatCurrencyData = await this.loadData<Currency[]>(Bisq.MARKET_JSON_FILE_PATHS.fiatCurrency);
        const activeCryptoCurrencyData = await this.loadData<Currency[]>(Bisq.MARKET_JSON_FILE_PATHS.activeCryptoCurrency);
        const activeFiatCurrencyData = await this.loadData<Currency[]>(Bisq.MARKET_JSON_FILE_PATHS.activeFiatCurrency);
        logger.debug('Updating Bisq Market Currency Data');
        bisqMarket.setCurrencyData(cryptoCurrencyData, fiatCurrencyData, activeCryptoCurrencyData, activeFiatCurrencyData);
        if (cryptoMtime > this.cryptoCurrencyLastMtime) {
          this.cryptoCurrencyLastMtime = cryptoMtime;
        }
        if (fiatMtime > this.fiatCurrencyLastMtime) {
          this.fiatCurrencyLastMtime = fiatMtime;
        }
        marketsDataUpdated = true;
      }
      const offersMtime = this.getFileMtime(Bisq.MARKET_JSON_FILE_PATHS.offers);
      if (offersMtime > this.offersLastMtime) {
        const offersData = await this.loadData<OffersData[]>(Bisq.MARKET_JSON_FILE_PATHS.offers);
        logger.debug('Updating Bisq Market Offers Data');
        bisqMarket.setOffersData(offersData);
        this.offersLastMtime = offersMtime;
        marketsDataUpdated = true;
      }
      const tradesMtime = this.getFileMtime(Bisq.MARKET_JSON_FILE_PATHS.trades);
      if (tradesMtime > this.tradesLastMtime) {
        const tradesData = await this.loadData<TradesData[]>(Bisq.MARKET_JSON_FILE_PATHS.trades);
        logger.debug('Updating Bisq Market Trades Data');
        bisqMarket.setTradesData(tradesData);
        this.tradesLastMtime = tradesMtime;
        marketsDataUpdated = true;
      }
      if (marketsDataUpdated) {
        bisqMarket.updateCache();
        const time = new Date().getTime() - start;
        logger.debug('Bisq market data updated in ' + time + ' ms');
      }
    } catch (e) {
      logger.err('loadBisqMarketDataDumpFile() error.' + (e instanceof Error ? e.message : e));
    }
  }

  private getFileMtime(path: string): Date {
    const stats = fs.statSync(Bisq.MARKET_JSON_PATH + path);
    return stats.mtime;
  }

  private loadData<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      fs.readFile(Bisq.MARKET_JSON_PATH + path, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        }
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData);
        } catch (e) {
          reject('JSON parse error (' + path + ')');
        }
      });
    });
  }
}

export default new Bisq();
