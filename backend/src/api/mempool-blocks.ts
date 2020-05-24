const config = require('../../mempool-config.json');
import { MempoolBlock, TransactionExtended } from '../interfaces';
import { Common } from './common';

class MempoolBlocks {
  private mempoolBlocks: MempoolBlock[] = [];

  constructor() {}

  public getMempoolBlocks(): MempoolBlock[] {
    return this.mempoolBlocks;
  }

  public updateMempoolBlocks(memPool: { [txid: string]: TransactionExtended }): void {
    const latestMempool = memPool;
    const memPoolArray: TransactionExtended[] = [];
    for (const i in latestMempool) {
      if (latestMempool.hasOwnProperty(i)) {
        memPoolArray.push(latestMempool[i]);
      }
    }
    memPoolArray.sort((a, b) => b.feePerVsize - a.feePerVsize);
    const transactionsSorted = memPoolArray.filter((tx) => tx.feePerVsize);
    this.mempoolBlocks = this.calculateMempoolBlocks(transactionsSorted);
  }

  private calculateMempoolBlocks(transactionsSorted: TransactionExtended[]): MempoolBlock[] {
    const mempoolBlocks: MempoolBlock[] = [];
    let blockWeight = 0;
    let blockSize = 0;
    let transactions: TransactionExtended[] = [];
    transactionsSorted.forEach((tx) => {
      if (blockWeight + tx.vsize < 1000000 || mempoolBlocks.length === config.DEFAULT_PROJECTED_BLOCKS_AMOUNT - 1) {
        blockWeight += tx.vsize;
        blockSize += tx.size;
        transactions.push(tx);
      } else {
        mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, mempoolBlocks.length));
        blockWeight = 0;
        blockSize = 0;
        transactions = [];
      }
    });
    if (transactions.length) {
      mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, mempoolBlocks.length));
    }
    return mempoolBlocks;
  }

  private dataToMempoolBlocks(transactions: TransactionExtended[],
    blockSize: number, blockVSize: number, blocksIndex: number): MempoolBlock {
    let rangeLength = 4;
    if (blocksIndex === 0) {
      rangeLength = 8;
    }
    if (transactions.length > 4000) {
      rangeLength = 6;
    } else if (transactions.length > 10000) {
      rangeLength = 8;
    }
    return {
      blockSize: blockSize,
      blockVSize: blockVSize,
      nTx: transactions.length,
      totalFees: transactions.reduce((acc, cur) => acc + cur.fee, 0),
      medianFee: Common.median(transactions.map((tx) => tx.feePerVsize)),
      feeRange: Common.getFeesInRange(transactions, rangeLength),
    };
  }
}

export default new MempoolBlocks();
