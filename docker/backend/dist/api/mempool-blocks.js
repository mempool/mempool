"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("./common");
class MempoolBlocks {
    constructor() {
        this.mempoolBlocks = [];
    }
    getMempoolBlocks() {
        return this.mempoolBlocks.map((block) => {
            return {
                blockSize: block.blockSize,
                blockVSize: block.blockVSize,
                nTx: block.nTx,
                totalFees: block.totalFees,
                medianFee: block.medianFee,
                feeRange: block.feeRange,
            };
        });
    }
    getMempoolBlocksWithTransactions() {
        return this.mempoolBlocks;
    }
    updateMempoolBlocks(memPool) {
        const latestMempool = memPool;
        const memPoolArray = [];
        for (const i in latestMempool) {
            if (latestMempool.hasOwnProperty(i)) {
                memPoolArray.push(latestMempool[i]);
            }
        }
        memPoolArray.sort((a, b) => b.feePerVsize - a.feePerVsize);
        const transactionsSorted = memPoolArray.filter((tx) => tx.feePerVsize);
        this.mempoolBlocks = this.calculateMempoolBlocks(transactionsSorted);
    }
    calculateMempoolBlocks(transactionsSorted) {
        const mempoolBlocks = [];
        let blockVSize = 0;
        let blockSize = 0;
        let transactions = [];
        transactionsSorted.forEach((tx) => {
            if (blockVSize + tx.vsize <= 1000000 || mempoolBlocks.length === MempoolBlocks.DEFAULT_PROJECTED_BLOCKS_AMOUNT - 1) {
                blockVSize += tx.vsize;
                blockSize += tx.size;
                transactions.push(tx);
            }
            else {
                mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockVSize, mempoolBlocks.length));
                blockVSize = tx.vsize;
                blockSize = tx.size;
                transactions = [tx];
            }
        });
        if (transactions.length) {
            mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockVSize, mempoolBlocks.length));
        }
        return mempoolBlocks;
    }
    dataToMempoolBlocks(transactions, blockSize, blockVSize, blocksIndex) {
        let rangeLength = 4;
        if (blocksIndex === 0) {
            rangeLength = 8;
        }
        if (transactions.length > 4000) {
            rangeLength = 6;
        }
        else if (transactions.length > 10000) {
            rangeLength = 8;
        }
        return {
            blockSize: blockSize,
            blockVSize: blockVSize,
            nTx: transactions.length,
            totalFees: transactions.reduce((acc, cur) => acc + cur.fee, 0),
            medianFee: common_1.Common.median(transactions.map((tx) => tx.feePerVsize)),
            feeRange: common_1.Common.getFeesInRange(transactions, rangeLength),
            transactionIds: transactions.map((tx) => tx.txid),
        };
    }
}
MempoolBlocks.DEFAULT_PROJECTED_BLOCKS_AMOUNT = 8;
exports.default = new MempoolBlocks();
