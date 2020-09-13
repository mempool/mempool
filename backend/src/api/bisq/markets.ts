const config = require('../../../mempool-config.json');
import * as fs from 'fs';
import { OffsersData, TradesData, Currency } from './interfaces';
import bisqMarket from './markets-api';

class Bisq {
  private static MARKET_JSON_PATH = config.BSQ_MARKETS_DATA_PATH + '/btc_mainnet/db';
  private static MARKET_JSON_FILE_PATHS = {
    cryptoCurrency: '/crypto_currency_list.json',
    fiatCurrency: '/fiat_currency_list.json',
    offers: '/offers_statistics.json',
    trades: '/trade_statistics.json',
  };

  private subdirectoryWatcher: fs.FSWatcher | undefined;

  constructor() {}

  startBisqService(): void {
    this.checkForBisqDataFolder();
    this.loadBisqDumpFile();
    this.startBisqDirectoryWatcher();
  }

  private checkForBisqDataFolder() {
    if (!fs.existsSync(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency)) {
      console.log(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency + ` doesn't exist. Make sure Bisq is running and the config is correct before starting the server.`);
      return process.exit(1);
    }
  }

  private startBisqDirectoryWatcher() {
    if (this.subdirectoryWatcher) {
      this.subdirectoryWatcher.close();
    }
    if (!fs.existsSync(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency)) {
      console.log(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency + ` doesn't exist. Trying to restart sub directory watcher again in 3 minutes.`);
      setTimeout(() => this.startBisqDirectoryWatcher(), 180000);
      return;
    }
    let fsWait: NodeJS.Timeout | null = null;
    this.subdirectoryWatcher = fs.watch(Bisq.MARKET_JSON_PATH, () => {
      if (fsWait) {
        clearTimeout(fsWait);
      }
      fsWait = setTimeout(() => {
        console.log(`Change detected in the Bisq market data folder.`);
        this.loadBisqDumpFile();
      }, 2000);
    });
  }

  private async loadBisqDumpFile(): Promise<void> {
    const start = new Date().getTime();
    console.log('Processing Bisq market data...');
    try {
      const cryptoCurrencyData = await this.loadData<Currency[]>(Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency);
      const fiatCurrencyData = await this.loadData<Currency[]>(Bisq.MARKET_JSON_FILE_PATHS.fiatCurrency);
      const offersData = await this.loadData<OffsersData[]>(Bisq.MARKET_JSON_FILE_PATHS.offers);
      const tradesData = await this.loadData<TradesData[]>(Bisq.MARKET_JSON_FILE_PATHS.trades);

      bisqMarket.setData(cryptoCurrencyData, fiatCurrencyData, offersData, tradesData);
      const time = new Date().getTime() - start;
      console.log('Bisq market data processed in ' + time + ' ms');
    } catch (e) {
      console.log('loadBisqMarketDataDumpFile() error.', e.message);
    }
  }

  private loadData<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(Bisq.MARKET_JSON_PATH + path)) {
        return reject(path + ` doesn't exist`);
      }
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
