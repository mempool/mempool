import logger from '../logger';
import { MempoolBlock, TransactionExtended, ThreadTransaction, TransactionStripped, MempoolBlockWithTransactions, MempoolBlockDelta, Ancestor } from '../mempool.interfaces';
import { Common } from './common';
import config from '../config';
import { Worker } from 'worker_threads';
import path from 'path';

class MempoolBlocks {
  private mempoolBlocks: MempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: MempoolBlockDelta[] = [];
  private txSelectionWorker: Worker | null = null;

  constructor() {}

  public getMempoolBlocks(): MempoolBlock[] {
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

  public getMempoolBlocksWithTransactions(): MempoolBlockWithTransactions[] {
    return this.mempoolBlocks;
  }

  public getMempoolBlockDeltas(): MempoolBlockDelta[] {
    return this.mempoolBlockDeltas;
  }

  public updateMempoolBlocks(memPool: { [txid: string]: TransactionExtended }, saveResults: boolean = false): MempoolBlockWithTransactions[] {
    const latestMempool = memPool;
    const memPoolArray: TransactionExtended[] = [];
    for (const i in latestMempool) {
      if (latestMempool.hasOwnProperty(i)) {
        memPoolArray.push(latestMempool[i]);
      }
    }
    const start = new Date().getTime();

    // Clear bestDescendants & ancestors
    memPoolArray.forEach((tx) => {
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

    const blocks = this.calculateMempoolBlocks(memPoolArray, this.mempoolBlocks);

    if (saveResults) {
      const deltas = this.calculateMempoolDeltas(this.mempoolBlocks, blocks);
      this.mempoolBlocks = blocks;
      this.mempoolBlockDeltas = deltas;
    }

    return blocks;
  }

  private calculateMempoolBlocks(transactionsSorted: TransactionExtended[], prevBlocks: MempoolBlockWithTransactions[]): MempoolBlockWithTransactions[] {
    const mempoolBlocks: MempoolBlockWithTransactions[] = [];
    let blockWeight = 0;
    let blockSize = 0;
    let transactions: TransactionExtended[] = [];
    transactionsSorted.forEach((tx) => {
      if (blockWeight + tx.weight <= config.MEMPOOL.BLOCK_WEIGHT_UNITS
        || mempoolBlocks.length === config.MEMPOOL.MEMPOOL_BLOCKS_AMOUNT - 1) {
        blockWeight += tx.weight;
        blockSize += tx.size;
        transactions.push(tx);
      } else {
        mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, mempoolBlocks.length));
        blockWeight = tx.weight;
        blockSize = tx.size;
        transactions = [tx];
      }
    });
    if (transactions.length) {
      mempoolBlocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, mempoolBlocks.length));
    }

    return mempoolBlocks;
  }

  private calculateMempoolDeltas(prevBlocks: MempoolBlockWithTransactions[], mempoolBlocks: MempoolBlockWithTransactions[]): MempoolBlockDelta[] {
    const mempoolBlockDeltas: MempoolBlockDelta[] = [];
    for (let i = 0; i < Math.max(mempoolBlocks.length, prevBlocks.length); i++) {
      let added: TransactionStripped[] = [];
      let removed: string[] = [];
      if (mempoolBlocks[i] && !prevBlocks[i]) {
        added = mempoolBlocks[i].transactions;
      } else if (!mempoolBlocks[i] && prevBlocks[i]) {
        removed = prevBlocks[i].transactions.map(tx => tx.txid);
      } else if (mempoolBlocks[i] && prevBlocks[i]) {
        const prevIds = {};
        const newIds = {};
        prevBlocks[i].transactions.forEach(tx => {
          prevIds[tx.txid] = true;
        });
        mempoolBlocks[i].transactions.forEach(tx => {
          newIds[tx.txid] = true;
        });
        prevBlocks[i].transactions.forEach(tx => {
          if (!newIds[tx.txid]) {
            removed.push(tx.txid);
          }
        });
        mempoolBlocks[i].transactions.forEach(tx => {
          if (!prevIds[tx.txid]) {
            added.push(tx);
          }
        });
      }
      mempoolBlockDeltas.push({
        added,
        removed
      });
    }
    return mempoolBlockDeltas;
  }

  public async makeBlockTemplates(newMempool: { [txid: string]: TransactionExtended }, saveResults: boolean = false): Promise<MempoolBlockWithTransactions[]> {
    // prepare a stripped down version of the mempool with only the minimum necessary data
    // to reduce the overhead of passing this data to the worker thread
    const strippedMempool: { [txid: string]: ThreadTransaction } = {};
    Object.values(newMempool).forEach(entry => {
      strippedMempool[entry.txid] = {
        txid: entry.txid,
        fee: entry.fee,
        weight: entry.weight,
        feePerVsize: entry.fee / (entry.weight / 4),
        effectiveFeePerVsize: entry.fee / (entry.weight / 4),
        vin: entry.vin.map(v => v.txid),
      };
    });

    // (re)initialize tx selection worker thread
    if (!this.txSelectionWorker) {
      this.txSelectionWorker = new Worker(path.resolve(__dirname, './tx-selection-worker.js'));
      // if the thread throws an unexpected error, or exits for any other reason,
      // reset worker state so that it will be re-initialized on the next run
      this.txSelectionWorker.once('error', () => {
        this.txSelectionWorker = null;
      });
      this.txSelectionWorker.once('exit', () => {
        this.txSelectionWorker = null;
      });
    }

    // run the block construction algorithm in a separate thread, and wait for a result
    let threadErrorListener;
    try {
      const workerResultPromise = new Promise<{ blocks: ThreadTransaction[][], clusters: { [root: string]: string[] } }>((resolve, reject) => {
        threadErrorListener = reject;
        this.txSelectionWorker?.once('message', (result): void => {
          resolve(result);
        });
        this.txSelectionWorker?.once('error', reject);
      });
      this.txSelectionWorker.postMessage({ type: 'set', mempool: strippedMempool });
      const { blocks, clusters } = await workerResultPromise;

      // clean up thread error listener
      this.txSelectionWorker?.removeListener('error', threadErrorListener);

      return this.processBlockTemplates(newMempool, blocks, clusters, saveResults);
    } catch (e) {
      logger.err('makeBlockTemplates failed. ' + (e instanceof Error ? e.message : e));
    }
    return this.mempoolBlocks;
  }

  public async updateBlockTemplates(newMempool: { [txid: string]: TransactionExtended }, added: TransactionExtended[], removed: string[], saveResults: boolean = false): Promise<void> {
    if (!this.txSelectionWorker) {
      // need to reset the worker
      this.makeBlockTemplates(newMempool, saveResults);
      return;
    }
    // prepare a stripped down version of the mempool with only the minimum necessary data
    // to reduce the overhead of passing this data to the worker thread
    const addedStripped: ThreadTransaction[] = added.map(entry => {
      return {
        txid: entry.txid,
        fee: entry.fee,
        weight: entry.weight,
        feePerVsize: entry.fee / (entry.weight / 4),
        effectiveFeePerVsize: entry.fee / (entry.weight / 4),
        vin: entry.vin.map(v => v.txid),
      };
    });

    // run the block construction algorithm in a separate thread, and wait for a result
    let threadErrorListener;
    try {
      const workerResultPromise = new Promise<{ blocks: ThreadTransaction[][], clusters: { [root: string]: string[] } }>((resolve, reject) => {
        threadErrorListener = reject;
        this.txSelectionWorker?.once('message', (result): void => {
          resolve(result);
        });
        this.txSelectionWorker?.once('error', reject);
      });
      this.txSelectionWorker.postMessage({ type: 'update', added: addedStripped, removed });
      const { blocks, clusters } = await workerResultPromise;

      // clean up thread error listener
      this.txSelectionWorker?.removeListener('error', threadErrorListener);

      this.processBlockTemplates(newMempool, blocks, clusters, saveResults);
    } catch (e) {
      logger.err('updateBlockTemplates failed. ' + (e instanceof Error ? e.message : e));
    }
  }

  private processBlockTemplates(mempool, blocks, clusters, saveResults): MempoolBlockWithTransactions[] {
    // update this thread's mempool with the results
    blocks.forEach(block => {
      block.forEach(tx => {
        if (tx.txid in mempool) {
          if (tx.effectiveFeePerVsize != null) {
            mempool[tx.txid].effectiveFeePerVsize = tx.effectiveFeePerVsize;
          }
          if (tx.cpfpRoot && tx.cpfpRoot in clusters) {
            const ancestors: Ancestor[] = [];
            const descendants: Ancestor[] = [];
            const cluster = clusters[tx.cpfpRoot];
            let matched = false;
            cluster.forEach(txid => {
              if (txid === tx.txid) {
                matched = true;
              } else {
                const relative = {
                  txid: txid,
                  fee: mempool[txid].fee,
                  weight: mempool[txid].weight,
                };
                if (matched) {
                  descendants.push(relative);
                } else {
                  ancestors.push(relative);
                }
              }
            });
            mempool[tx.txid].ancestors = ancestors;
            mempool[tx.txid].descendants = descendants;
            mempool[tx.txid].bestDescendant = null;
          }
          mempool[tx.txid].cpfpChecked = tx.cpfpChecked;
        }
      });
    });

    // unpack the condensed blocks into proper mempool blocks
    const mempoolBlocks = blocks.map((transactions, blockIndex) => {
      return this.dataToMempoolBlocks(transactions.map(tx => {
        return mempool[tx.txid] || null;
      }).filter(tx => !!tx), undefined, undefined, blockIndex);
    });

    if (saveResults) {
      const deltas = this.calculateMempoolDeltas(this.mempoolBlocks, mempoolBlocks);
      this.mempoolBlocks = mempoolBlocks;
      this.mempoolBlockDeltas = deltas;
    }

    return mempoolBlocks;
  }

  private dataToMempoolBlocks(transactions: TransactionExtended[],
    blockSize: number | undefined, blockWeight: number | undefined, blocksIndex: number): MempoolBlockWithTransactions {
    let totalSize = blockSize || 0;
    let totalWeight = blockWeight || 0;
    if (blockSize === undefined && blockWeight === undefined) {
      totalSize = 0;
      totalWeight = 0;
      transactions.forEach(tx => {
        totalSize += tx.size;
        totalWeight += tx.weight;
      });
    }
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
      blockSize: totalSize,
      blockVSize: totalWeight / 4,
      nTx: transactions.length,
      totalFees: transactions.reduce((acc, cur) => acc + cur.fee, 0),
      medianFee: Common.percentile(transactions.map((tx) => tx.effectiveFeePerVsize), config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE),
      feeRange: Common.getFeesInRange(transactions, rangeLength),
      transactionIds: transactions.map((tx) => tx.txid),
      transactions: transactions.map((tx) => Common.stripTransaction(tx)),
    };
  }
}

export default new MempoolBlocks();
