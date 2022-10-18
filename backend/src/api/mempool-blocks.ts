import logger from '../logger';
import { MempoolBlock, TransactionExtended, TransactionStripped, MempoolBlockWithTransactions, MempoolBlockDelta, TransactionSet, Ancestor } from '../mempool.interfaces';
import { Common } from './common';
import config from '../config';

class MempoolBlocks {
  private mempoolBlocks: MempoolBlockWithTransactions[] = [];
  private mempoolBlockDeltas: MempoolBlockDelta[] = [];

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

    const { blocks, deltas } = this.calculateMempoolBlocks(memPoolArray, this.mempoolBlocks);
    this.mempoolBlocks = blocks;
    this.mempoolBlockDeltas = deltas;
  }

  private calculateMempoolBlocks(transactionsSorted: TransactionExtended[], prevBlocks: MempoolBlockWithTransactions[]):
    { blocks: MempoolBlockWithTransactions[], deltas: MempoolBlockDelta[] } {
    const mempoolBlocks: MempoolBlockWithTransactions[] = [];
    const mempoolBlockDeltas: MempoolBlockDelta[] = [];
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

    // Calculate change from previous block states
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

    return {
      blocks: mempoolBlocks,
      deltas: mempoolBlockDeltas
    };
  }

  /*
  * Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core
  * (see BlockAssembler in https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp)
  *
  * templateLimit: number of blocks to build using the full algo,
  *     remaining blocks up to blockLimit will skip the expensive updateDescendants step
  *
  * blockLimit: number of blocks to build in total. Excess transactions will be ignored.
  */
  public makeBlockTemplates(mempool: { [txid: string]: TransactionExtended }, templateLimit: number = Infinity, blockLimit: number = Infinity): MempoolBlockWithTransactions[] {
    const start = new Date().getTime();
    const txSets: { [txid: string]: TransactionSet } = {};
    const mempoolArray: TransactionExtended[] = Object.values(mempool);

    mempoolArray.forEach((tx) => {
      tx.bestDescendant = null;
      tx.ancestors = [];
      tx.cpfpChecked = false;
      tx.effectiveFeePerVsize = tx.feePerVsize;
      txSets[tx.txid] = {
        fee: 0,
        weight: 1,
        score: 0,
        children: [],
        available: true,
        modified: false,
      };
    });

    // Build relatives graph & calculate ancestor scores
    mempoolArray.forEach((tx) => {
      this.setRelatives(tx, mempool, txSets);
    });

    // Sort by descending ancestor score
    const byAncestor = (a, b): number => this.sortByAncestorScore(a, b, txSets);
    mempoolArray.sort(byAncestor);

    // Build blocks by greedily choosing the highest feerate package
    // (i.e. the package rooted in the transaction with the best ancestor score)
    const blocks: MempoolBlockWithTransactions[] = [];
    let blockWeight = 4000;
    let blockSize = 0;
    let transactions: TransactionExtended[] = [];
    let modified: TransactionExtended[] = [];
    let overflow: TransactionExtended[] = [];
    let failures = 0;
    while ((mempoolArray.length || modified.length) && blocks.length < blockLimit) {
      const simpleMode = blocks.length >= templateLimit;
      let anyModified = false;
      // Select best next package
      let nextTx;
      if (mempoolArray.length && (!modified.length || txSets[mempoolArray[0].txid]?.score > txSets[modified[0].txid]?.score)) {
        nextTx = mempoolArray.shift();
        if (txSets[nextTx?.txid]?.modified) {
          nextTx = null;
        }
      } else {
        nextTx = modified.shift();
      }

      if (nextTx && txSets[nextTx.txid]?.available) {
        const nextTxSet = txSets[nextTx.txid];
        // Check if the package fits into this block
        if (nextTxSet && blockWeight + nextTxSet.weight < config.MEMPOOL.BLOCK_WEIGHT_UNITS) {
          blockWeight += nextTxSet.weight;
          // sort txSet by dependency graph (equivalent to sorting by ascending ancestor count)
          const sortedTxSet = [...nextTx.ancestors.sort((a, b) => {
            return (mempool[a.txid]?.ancestors?.length || 0) - (mempool[b.txid]?.ancestors?.length || 0);
          }), nextTx];
          sortedTxSet.forEach((ancestor, i, arr) => {
            const tx = mempool[ancestor.txid];
            const txSet = txSets[ancestor.txid];
            if (txSet.available) {
              txSet.available = false;
              tx.effectiveFeePerVsize = nextTxSet.fee / (nextTxSet.weight / 4);
              tx.cpfpChecked = true;
              if (i < arr.length - 1) {
                tx.bestDescendant = {
                  txid: arr[i + 1].txid,
                  fee: arr[i + 1].fee,
                  weight: arr[i + 1].weight,
                };
              }
              transactions.push(tx);
              blockSize += tx.size;
            }
          });

          // remove these as valid package ancestors for any remaining descendants
          if (!simpleMode) {
            sortedTxSet.forEach(tx => {
              anyModified = this.updateDescendants(tx, tx, mempool, txSets, modified);
            });
          }

          failures = 0;
        } else {
          // hold this package in an overflow list while we check for smaller options
          txSets[nextTx.txid].modified = true;
          overflow.push(nextTx);
          failures++;
        }
      }

      // this block is full
      const outOfTransactions = !mempoolArray.length && !modified.length;
      const exceededPackageTries = failures > 1000 && blockWeight > (config.MEMPOOL.BLOCK_WEIGHT_UNITS - 4000);
      const exceededSimpleTries = failures > 0 && simpleMode;
      if (outOfTransactions || exceededPackageTries || exceededSimpleTries) {
        // construct this block
        blocks.push(this.dataToMempoolBlocks(transactions, blockSize, blockWeight, blocks.length));
        // reset for the next block
        transactions = [];
        blockSize = 0;
        blockWeight = 4000;

        // 'overflow' packages didn't fit in this block, but are valid candidates for the next
        if (overflow.length) {
          modified = modified.concat(overflow);
          overflow = [];
          anyModified = true;
        }
      }

      // re-sort modified list if necessary
      if (anyModified) {
        modified = modified.filter(tx => txSets[tx.txid]?.available).sort(byAncestor);
      }
    }

    const end = new Date().getTime();
    const time = end - start;
    logger.debug('Mempool templates calculated in ' + time / 1000 + ' seconds');

    return blocks;
  }

  private sortByAncestorScore(a, b, txSets): number {
    return txSets[b.txid]?.score - txSets[a.txid]?.score;
  }

  private setRelatives(tx: TransactionExtended, mempool: { [txid: string]: TransactionExtended }, txSets: { [txid: string]: TransactionSet }): { [txid: string]: Ancestor } {
    let ancestors: { [txid: string]: Ancestor } = {};
    tx.vin.forEach((parent) => {
      const parentTx = mempool[parent.txid];
      const parentTxSet = txSets[parent.txid];
      if (parentTx && parentTxSet) {
        ancestors[parentTx.txid] = parentTx;
        if (!parentTxSet.children) {
          parentTxSet.children = [tx.txid];
        } else {
          parentTxSet.children.push(tx.txid);
        }
        if (!parentTxSet.score) {
          ancestors = {
            ...ancestors,
            ...this.setRelatives(parentTx, mempool, txSets),
          };
        }
      }
    });
    tx.ancestors = Object.values(ancestors).map(ancestor => {
      return {
        txid: ancestor.txid,
        fee: ancestor.fee,
        weight: ancestor.weight
      };
    });
    let totalFees = tx.fee;
    let totalWeight = tx.weight;
    tx.ancestors.forEach(ancestor => {
      totalFees += ancestor.fee;
      totalWeight += ancestor.weight;
    });
    txSets[tx.txid].fee = totalFees;
    txSets[tx.txid].weight = totalWeight;
    txSets[tx.txid].score = this.calcAncestorScore(tx, totalFees, totalWeight);

    return ancestors;
  }

  private calcAncestorScore(tx: TransactionExtended, ancestorFees: number, ancestorWeight: number): number {
    return Math.min(tx.fee / tx.weight, ancestorFees / ancestorWeight);
  }

  // walk over remaining descendants, removing the root as a valid ancestor & updating the ancestor score
  // returns whether any descendants were modified
  private updateDescendants(
    root: TransactionExtended,
    tx: TransactionExtended,
    mempool: { [txid: string]: TransactionExtended },
    txSets: { [txid: string]: TransactionSet },
    modified: TransactionExtended[],
  ): boolean {
    let anyModified = false;
    const txSet = txSets[tx.txid];
    if (txSet.children) {
      txSet.children.forEach(childId => {
        const child = mempool[childId];
        if (child && child.ancestors) {
          const ancestorIndex = child.ancestors.findIndex(a => a.txid === root.txid);
          if (ancestorIndex > -1) {
            // remove tx as ancestor
            child.ancestors.splice(ancestorIndex, 1);
            const childTxSet = txSets[childId];
            childTxSet.fee -= root.fee;
            childTxSet.weight -= root.weight;
            childTxSet.score = this.calcAncestorScore(child, childTxSet.fee, childTxSet.weight);
            anyModified = true;

            if (!childTxSet.modified) {
              childTxSet.modified = true;
              modified.push(child);
            }
          }
        }
        // recursively update grandchildren
        if (child) {
          anyModified = this.updateDescendants(root, child, mempool, txSets, modified) || anyModified;
        }
      });
    }
    return anyModified;
  }

  private dataToMempoolBlocks(transactions: TransactionExtended[],
    blockSize: number, blockWeight: number, blocksIndex: number): MempoolBlockWithTransactions {
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
      blockVSize: blockWeight / 4,
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
