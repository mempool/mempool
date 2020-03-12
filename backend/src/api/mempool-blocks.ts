const config = require('../../mempool-config.json');
import { MempoolBlock, TransactionExtended } from '../interfaces';

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

  private dataToMempoolBlocks(transactions: TransactionExtended[], blockSize: number, blockVSize: number, blocksIndex: number): MempoolBlock {
    let rangeLength = 3;
    if (blocksIndex === 0) {
      rangeLength = 8;
    }
    if (transactions.length > 4000) {
      rangeLength = 5;
    } else if (transactions.length > 10000) {
      rangeLength = 8;
    } else if (transactions.length > 25000) {
      rangeLength = 10;
    }
    return {
      blockSize: blockSize,
      blockVSize: blockVSize,
      nTx: transactions.length,
      medianFee: this.median(transactions.map((tx) => tx.feePerVsize)),
      feeRange: this.getFeesInRange(transactions, rangeLength),
    };
  }

  private median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    numbers.sort();
    if (numsLen % 2 === 0) {
        medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else {
        medianNr = numbers[(numsLen - 1) / 2];
    }
    return medianNr;
  }

  private getFeesInRange(transactions: TransactionExtended[], rangeLength: number) {
    const arr = [transactions[transactions.length - 1].feePerVsize];
    const chunk = 1 / (rangeLength - 1);
    let itemsToAdd = rangeLength - 2;

    while (itemsToAdd > 0) {
      arr.push(transactions[Math.floor(transactions.length * chunk * itemsToAdd)].feePerVsize);
      itemsToAdd--;
    }

    arr.push(transactions[0].feePerVsize);
    return arr;
  }
}

export default new MempoolBlocks();
