import { GbtGenerator } from '../../rust-gbt';
import logger from '../logger';
import { MempoolBlock, MempoolTransactionExtended, TransactionStripped, MempoolBlockWithTransactions, MempoolBlockDelta, Ancestor, CompactThreadTransaction, EffectiveFeeStats, AuditTransaction } from '../mempool.interfaces';
import { Common, OnlineFeeStatsCalculator } from './common';
import config from '../config';
import { Worker } from 'worker_threads';
import path from 'path';

const MAX_UINT32 = Math.pow(2, 32) - 1;

class MempoolBlocks {
  private mempoolBlocks: MempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: MempoolBlockDelta[] = [];
  private txSelectionWorker: Worker | null = null;
  private rustInitialized: boolean = false;
  private rustGbtGenerator: GbtGenerator = new GbtGenerator();

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

  public updateMempoolBlocks(memPool: { [txid: string]: MempoolTransactionExtended }, saveResults: boolean = false): MempoolBlockWithTransactions[] {
    const latestMempool = memPool;
    const memPoolArray: MempoolTransactionExtended[] = [];
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
        tx.effectiveFeePerVsize = tx.adjustedFeePerVsize;
      }
    });

    // First sort
    memPoolArray.sort((a, b) => {
      if (a.adjustedFeePerVsize === b.adjustedFeePerVsize) {
        // tie-break by lexicographic txid order for stability
        return a.txid < b.txid ? -1 : 1;
      } else {
        return b.adjustedFeePerVsize - a.adjustedFeePerVsize;
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

  private calculateMempoolBlocks(transactionsSorted: MempoolTransactionExtended[]): MempoolBlockWithTransactions[] {
    const mempoolBlocks: MempoolBlockWithTransactions[] = [];
    let feeStatsCalculator: OnlineFeeStatsCalculator = new OnlineFeeStatsCalculator(config.MEMPOOL.BLOCK_WEIGHT_UNITS);
    let onlineStats = false;
    let blockSize = 0;
    let blockWeight = 0;
    let blockVsize = 0;
    let blockFees = 0;
    const sizeLimit = (config.MEMPOOL.BLOCK_WEIGHT_UNITS / 4) * 1.2;
    let transactionIds: string[] = [];
    let transactions: MempoolTransactionExtended[] = [];
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

  public async $makeBlockTemplates(newMempool: { [txid: string]: MempoolTransactionExtended }, saveResults: boolean = false): Promise<MempoolBlockWithTransactions[]> {
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
        const stripped = {
          uid: entry.uid,
          fee: entry.fee,
          weight: (entry.adjustedVsize * 4),
          sigops: entry.sigops,
          feePerVsize: entry.adjustedFeePerVsize || entry.feePerVsize,
          effectiveFeePerVsize: entry.effectiveFeePerVsize || entry.adjustedFeePerVsize || entry.feePerVsize,
          inputs: entry.vin.map(v => this.getUid(newMempool[v.txid])).filter(uid => uid != null) as number[],
        };
        strippedMempool.set(entry.uid, stripped);
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

  public async $updateBlockTemplates(newMempool: { [txid: string]: MempoolTransactionExtended }, added: MempoolTransactionExtended[], removed: MempoolTransactionExtended[], saveResults: boolean = false): Promise<void> {
    if (!this.txSelectionWorker) {
      // need to reset the worker
      await this.$makeBlockTemplates(newMempool, saveResults);
      return;
    }

    const start = Date.now();

    for (const tx of Object.values(added)) {
      this.setUid(tx, true);
    }
    const removedUids = removed.map(tx => this.getUid(tx)).filter(uid => uid != null) as number[];
    // prepare a stripped down version of the mempool with only the minimum necessary data
    // to reduce the overhead of passing this data to the worker thread
    const addedStripped: CompactThreadTransaction[] = added.filter(entry => entry.uid != null).map(entry => {
      return {
        uid: entry.uid || 0,
        fee: entry.fee,
        weight: (entry.adjustedVsize * 4),
        sigops: entry.sigops,
        feePerVsize: entry.adjustedFeePerVsize || entry.feePerVsize,
        effectiveFeePerVsize: entry.effectiveFeePerVsize || entry.adjustedFeePerVsize || entry.feePerVsize,
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

  private resetRustGbt(): void {
    this.rustInitialized = false;
    this.rustGbtGenerator = new GbtGenerator();
  }

  private async $rustMakeBlockTemplates(newMempool: { [txid: string]: MempoolTransactionExtended }, saveResults: boolean = false): Promise<MempoolBlockWithTransactions[]> {
    const start = Date.now();

    // reset mempool short ids
    if (saveResults) {
      this.resetUids();
    }
    // set missing short ids
    for (const tx of Object.values(newMempool)) {
      this.setUid(tx, !saveResults);
    }

    // serialize relevant mempool data into an ArrayBuffer
    // to reduce the overhead of passing this data to the rust thread
    const mempoolBuffer = this.mempoolToArrayBuffer(Object.values(newMempool), newMempool);

    // run the block construction algorithm in a separate thread, and wait for a result
    const rustGbt = saveResults ? this.rustGbtGenerator : new GbtGenerator();
    try {
      const { blocks, rates, clusters } = this.convertNapiResultTxids(
        await rustGbt.make(new Uint8Array(mempoolBuffer)),
      );
      if (saveResults) {
        this.rustInitialized = true;
      }
      const processed = this.processBlockTemplates(newMempool, blocks, rates, clusters, saveResults);
      logger.debug(`RUST makeBlockTemplates completed in ${(Date.now() - start)/1000} seconds`);
      return processed;
    } catch (e) {
      logger.err('RUST makeBlockTemplates failed. ' + (e instanceof Error ? e.message : e));
      if (saveResults) {
        this.resetRustGbt();
      }
    }
    return this.mempoolBlocks;
  }

  public async $oneOffRustBlockTemplates(newMempool: { [txid: string]: MempoolTransactionExtended }): Promise<MempoolBlockWithTransactions[]> {
    return this.$rustMakeBlockTemplates(newMempool, false);
  }

  public async $rustUpdateBlockTemplates(newMempool: { [txid: string]: MempoolTransactionExtended }, added: MempoolTransactionExtended[], removed: MempoolTransactionExtended[]): Promise<void> {
    // sanity check to avoid approaching uint32 uid overflow
    if (this.nextUid + added.length > MAX_UINT32) {
      this.resetRustGbt();
    }
    if (!this.rustInitialized) {
      // need to reset the worker
      await this.$rustMakeBlockTemplates(newMempool, true);
      return;
    }

    const start = Date.now();

    for (const tx of Object.values(added)) {
      this.setUid(tx, true);
    }
    const removedUids = removed.map(tx => this.getUid(tx)).filter(uid => uid != null) as number[];
    // serialize relevant mempool data into an ArrayBuffer
    // to reduce the overhead of passing this data to the rust thread
    const addedBuffer = this.mempoolToArrayBuffer(added, newMempool);
    const removedBuffer = this.uidsToArrayBuffer(removedUids);

    // run the block construction algorithm in a separate thread, and wait for a result
    try {
      const { blocks, rates, clusters } = this.convertNapiResultTxids(
        await this.rustGbtGenerator.update(
            new Uint8Array(addedBuffer),
            new Uint8Array(removedBuffer),
        ),
      );
      const expectedMempoolSize = Object.keys(newMempool).length;
      const actualMempoolSize = blocks.reduce((total, block) => total + block.length, 0);
      if (expectedMempoolSize !== actualMempoolSize) {
        throw new Error('GBT returned wrong number of transactions, cache is probably out of sync');
      } else {
        this.processBlockTemplates(newMempool, blocks, rates, clusters, true);
      }
      logger.debug(`RUST updateBlockTemplates completed in ${(Date.now() - start)/1000} seconds`);
    } catch (e) {
      logger.err('RUST updateBlockTemplates failed. ' + (e instanceof Error ? e.message : e));
      this.resetRustGbt();
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
      let mempoolTx: MempoolTransactionExtended;
      let totalSize = 0;
      let totalVsize = 0;
      let totalWeight = 0;
      let totalFees = 0;
      const transactions: MempoolTransactionExtended[] = [];
      for (let txIndex = 0; txIndex < block.length; txIndex++) {
        txid = block[txIndex];
        if (txid) {
          mempoolTx = mempool[txid];
          // save position in projected blocks
          mempoolTx.position = {
            block: blockIndex,
            vsize: totalVsize + (mempoolTx.vsize / 2),
          };
          mempoolTx.ancestors = [];
          mempoolTx.descendants = [];
          mempoolTx.bestDescendant = null;
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
                weight: (mempool[txid].adjustedVsize * 4),
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

  private dataToMempoolBlocks(transactionIds: string[], transactions: MempoolTransactionExtended[], totalSize: number, totalWeight: number, totalFees: number, feeStats?: EffectiveFeeStats ): MempoolBlockWithTransactions {
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

  private setUid(tx: MempoolTransactionExtended, skipSet = false): number {
    if (tx.uid == null || !skipSet) {
      const uid = this.nextUid;
      this.nextUid++;
      this.uidMap.set(uid, tx.txid);
      tx.uid = uid;
      return uid;
    } else {
      return tx.uid;
    }
  }

  private getUid(tx: MempoolTransactionExtended): number | void {
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

  private convertNapiResultTxids({ blocks, rates, clusters }: { blocks: number[][], rates: number[][], clusters: number[][]})
    : { blocks: string[][], rates: { [root: string]: number }, clusters: { [root: string]: string[] }} {
    const rateMap = new Map<number, number>();
    const clusterMap = new Map<number, number[]>();
    for (const rate of rates) {
      rateMap.set(rate[0], rate[1]);
    }
    for (const cluster of clusters) {
      clusterMap.set(cluster[0], cluster);
    }
    const convertedBlocks: string[][] = blocks.map(block => block.map(uid => {
      const txid = this.uidMap.get(uid);
      if (txid !== undefined) {
        return txid;
      } else {
        throw new Error('GBT returned a block containing a transaction with unknown uid');
      }
    }));
    const convertedRates = {};
    for (const rateUid of rateMap.keys()) {
      const rateTxid = this.uidMap.get(rateUid);
      if (rateTxid !== undefined) {
        convertedRates[rateTxid] = rateMap.get(rateUid);
      } else {
        throw new Error('GBT returned a fee rate for a transaction with unknown uid');
      }
    }
    const convertedClusters = {};
    for (const rootUid of clusterMap.keys()) {
      const rootTxid = this.uidMap.get(rootUid);
      if (rootTxid !== undefined) {
        const members = clusterMap.get(rootUid)?.map(uid => {
          return this.uidMap.get(uid);
        });
        convertedClusters[rootTxid] = members;
      } else {
        throw new Error('GBT returned a cluster rooted in a transaction with unknown uid');
      }
    }
    return { blocks: convertedBlocks, rates: convertedRates, clusters: convertedClusters } as { blocks: string[][], rates: { [root: string]: number }, clusters: { [root: string]: string[] }};
  }

  private mempoolToArrayBuffer(txs: MempoolTransactionExtended[], mempool: { [txid: string]: MempoolTransactionExtended }): ArrayBuffer {
    let len = 4;
    const inputs: { [uid: number]: number[] } = {};
    let validCount = 0;
    for (const tx of txs) {
      if (tx.uid != null) {
        validCount++;
        const txInputs = tx.vin.map(v => this.getUid(mempool[v.txid])).filter(uid => uid != null) as number[];
        inputs[tx.uid] = txInputs;
        len += (10 + txInputs.length) * 4;
      }
    }
    const buf = new ArrayBuffer(len);
    const view = new DataView(buf);
    view.setUint32(0, validCount, false);
    let offset = 4;
    for (const tx of txs) {
      if (tx.uid != null) {
        view.setUint32(offset, tx.uid, false);
        view.setFloat64(offset + 4, tx.fee, false);
        view.setUint32(offset + 12, (tx.adjustedVsize * 4), false);
        view.setUint32(offset + 16, tx.sigops, false);
        view.setFloat64(offset + 20, (tx.adjustedFeePerVsize || tx.feePerVsize), false);
        view.setFloat64(offset + 28, (tx.effectiveFeePerVsize || tx.adjustedFeePerVsize || tx.feePerVsize), false);
        view.setUint32(offset + 36, inputs[tx.uid].length, false);
        offset += 40;
        for (const input of inputs[tx.uid]) {
          view.setUint32(offset, input, false);
          offset += 4;
        }
      }
    }
    return buf;
  }

  private uidsToArrayBuffer(uids: number[]): ArrayBuffer {
    let len = (uids.length + 1) * 4;
    const buf = new ArrayBuffer(len);
    const view = new DataView(buf);
    view.setUint32(0, uids.length, false);
    let offset = 4;
    for (const uid of uids) {
      view.setUint32(offset, uid, false);
      offset += 4;
    }
    return buf;
  }
}

export default new MempoolBlocks();
