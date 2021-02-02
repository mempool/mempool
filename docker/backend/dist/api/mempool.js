"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const bitcoin_api_factory_1 = require("./bitcoin/bitcoin-api-factory");
const logger_1 = require("../logger");
const common_1 = require("./common");
const transaction_utils_1 = require("./transaction-utils");
const bitcoin_base_api_1 = require("./bitcoin/bitcoin-base.api");
const loading_indicators_1 = require("./loading-indicators");
class Mempool {
    constructor() {
        this.inSync = false;
        this.mempoolCache = {};
        this.mempoolInfo = { loaded: false, size: 0, bytes: 0, usage: 0,
            maxmempool: 0, mempoolminfee: 0, minrelaytxfee: 0 };
        this.txPerSecondArray = [];
        this.txPerSecond = 0;
        this.vBytesPerSecondArray = [];
        this.vBytesPerSecond = 0;
        this.mempoolProtection = 0;
        this.latestTransactions = [];
        setInterval(this.updateTxPerSecond.bind(this), 1000);
    }
    isInSync() {
        return this.inSync;
    }
    setOutOfSync() {
        this.inSync = false;
        loading_indicators_1.default.setProgress('mempool', 99);
    }
    getLatestTransactions() {
        return this.latestTransactions;
    }
    setMempoolChangedCallback(fn) {
        this.mempoolChangedCallback = fn;
    }
    getMempool() {
        return this.mempoolCache;
    }
    setMempool(mempoolData) {
        this.mempoolCache = mempoolData;
        if (this.mempoolChangedCallback) {
            this.mempoolChangedCallback(this.mempoolCache, [], []);
        }
    }
    async $updateMemPoolInfo() {
        this.mempoolInfo = await bitcoin_base_api_1.default.$getMempoolInfo();
    }
    getMempoolInfo() {
        return this.mempoolInfo;
    }
    getTxPerSecond() {
        return this.txPerSecond;
    }
    getVBytesPerSecond() {
        return this.vBytesPerSecond;
    }
    getFirstSeenForTransactions(txIds) {
        const txTimes = [];
        txIds.forEach((txId) => {
            const tx = this.mempoolCache[txId];
            if (tx && tx.firstSeen) {
                txTimes.push(tx.firstSeen);
            }
            else {
                txTimes.push(0);
            }
        });
        return txTimes;
    }
    async $updateMempool() {
        logger_1.default.debug('Updating mempool');
        const start = new Date().getTime();
        let hasChange = false;
        const currentMempoolSize = Object.keys(this.mempoolCache).length;
        let txCount = 0;
        const transactions = await bitcoin_api_factory_1.default.$getRawMempool();
        const diff = transactions.length - currentMempoolSize;
        const newTransactions = [];
        if (!this.inSync) {
            loading_indicators_1.default.setProgress('mempool', Object.keys(this.mempoolCache).length / transactions.length * 100);
        }
        for (const txid of transactions) {
            if (!this.mempoolCache[txid]) {
                try {
                    const transaction = await transaction_utils_1.default.$getTransactionExtended(txid);
                    this.mempoolCache[txid] = transaction;
                    txCount++;
                    if (this.inSync) {
                        this.txPerSecondArray.push(new Date().getTime());
                        this.vBytesPerSecondArray.push({
                            unixTime: new Date().getTime(),
                            vSize: transaction.vsize,
                        });
                    }
                    hasChange = true;
                    if (diff > 0) {
                        logger_1.default.debug('Fetched transaction ' + txCount + ' / ' + diff);
                    }
                    else {
                        logger_1.default.debug('Fetched transaction ' + txCount);
                    }
                    newTransactions.push(transaction);
                }
                catch (e) {
                    logger_1.default.debug('Error finding transaction in mempool: ' + e.message || e);
                }
            }
            if ((new Date().getTime()) - start > Mempool.WEBSOCKET_REFRESH_RATE_MS) {
                break;
            }
        }
        // Prevent mempool from clear on bitcoind restart by delaying the deletion
        if (this.mempoolProtection === 0
            && config_1.default.MEMPOOL.BACKEND === 'esplora'
            && currentMempoolSize > 20000
            && transactions.length / currentMempoolSize <= 0.80) {
            this.mempoolProtection = 1;
            this.inSync = false;
            logger_1.default.warn(`Mempool clear protection triggered because transactions.length: ${transactions.length} and currentMempoolSize: ${currentMempoolSize}.`);
            setTimeout(() => {
                this.mempoolProtection = 2;
                logger_1.default.warn('Mempool clear protection resumed.');
            }, 1000 * 60 * Mempool.CLEAR_PROTECTION_MINUTES);
        }
        let newMempool = {};
        const deletedTransactions = [];
        if (this.mempoolProtection !== 1) {
            this.mempoolProtection = 0;
            // Index object for faster search
            const transactionsObject = {};
            transactions.forEach((txId) => transactionsObject[txId] = true);
            // Replace mempool to separate deleted transactions
            for (const tx in this.mempoolCache) {
                if (transactionsObject[tx]) {
                    newMempool[tx] = this.mempoolCache[tx];
                }
                else {
                    deletedTransactions.push(this.mempoolCache[tx]);
                }
            }
        }
        else {
            newMempool = this.mempoolCache;
        }
        const newTransactionsStripped = newTransactions.map((tx) => common_1.Common.stripTransaction(tx));
        this.latestTransactions = newTransactionsStripped.concat(this.latestTransactions).slice(0, 6);
        if (!this.inSync && transactions.length === Object.keys(newMempool).length) {
            this.inSync = true;
            logger_1.default.info('The mempool is now in sync!');
            loading_indicators_1.default.setProgress('mempool', 100);
        }
        if (this.mempoolChangedCallback && (hasChange || deletedTransactions.length)) {
            this.mempoolCache = newMempool;
            this.mempoolChangedCallback(this.mempoolCache, newTransactions, deletedTransactions);
        }
        const end = new Date().getTime();
        const time = end - start;
        logger_1.default.debug(`New mempool size: ${Object.keys(newMempool).length} Change: ${diff}`);
        logger_1.default.debug('Mempool updated in ' + time / 1000 + ' seconds');
    }
    updateTxPerSecond() {
        const nowMinusTimeSpan = new Date().getTime() - (1000 * config_1.default.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD);
        this.txPerSecondArray = this.txPerSecondArray.filter((unixTime) => unixTime > nowMinusTimeSpan);
        this.txPerSecond = this.txPerSecondArray.length / config_1.default.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD || 0;
        this.vBytesPerSecondArray = this.vBytesPerSecondArray.filter((data) => data.unixTime > nowMinusTimeSpan);
        if (this.vBytesPerSecondArray.length) {
            this.vBytesPerSecond = Math.round(this.vBytesPerSecondArray.map((data) => data.vSize).reduce((a, b) => a + b) / config_1.default.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD);
        }
    }
}
Mempool.WEBSOCKET_REFRESH_RATE_MS = 10000;
Mempool.CLEAR_PROTECTION_MINUTES = 10;
exports.default = new Mempool();
