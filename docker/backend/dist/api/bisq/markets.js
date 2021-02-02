"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const fs = require("fs");
const markets_api_1 = require("./markets-api");
const logger_1 = require("../../logger");
class Bisq {
    constructor() {
        this.cryptoCurrencyLastMtime = new Date('2016-01-01');
        this.fiatCurrencyLastMtime = new Date('2016-01-01');
        this.offersLastMtime = new Date('2016-01-01');
        this.tradesLastMtime = new Date('2016-01-01');
    }
    startBisqService() {
        this.checkForBisqDataFolder();
        this.loadBisqDumpFile();
        this.startBisqDirectoryWatcher();
    }
    checkForBisqDataFolder() {
        if (!fs.existsSync(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency)) {
            logger_1.default.err(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency + ` doesn't exist. Make sure Bisq is running and the config is correct before starting the server.`);
            return process.exit(1);
        }
    }
    startBisqDirectoryWatcher() {
        if (this.subdirectoryWatcher) {
            this.subdirectoryWatcher.close();
        }
        if (!fs.existsSync(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency)) {
            logger_1.default.warn(Bisq.MARKET_JSON_PATH + Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency + ` doesn't exist. Trying to restart sub directory watcher again in 3 minutes.`);
            setTimeout(() => this.startBisqDirectoryWatcher(), 180000);
            return;
        }
        let fsWait = null;
        this.subdirectoryWatcher = fs.watch(Bisq.MARKET_JSON_PATH, () => {
            if (fsWait) {
                clearTimeout(fsWait);
            }
            fsWait = setTimeout(() => {
                logger_1.default.debug(`Change detected in the Bisq market data folder.`);
                this.loadBisqDumpFile();
            }, Bisq.FOLDER_WATCH_CHANGE_DETECTION_DEBOUNCE);
        });
    }
    async loadBisqDumpFile() {
        const start = new Date().getTime();
        try {
            let marketsDataUpdated = false;
            const cryptoMtime = this.getFileMtime(Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency);
            const fiatMtime = this.getFileMtime(Bisq.MARKET_JSON_FILE_PATHS.fiatCurrency);
            if (cryptoMtime > this.cryptoCurrencyLastMtime || fiatMtime > this.fiatCurrencyLastMtime) {
                const cryptoCurrencyData = await this.loadData(Bisq.MARKET_JSON_FILE_PATHS.cryptoCurrency);
                const fiatCurrencyData = await this.loadData(Bisq.MARKET_JSON_FILE_PATHS.fiatCurrency);
                const activeCryptoCurrencyData = await this.loadData(Bisq.MARKET_JSON_FILE_PATHS.activeCryptoCurrency);
                const activeFiatCurrencyData = await this.loadData(Bisq.MARKET_JSON_FILE_PATHS.activeFiatCurrency);
                logger_1.default.debug('Updating Bisq Market Currency Data');
                markets_api_1.default.setCurrencyData(cryptoCurrencyData, fiatCurrencyData, activeCryptoCurrencyData, activeFiatCurrencyData);
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
                const offersData = await this.loadData(Bisq.MARKET_JSON_FILE_PATHS.offers);
                logger_1.default.debug('Updating Bisq Market Offers Data');
                markets_api_1.default.setOffersData(offersData);
                this.offersLastMtime = offersMtime;
                marketsDataUpdated = true;
            }
            const tradesMtime = this.getFileMtime(Bisq.MARKET_JSON_FILE_PATHS.trades);
            if (tradesMtime > this.tradesLastMtime) {
                const tradesData = await this.loadData(Bisq.MARKET_JSON_FILE_PATHS.trades);
                logger_1.default.debug('Updating Bisq Market Trades Data');
                markets_api_1.default.setTradesData(tradesData);
                this.tradesLastMtime = tradesMtime;
                marketsDataUpdated = true;
            }
            if (marketsDataUpdated) {
                markets_api_1.default.updateCache();
                const time = new Date().getTime() - start;
                logger_1.default.debug('Bisq market data updated in ' + time + ' ms');
            }
        }
        catch (e) {
            logger_1.default.err('loadBisqMarketDataDumpFile() error.' + e.message || e);
        }
    }
    getFileMtime(path) {
        const stats = fs.statSync(Bisq.MARKET_JSON_PATH + path);
        return stats.mtime;
    }
    loadData(path) {
        return new Promise((resolve, reject) => {
            fs.readFile(Bisq.MARKET_JSON_PATH + path, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                }
                try {
                    const parsedData = JSON.parse(data);
                    resolve(parsedData);
                }
                catch (e) {
                    reject('JSON parse error (' + path + ')');
                }
            });
        });
    }
}
Bisq.FOLDER_WATCH_CHANGE_DETECTION_DEBOUNCE = 4000;
Bisq.MARKET_JSON_PATH = config_1.default.BISQ_MARKETS.DATA_PATH;
Bisq.MARKET_JSON_FILE_PATHS = {
    activeCryptoCurrency: '/active_crypto_currency_list.json',
    activeFiatCurrency: '/active_fiat_currency_list.json',
    cryptoCurrency: '/crypto_currency_list.json',
    fiatCurrency: '/fiat_currency_list.json',
    offers: '/offers_statistics.json',
    trades: '/trade_statistics.json',
};
exports.default = new Bisq();
