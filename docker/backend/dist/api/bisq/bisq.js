"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const fs = require("fs");
const axios_1 = require("axios");
const common_1 = require("../common");
const node_worker_threads_pool_1 = require("node-worker-threads-pool");
const logger_1 = require("../../logger");
class Bisq {
    constructor() {
        this.latestBlockHeight = 0;
        this.blocks = [];
        this.transactions = [];
        this.transactionIndex = {};
        this.blockIndex = {};
        this.addressIndex = {};
        this.stats = {
            minted: 0,
            burnt: 0,
            addresses: 0,
            unspent_txos: 0,
            spent_txos: 0,
        };
        this.price = 0;
        this.jsonParsePool = new node_worker_threads_pool_1.StaticPool({
            size: 4,
            task: (blob) => JSON.parse(blob),
        });
    }
    startBisqService() {
        this.checkForBisqDataFolder();
        this.loadBisqDumpFile();
        setInterval(this.updatePrice.bind(this), 1000 * 60 * 60);
        this.updatePrice();
        this.startTopDirectoryWatcher();
        this.startSubDirectoryWatcher();
    }
    handleNewBitcoinBlock(block) {
        if (block.height - 2 > this.latestBlockHeight && this.latestBlockHeight !== 0) {
            logger_1.default.warn(`Bitcoin block height (#${block.height}) has diverged from the latest Bisq block height (#${this.latestBlockHeight}). Restarting watchers...`);
            this.startTopDirectoryWatcher();
            this.startSubDirectoryWatcher();
        }
    }
    getTransaction(txId) {
        return this.transactionIndex[txId];
    }
    getTransactions(start, length, types) {
        let transactions = this.transactions;
        if (types.length) {
            transactions = transactions.filter((tx) => types.indexOf(tx.txType) > -1);
        }
        return [transactions.slice(start, length + start), transactions.length];
    }
    getBlock(hash) {
        return this.blockIndex[hash];
    }
    getAddress(hash) {
        return this.addressIndex[hash];
    }
    getBlocks(start, length) {
        return [this.blocks.slice(start, length + start), this.blocks.length];
    }
    getStats() {
        return this.stats;
    }
    setPriceCallbackFunction(fn) {
        this.priceUpdateCallbackFunction = fn;
    }
    getLatestBlockHeight() {
        return this.latestBlockHeight;
    }
    checkForBisqDataFolder() {
        if (!fs.existsSync(Bisq.BLOCKS_JSON_FILE_PATH)) {
            logger_1.default.warn(Bisq.BLOCKS_JSON_FILE_PATH + ` doesn't exist. Make sure Bisq is running and the config is correct before starting the server.`);
            return process.exit(1);
        }
    }
    startTopDirectoryWatcher() {
        if (this.topDirectoryWatcher) {
            this.topDirectoryWatcher.close();
        }
        let fsWait = null;
        this.topDirectoryWatcher = fs.watch(config_1.default.BISQ_BLOCKS.DATA_PATH, () => {
            if (fsWait) {
                clearTimeout(fsWait);
            }
            if (this.subdirectoryWatcher) {
                this.subdirectoryWatcher.close();
            }
            fsWait = setTimeout(() => {
                logger_1.default.debug(`Bisq restart detected. Resetting both watchers in 3 minutes.`);
                setTimeout(() => {
                    this.startTopDirectoryWatcher();
                    this.startSubDirectoryWatcher();
                    this.loadBisqDumpFile();
                }, 180000);
            }, 15000);
        });
    }
    startSubDirectoryWatcher() {
        if (this.subdirectoryWatcher) {
            this.subdirectoryWatcher.close();
        }
        if (!fs.existsSync(Bisq.BLOCKS_JSON_FILE_PATH)) {
            logger_1.default.warn(Bisq.BLOCKS_JSON_FILE_PATH + ` doesn't exist. Trying to restart sub directory watcher again in 3 minutes.`);
            setTimeout(() => this.startSubDirectoryWatcher(), 180000);
            return;
        }
        let fsWait = null;
        this.subdirectoryWatcher = fs.watch(config_1.default.BISQ_BLOCKS.DATA_PATH + '/all', () => {
            if (fsWait) {
                clearTimeout(fsWait);
            }
            fsWait = setTimeout(() => {
                logger_1.default.debug(`Change detected in the Bisq data folder.`);
                this.loadBisqDumpFile();
            }, 2000);
        });
    }
    updatePrice() {
        axios_1.default.get('https://bisq.markets/api/trades/?market=bsq_btc')
            .then((response) => {
            const prices = [];
            response.data.forEach((trade) => {
                prices.push(parseFloat(trade.price) * 100000000);
            });
            prices.sort((a, b) => a - b);
            this.price = common_1.Common.median(prices);
            if (this.priceUpdateCallbackFunction) {
                this.priceUpdateCallbackFunction(this.price);
            }
        }).catch((err) => {
            logger_1.default.err('Error updating Bisq market price: ' + err);
        });
    }
    async loadBisqDumpFile() {
        try {
            const data = await this.loadData();
            await this.loadBisqBlocksDump(data);
            this.buildIndex();
            this.calculateStats();
        }
        catch (e) {
            logger_1.default.err('loadBisqDumpFile() error.' + e.message || e);
        }
    }
    buildIndex() {
        const start = new Date().getTime();
        this.transactions = [];
        this.transactionIndex = {};
        this.addressIndex = {};
        this.blocks.forEach((block) => {
            /* Build block index */
            if (!this.blockIndex[block.hash]) {
                this.blockIndex[block.hash] = block;
            }
            /* Build transactions index */
            block.txs.forEach((tx) => {
                this.transactions.push(tx);
                this.transactionIndex[tx.id] = tx;
            });
        });
        /* Build address index */
        this.transactions.forEach((tx) => {
            tx.inputs.forEach((input) => {
                if (!this.addressIndex[input.address]) {
                    this.addressIndex[input.address] = [];
                }
                if (this.addressIndex[input.address].indexOf(tx) === -1) {
                    this.addressIndex[input.address].push(tx);
                }
            });
            tx.outputs.forEach((output) => {
                if (!this.addressIndex[output.address]) {
                    this.addressIndex[output.address] = [];
                }
                if (this.addressIndex[output.address].indexOf(tx) === -1) {
                    this.addressIndex[output.address].push(tx);
                }
            });
        });
        const time = new Date().getTime() - start;
        logger_1.default.debug('Bisq data index rebuilt in ' + time + ' ms');
    }
    calculateStats() {
        let minted = 0;
        let burned = 0;
        let unspent = 0;
        let spent = 0;
        this.transactions.forEach((tx) => {
            tx.outputs.forEach((output) => {
                if (output.opReturn) {
                    return;
                }
                if (output.txOutputType === 'GENESIS_OUTPUT' || output.txOutputType === 'ISSUANCE_CANDIDATE_OUTPUT' && output.isVerified) {
                    minted += output.bsqAmount;
                }
                if (output.isUnspent) {
                    unspent++;
                }
                else {
                    spent++;
                }
            });
            burned += tx['burntFee'];
        });
        this.stats = {
            addresses: Object.keys(this.addressIndex).length,
            minted: minted / 100,
            burnt: burned / 100,
            spent_txos: spent,
            unspent_txos: unspent,
        };
    }
    async loadBisqBlocksDump(cacheData) {
        const start = new Date().getTime();
        if (cacheData && cacheData.length !== 0) {
            logger_1.default.debug('Processing Bisq data dump...');
            const data = await this.jsonParsePool.exec(cacheData);
            if (data.blocks && data.blocks.length !== this.blocks.length) {
                this.blocks = data.blocks.filter((block) => block.txs.length > 0);
                this.blocks.reverse();
                this.latestBlockHeight = data.chainHeight;
                const time = new Date().getTime() - start;
                logger_1.default.debug('Bisq dump processed in ' + time + ' ms (worker thread)');
            }
            else {
                throw new Error(`Bisq dump didn't contain any blocks`);
            }
        }
    }
    loadData() {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(Bisq.BLOCKS_JSON_FILE_PATH)) {
                return reject(Bisq.BLOCKS_JSON_FILE_PATH + ` doesn't exist`);
            }
            fs.readFile(Bisq.BLOCKS_JSON_FILE_PATH, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                }
                resolve(data);
            });
        });
    }
}
Bisq.BLOCKS_JSON_FILE_PATH = config_1.default.BISQ_BLOCKS.DATA_PATH + '/all/blocks.json';
exports.default = new Bisq();
