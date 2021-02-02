"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../config");
const bitcoin_api_factory_1 = require("./bitcoin/bitcoin-api-factory");
const logger_1 = require("../logger");
const mempool_1 = require("./mempool");
const common_1 = require("./common");
const disk_cache_1 = require("./disk-cache");
const transaction_utils_1 = require("./transaction-utils");
class Blocks {
    constructor() {
        this.blocks = [];
        this.currentBlockHeight = 0;
        this.lastDifficultyAdjustmentTime = 0;
        this.newBlockCallbacks = [];
    }
    getBlocks() {
        return this.blocks;
    }
    setBlocks(blocks) {
        this.blocks = blocks;
    }
    setNewBlockCallback(fn) {
        this.newBlockCallbacks.push(fn);
    }
    async $updateBlocks() {
        const blockHeightTip = await bitcoin_api_factory_1.default.$getBlockHeightTip();
        if (this.blocks.length === 0) {
            this.currentBlockHeight = blockHeightTip - Blocks.INITIAL_BLOCK_AMOUNT;
        }
        else {
            this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
        }
        if (blockHeightTip - this.currentBlockHeight > Blocks.INITIAL_BLOCK_AMOUNT * 2) {
            logger_1.default.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${Blocks.INITIAL_BLOCK_AMOUNT} recent blocks`);
            this.currentBlockHeight = blockHeightTip - Blocks.INITIAL_BLOCK_AMOUNT;
        }
        if (!this.lastDifficultyAdjustmentTime) {
            const heightDiff = blockHeightTip % 2016;
            const blockHash = await bitcoin_api_factory_1.default.$getBlockHash(blockHeightTip - heightDiff);
            const block = await bitcoin_api_factory_1.default.$getBlock(blockHash);
            this.lastDifficultyAdjustmentTime = block.timestamp;
        }
        while (this.currentBlockHeight < blockHeightTip) {
            if (this.currentBlockHeight === 0) {
                this.currentBlockHeight = blockHeightTip;
            }
            else {
                this.currentBlockHeight++;
                logger_1.default.debug(`New block found (#${this.currentBlockHeight})!`);
            }
            const transactions = [];
            const blockHash = await bitcoin_api_factory_1.default.$getBlockHash(this.currentBlockHeight);
            const block = await bitcoin_api_factory_1.default.$getBlock(blockHash);
            const txIds = await bitcoin_api_factory_1.default.$getTxIdsForBlock(blockHash);
            const mempool = mempool_1.default.getMempool();
            let transactionsFound = 0;
            for (let i = 0; i < txIds.length; i++) {
                if (mempool[txIds[i]]) {
                    transactions.push(mempool[txIds[i]]);
                    transactionsFound++;
                }
                else if (config_1.default.MEMPOOL.BACKEND === 'esplora' || mempool_1.default.isInSync() || i === 0) {
                    logger_1.default.debug(`Fetching block tx ${i} of ${txIds.length}`);
                    try {
                        const tx = await transaction_utils_1.default.$getTransactionExtended(txIds[i]);
                        transactions.push(tx);
                    }
                    catch (e) {
                        logger_1.default.debug('Error fetching block tx: ' + e.message || e);
                        if (i === 0) {
                            throw new Error('Failed to fetch Coinbase transaction: ' + txIds[i]);
                        }
                    }
                }
            }
            logger_1.default.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${txIds.length - transactionsFound} not found.`);
            const blockExtended = Object.assign({}, block);
            blockExtended.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
            blockExtended.coinbaseTx = transaction_utils_1.default.stripCoinbaseTransaction(transactions[0]);
            transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
            blockExtended.medianFee = transactions.length > 1 ? common_1.Common.median(transactions.map((tx) => tx.feePerVsize)) : 0;
            blockExtended.feeRange = transactions.length > 1 ? common_1.Common.getFeesInRange(transactions.slice(0, transactions.length - 1), 8) : [0, 0];
            if (block.height % 2016 === 0) {
                this.lastDifficultyAdjustmentTime = block.timestamp;
            }
            this.blocks.push(blockExtended);
            if (this.blocks.length > Blocks.INITIAL_BLOCK_AMOUNT * 4) {
                this.blocks = this.blocks.slice(-Blocks.INITIAL_BLOCK_AMOUNT * 4);
            }
            if (this.newBlockCallbacks.length) {
                this.newBlockCallbacks.forEach((cb) => cb(blockExtended, txIds, transactions));
            }
            if (mempool_1.default.isInSync()) {
                disk_cache_1.default.$saveCacheToDisk();
            }
        }
    }
    getLastDifficultyAdjustmentTime() {
        return this.lastDifficultyAdjustmentTime;
    }
    getCurrentBlockHeight() {
        return this.currentBlockHeight;
    }
}
Blocks.INITIAL_BLOCK_AMOUNT = 8;
exports.default = new Blocks();
