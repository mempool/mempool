import logger from '../logger';
import { MempoolBlock, TransactionExtended, MempoolBlockWithTransactions } from '../mempool.interfaces';
import { Common } from './common';
import config from '../config';

class MempoolBlocks {
  private static DEFAULT_PROJECTED_BLOCKS_AMOUNT = 8;
  private mempoolBlocks: MempoolBlockWithTransactions[] = [];

  constructor() {}

  public getMempoolBlocks(): MempoolBlock[] {
    return this.mempoolBlocks.map(block => {
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

  public getMempoolBlocksWithTransactions(): MempoolBlockWithTransactions[] {
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
    const start = new Date().getTime();

    // Clear bestDescendants & ancestors
    memPoolArray.forEach(tx => {
      tx.bestDescendant = null;
      tx.ancestors = [];
      tx.cpfpChecked = false;
      if (!tx.effectiveFeePerVsize) {
        tx.effectiveFeePerVsize = tx.feePerVsize;
      }
    });

    // First sort
    memPoolArray.sort((a, b) => b.feePerVsize - a.feePerVsize);

    // Loop through and traverse all ancestors and sum up all the sizes + fees
    // Pass down size + fee to all unconfirmed children
    let sizes = 0;
    memPoolArray.forEach((tx, i) => {
      sizes += tx.weight;
      if (sizes > 4000000 * 8) {
        return;
      }
      Common.setRelativesAndGetCpfpInfo(tx, memPool);
    });

    // Final sort, by effective fee
    memPoolArray.sort((a, b) => b.effectiveFeePerVsize - a.effectiveFeePerVsize);

    const end = new Date().getTime();
    const time = end - start;
    logger.debug('Mempool blocks calculated in ' + time / 1000 + ' seconds');

    this.mempoolBlocks = this.calculateMempoolBlocks(memPoolArray);
  }

  private calculateMempoolBlocks(transactionsSorted: TransactionExtended[]): MempoolBlockWithTransactions[] {
    const mempoolBlocks: MempoolBlockWithTransactions[] = [];
    let blockVSize = 0;
    let blockSize = 0;
    let transactions: TransactionExtended[] = [];
    transactionsSorted.forEach(tx => {
      if (
        blockVSize + tx.vsize <= 1000000 ||
        mempoolBlocks.length === MempoolBlocks.DEFAULT_PROJECTED_BLOCKS_AMOUNT - 1
      ) {
        blockVSize += tx.vsize;
        blockSize += tx.size;
        transactions.push(tx);
      } else {
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

  private dataToMempoolBlocks(
    transactions: TransactionExtended[],
    blockSize: number,
    blockVSize: number,
    blocksIndex: number
  ): MempoolBlockWithTransactions {
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
      medianFee: Common.percentile(
        transactions.map(tx => tx.effectiveFeePerVsize),
        config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE
      ),
      feeRange: Common.getFeesInRange(transactions, rangeLength),
      transactionIds: transactions.map(tx => tx.txid),
    };
  }
}

export default new MempoolBlocks();
