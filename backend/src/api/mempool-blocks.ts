import logger from '../logger';
import { MempoolBlock, TransactionExtended, TransactionStripped, MempoolBlockWithTransactions, MempoolBlockDelta, Ancestor, CompactThreadTransaction, EffectiveFeeStats } from '../mempool.interfaces';
import { Common, OnlineFeeStatsCalculator } from './common';
import config from '../config';
import { Worker } from 'worker_threads';
import path from 'path';

class MempoolBlocks {
  private mempoolBlocks: MempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: MempoolBlockDelta[] = [];
  private txSelectionWorker: Worker | null = null;

  private nextUid: number = 1;
  private uidMap: Map<number, string> = new Map(); // map short numerical uids to full txids

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
    memPoolArray.sort((a, b) => {
      if (a.feePerVsize === b.feePerVsize) {
        // tie-break by lexicographic txid order for stability
        return a.txid < b.txid ? -1 : 1;
      } else {
        return b.feePerVsize - a.feePerVsize;
      }
    });

    // Loop through and traverse all ancestors and sum up all the sizes + fees
    // Pass down size + fee to all unconfirmed children
    let sizes = 0;
    memPoolArray.forEach((tx) => {
      sizes += tx.weight;
      if (sizes > 4000000 * 8) {
        return;
      }
      Common.setRelativesAndGetCpfpInfo(tx, memPool);
    });

    // Final sort, by effective fee
    memPoolArray.sort((a, b) => {
      if (a.effectiveFeePerVsize === b.effectiveFeePerVsize) {
        // tie-break by lexicographic txid order for stability
        return a.txid < b.txid ? -1 : 1;
      } else {
        return b.effectiveFeePerVsize - a.effectiveFeePerVsize;
      }
    });

    const end = new Date().getTime();
    const time = end - start;
    logger.debug('Mempool blocks calculated in ' + time / 1000 + ' seconds');

    const blocks = this.calculateMempoolBlocks(memPoolArray);

    if (saveResults) {
      const deltas = this.calculateMempoolDeltas(this.mempoolBlocks, blocks);
      this.mempoolBlocks = blocks;
      this.mempoolBlockDeltas = deltas;
    }

    return blocks;
  }

  private calculateMempoolBlocks(transactionsSorted: TransactionExtended[]): MempoolBlockWithTransactions[] {
    const mempoolBlocks: MempoolBlockWithTransactions[] = [];
    let feeStatsCalculator: OnlineFeeStatsCalculator = new OnlineFeeStatsCalculator(config.MEMPOOL.BLOCK_WEIGHT_UNITS);
    let onlineStats = false;
    let blockSize = 0;
    let blockWeight = 0;
    let blockVsize = 0;
    let blockFees = 0;
    const sizeLimit = (config.MEMPOOL.BLOCK_WEIGHT_UNITS / 4) * 1.2;
    let transactionIds: string[] = [];
    let transactions: TransactionExtended[] = [];
    transactionsSorted.forEach((tx, index) => {
      if (blockWeight + tx.weight <= config.MEMPOOL.BLOCK_WEIGHT_UNITS
        || mempoolBlocks.length === config.MEMPOOL.MEMPOOL_BLOCKS_AMOUNT - 1) {
        tx.position = {
          block: mempoolBlocks.length,
          vsize: blockVsize + (tx.vsize / 2),
        };
        blockWeight += tx.weight;
        blockVsize += tx.vsize;
        blockSize += tx.size;
        blockFees += tx.fee;
        if (blockVsize <= sizeLimit) {
          transactions.push(tx);
        }
        transactionIds.push(tx.txid);
        if (onlineStats) {
          feeStatsCalculator.processNext(tx);
        }
      } else {
        mempoolBlocks.push(this.dataToMempoolBlocks(transactionIds, transactions, blockSize, blockWeight, blockFees));
        blockVsize = 0;
        tx.position = {
          block: mempoolBlocks.length,
          vsize: blockVsize + (tx.vsize / 2),
        };

        if (mempoolBlocks.length === config.MEMPOOL.MEMPOOL_BLOCKS_AMOUNT - 1) {
          const stackWeight = transactionsSorted.slice(index).reduce((total, tx) => total + (tx.weight || 0), 0);
          if (stackWeight > config.MEMPOOL.BLOCK_WEIGHT_UNITS) {
            onlineStats = true;
            feeStatsCalculator = new OnlineFeeStatsCalculator(stackWeight, 0.5);
            feeStatsCalculator.processNext(tx);
          }
        }

        blockVsize += tx.vsize;
        blockWeight = tx.weight;
        blockSize = tx.size;
        blockFees = tx.fee;
        transactionIds = [tx.txid];
        transactions = [tx];
      }
    });
    if (transactions.length) {
      const feeStats = onlineStats ? feeStatsCalculator.getRawFeeStats() : undefined;
      mempoolBlocks.push(this.dataToMempoolBlocks(transactionIds, transactions, blockSize, blockWeight, blockFees, feeStats));
    }

    return mempoolBlocks;
  }

  private calculateMempoolDeltas(prevBlocks: MempoolBlockWithTransactions[], mempoolBlocks: MempoolBlockWithTransactions[]): MempoolBlockDelta[] {
    const mempoolBlockDeltas: MempoolBlockDelta[] = [];
    for (let i = 0; i < Math.max(mempoolBlocks.length, prevBlocks.length); i++) {
      let added: TransactionStripped[] = [];
      let removed: string[] = [];
      const changed: { txid: string, rate: number | undefined }[] = [];
      if (mempoolBlocks[i] && !prevBlocks[i]) {
        added = mempoolBlocks[i].transactions;
      } else if (!mempoolBlocks[i] && prevBlocks[i]) {
        removed = prevBlocks[i].transactions.map(tx => tx.txid);
      } else if (mempoolBlocks[i] && prevBlocks[i]) {
        const prevIds = {};
        const newIds = {};
        prevBlocks[i].transactions.forEach(tx => {
          prevIds[tx.txid] = tx;
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
          } else if (tx.rate !== prevIds[tx.txid].rate) {
            changed.push({ txid: tx.txid, rate: tx.rate });
          }
        });
      }
      mempoolBlockDeltas.push({
        added,
        removed,
        changed,
      });
    }
    return mempoolBlockDeltas;
  }

  public async $makeBlockTemplates(newMempool: { [txid: string]: TransactionExtended }, saveResults: boolean = false): Promise<MempoolBlockWithTransactions[]> {
    const start = Date.now();

    // reset mempool short ids
    this.resetUids();
    for (const tx of Object.values(newMempool)) {
      this.setUid(tx);
    }

    // prepare a stripped down version of the mempool with only the minimum necessary data
    // to reduce the overhead of passing this data to the worker thread
    const strippedMempool: Map<number, CompactThreadTransaction> = new Map();
    Object.values(newMempool).forEach(entry => {
      if (entry.uid != null) {
        strippedMempool.set(entry.uid, {
          uid: entry.uid,
          fee: entry.fee,
          weight: entry.weight,
          feePerVsize: entry.fee / (entry.weight / 4),
          effectiveFeePerVsize: entry.effectiveFeePerVsize || (entry.fee / (entry.weight / 4)),
          inputs: entry.vin.map(v => this.getUid(newMempool[v.txid])).filter(uid => uid != null) as number[],
        });
      }
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
      const workerResultPromise = new Promise<{ blocks: number[][], rates: Map<number, number>, clusters: Map<number, number[]> }>((resolve, reject) => {
        threadErrorListener = reject;
        this.txSelectionWorker?.once('message', (result): void => {
          resolve(result);
        });
        this.txSelectionWorker?.once('error', reject);
      });
      this.txSelectionWorker.postMessage({ type: 'set', mempool: strippedMempool });
      const { blocks, rates, clusters } = this.convertResultTxids(await workerResultPromise);

      // clean up thread error listener
      this.txSelectionWorker?.removeListener('error', threadErrorListener);

      const processed = this.processBlockTemplates(newMempool, blocks, rates, clusters, saveResults);
      logger.debug(`makeBlockTemplates completed in ${(Date.now() - start)/1000} seconds`);
      return processed;
    } catch (e) {
      logger.err('makeBlockTemplates failed. ' + (e instanceof Error ? e.message : e));
    }
    return this.mempoolBlocks;
  }

  public async $updateBlockTemplates(newMempool: { [txid: string]: TransactionExtended }, added: TransactionExtended[], removed: TransactionExtended[], saveResults: boolean = false): Promise<void> {
    if (!this.txSelectionWorker) {
      // need to reset the worker
      await this.$makeBlockTemplates(newMempool, saveResults);
      return;
    }

    const start = Date.now();

    for (const tx of Object.values(added)) {
      this.setUid(tx);
    }
    const removedUids = removed.map(tx => this.getUid(tx)).filter(uid => uid != null) as number[];
    // prepare a stripped down version of the mempool with only the minimum necessary data
    // to reduce the overhead of passing this data to the worker thread
    const addedStripped: CompactThreadTransaction[] = added.filter(entry => entry.uid != null).map(entry => {
      return {
        uid: entry.uid || 0,
        fee: entry.fee,
        weight: entry.weight,
        feePerVsize: entry.fee / (entry.weight / 4),
        effectiveFeePerVsize: entry.effectiveFeePerVsize || (entry.fee / (entry.weight / 4)),
        inputs: entry.vin.map(v => this.getUid(newMempool[v.txid])).filter(uid => uid != null) as number[],
      };
    });

    // run the block construction algorithm in a separate thread, and wait for a result
    let threadErrorListener;
    try {
      const workerResultPromise = new Promise<{ blocks: number[][], rates: Map<number, number>, clusters: Map<number, number[]> }>((resolve, reject) => {
        threadErrorListener = reject;
        this.txSelectionWorker?.once('message', (result): void => {
          resolve(result);
        });
        this.txSelectionWorker?.once('error', reject);
      });
      this.txSelectionWorker.postMessage({ type: 'update', added: addedStripped, removed: removedUids });
      const { blocks, rates, clusters } = this.convertResultTxids(await workerResultPromise);

      this.removeUids(removedUids);

      // clean up thread error listener
      this.txSelectionWorker?.removeListener('error', threadErrorListener);

      this.processBlockTemplates(newMempool, blocks, rates, clusters, saveResults);
      logger.debug(`updateBlockTemplates completed in ${(Date.now() - start) / 1000} seconds`);
    } catch (e) {
      logger.err('updateBlockTemplates failed. ' + (e instanceof Error ? e.message : e));
    }
  }

  private processBlockTemplates(mempool, blocks: string[][], rates: { [root: string]: number }, clusters: { [root: string]: string[] }, saveResults): MempoolBlockWithTransactions[] {
    for (const txid of Object.keys(rates)) {
      if (txid in mempool) {
        mempool[txid].effectiveFeePerVsize = rates[txid];
      }
    }

    let hasBlockStack = blocks.length >= 8;
    let stackWeight;
    let feeStatsCalculator: OnlineFeeStatsCalculator | void;
    if (hasBlockStack) {
      stackWeight = blocks[blocks.length - 1].reduce((total, tx) => total + (mempool[tx]?.weight || 0), 0);
      hasBlockStack = stackWeight > config.MEMPOOL.BLOCK_WEIGHT_UNITS;
      feeStatsCalculator = new OnlineFeeStatsCalculator(stackWeight, 0.5);
    }

    const readyBlocks: { transactionIds, transactions, totalSize, totalWeight, totalFees, feeStats }[] = [];
    const sizeLimit = (config.MEMPOOL.BLOCK_WEIGHT_UNITS / 4) * 1.2;
    // update this thread's mempool with the results
    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block: string[] = blocks[blockIndex];
      let txid: string;
      let mempoolTx: TransactionExtended;
      let totalSize = 0;
      let totalVsize = 0;
      let totalWeight = 0;
      let totalFees = 0;
      const transactions: TransactionExtended[] = [];
      for (let txIndex = 0; txIndex < block.length; txIndex++) {
        txid = block[txIndex];
        if (txid) {
          mempoolTx = mempool[txid];
          // save position in projected blocks
          mempoolTx.position = {
            block: blockIndex,
            vsize: totalVsize + (mempoolTx.vsize / 2),
          };
          mempoolTx.cpfpChecked = true;

          // online calculation of stack-of-blocks fee stats
          if (hasBlockStack && blockIndex === blocks.length - 1 && feeStatsCalculator) {
            feeStatsCalculator.processNext(mempoolTx);
          }

          totalSize += mempoolTx.size;
          totalVsize += mempoolTx.vsize;
          totalWeight += mempoolTx.weight;
          totalFees += mempoolTx.fee;

          if (totalVsize <= sizeLimit) {
            transactions.push(mempoolTx);
          }
        }
      }
      readyBlocks.push({
        transactionIds: block,
        transactions,
        totalSize,
        totalWeight,
        totalFees,
        feeStats: (hasBlockStack && blockIndex === blocks.length - 1 && feeStatsCalculator) ? feeStatsCalculator.getRawFeeStats() : undefined,
      });
    }

    for (const cluster of Object.values(clusters)) {
      for (const memberTxid of cluster) {
        if (memberTxid in mempool) {
          const mempoolTx = mempool[memberTxid];
          const ancestors: Ancestor[] = [];
          const descendants: Ancestor[] = [];
          let matched = false;
          cluster.forEach(txid => {
            if (txid === memberTxid) {
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
          mempoolTx.ancestors = ancestors;
          mempoolTx.descendants = descendants;
          mempoolTx.bestDescendant = null;
        }
      }
    }

    const mempoolBlocks = readyBlocks.map((b, index) => {
      return this.dataToMempoolBlocks(b.transactionIds, b.transactions, b.totalSize, b.totalWeight, b.totalFees, b.feeStats);
    });

    if (saveResults) {
      const deltas = this.calculateMempoolDeltas(this.mempoolBlocks, mempoolBlocks);
      this.mempoolBlocks = mempoolBlocks;
      this.mempoolBlockDeltas = deltas;
    }

    return mempoolBlocks;
  }

  private dataToMempoolBlocks(transactionIds: string[], transactions: TransactionExtended[], totalSize: number, totalWeight: number, totalFees: number, feeStats?: EffectiveFeeStats ): MempoolBlockWithTransactions {
    if (!feeStats) {
      feeStats = Common.calcEffectiveFeeStatistics(transactions);
    }
    return {
      blockSize: totalSize,
      blockVSize: (totalWeight / 4), // fractional vsize to avoid rounding errors
      nTx: transactionIds.length,
      totalFees: totalFees,
      medianFee: feeStats.medianFee, // Common.percentile(transactions.map((tx) => tx.effectiveFeePerVsize), config.MEMPOOL.RECOMMENDED_FEE_PERCENTILE),
      feeRange: feeStats.feeRange, //Common.getFeesInRange(transactions, rangeLength),
      transactionIds: transactionIds,
      transactions: transactions.map((tx) => Common.stripTransaction(tx)),
    };
  }

  private resetUids(): void {
    this.uidMap.clear();
    this.nextUid = 1;
  }

  private setUid(tx: TransactionExtended): number {
    const uid = this.nextUid;
    this.nextUid++;
    this.uidMap.set(uid, tx.txid);
    tx.uid = uid;
    return uid;
  }

  private getUid(tx: TransactionExtended): number | void {
    if (tx?.uid != null && this.uidMap.has(tx.uid)) {
      return tx.uid;
    }
  }

  private removeUids(uids: number[]): void {
    for (const uid of uids) {
      this.uidMap.delete(uid);
    }
  }

  private convertResultTxids({ blocks, rates, clusters }: { blocks: number[][], rates: Map<number, number>, clusters: Map<number, number[]>})
    : { blocks: string[][], rates: { [root: string]: number }, clusters: { [root: string]: string[] }} {
    const convertedBlocks: string[][] = blocks.map(block => block.map(uid => {
      return this.uidMap.get(uid) || '';
    }));
    const convertedRates = {};
    for (const rateUid of rates.keys()) {
      const rateTxid = this.uidMap.get(rateUid);
      if (rateTxid) {
        convertedRates[rateTxid] = rates.get(rateUid);
      }
    }
    const convertedClusters = {};
    for (const rootUid of clusters.keys()) {
      const rootTxid = this.uidMap.get(rootUid);
      if (rootTxid) {
        const members = clusters.get(rootUid)?.map(uid => {
          return this.uidMap.get(uid);
        });
        convertedClusters[rootTxid] = members;
      }
    }
    return { blocks: convertedBlocks, rates: convertedRates, clusters: convertedClusters } as { blocks: string[][], rates: { [root: string]: number }, clusters: { [root: string]: string[] }};
  }
}

export default new MempoolBlocks();
