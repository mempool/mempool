import config from '../config';
import logger from '../logger';
import { TransactionExtended, MempoolBlockWithTransactions, AuditTransaction } from '../mempool.interfaces';
import { PairingHeap } from '../utils/pairing-heap';
import { Common } from './common';
import { parentPort } from 'worker_threads';

if (parentPort) {
  parentPort.on('message', (params: { mempool: { [txid: string]: TransactionExtended }, blockLimit: number, weightLimit: number | null, condenseRest: boolean}) => {
    const { mempool, blocks } = makeBlockTemplates(params);

    // return the result to main thread.
    if (parentPort) {
     parentPort.postMessage({ mempool, blocks });
    }
  });
}

/*
* Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core
* (see BlockAssembler in https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp)
*
* blockLimit: number of blocks to build in total.
* weightLimit: maximum weight of transactions to consider using the selection algorithm.
*              if weightLimit is significantly lower than the mempool size, results may start to diverge from getBlockTemplate 
* condenseRest: whether to ignore excess transactions or append them to the final block.
*/
function makeBlockTemplates({ mempool, blockLimit, weightLimit, condenseRest }: { mempool: { [txid: string]: TransactionExtended }, blockLimit: number, weightLimit?: number | null, condenseRest?: boolean | null })
  : { mempool: { [txid: string]: TransactionExtended }, blocks: MempoolBlockWithTransactions[] } {
  const start = Date.now();
  const auditPool: { [txid: string]: AuditTransaction } = {};
  const mempoolArray: AuditTransaction[] = [];
  const restOfArray: TransactionExtended[] = [];
  
  let weight = 0;
  const maxWeight = weightLimit ? Math.max(4_000_000 * blockLimit, weightLimit) : Infinity;
  // grab the top feerate txs up to maxWeight
  Object.values(mempool).sort((a, b) => b.feePerVsize - a.feePerVsize).forEach(tx => {
    weight += tx.weight;
    if (weight >= maxWeight) {
      restOfArray.push(tx);
      return;
    }
    // initializing everything up front helps V8 optimize property access later
    auditPool[tx.txid] = {
      txid: tx.txid,
      fee: tx.fee,
      size: tx.size,
      weight: tx.weight,
      feePerVsize: tx.feePerVsize,
      vin: tx.vin,
      relativesSet: false,
      ancestorMap: new Map<string, AuditTransaction>(),
      children: new Set<AuditTransaction>(),
      ancestorFee: 0,
      ancestorWeight: 0,
      score: 0,
      used: false,
      modified: false,
      modifiedNode: null,
    };
    mempoolArray.push(auditPool[tx.txid]);
  });

  // Build relatives graph & calculate ancestor scores
  for (const tx of mempoolArray) {
    if (!tx.relativesSet) {
      setRelatives(tx, auditPool);
    }
  }

  // Sort by descending ancestor score
  mempoolArray.sort((a, b) => (b.score || 0) - (a.score || 0));

  // Build blocks by greedily choosing the highest feerate package
  // (i.e. the package rooted in the transaction with the best ancestor score)
  const blocks: MempoolBlockWithTransactions[] = [];
  let blockWeight = 4000;
  let blockSize = 0;
  let transactions: AuditTransaction[] = [];
  const modified: PairingHeap<AuditTransaction> = new PairingHeap((a, b): boolean => (a.score || 0) > (b.score || 0));
  let overflow: AuditTransaction[] = [];
  let failures = 0;
  let top = 0;
  while ((top < mempoolArray.length || !modified.isEmpty()) && (condenseRest || blocks.length < blockLimit)) {
    // skip invalid transactions
    while (top < mempoolArray.length && (mempoolArray[top].used || mempoolArray[top].modified)) {
      top++;
    }

    // Select best next package
    let nextTx;
    const nextPoolTx = mempoolArray[top];
    const nextModifiedTx = modified.peek();
    if (nextPoolTx && (!nextModifiedTx || (nextPoolTx.score || 0) > (nextModifiedTx.score || 0))) {
      nextTx = nextPoolTx;
      top++;
    } else {
      modified.pop();
      if (nextModifiedTx) {
        nextTx = nextModifiedTx;
        nextTx.modifiedNode = undefined;
      }
    }

    if (nextTx && !nextTx?.used) {
      // Check if the package fits into this block
      if (blockWeight + nextTx.ancestorWeight < config.MEMPOOL.BLOCK_WEIGHT_UNITS) {
        const ancestors: AuditTransaction[] = Array.from(nextTx.ancestorMap.values());
        const descendants: AuditTransaction[] = [];
        // sort ancestors by dependency graph (equivalent to sorting by ascending ancestor count)
        const sortedTxSet = [...ancestors.sort((a, b) => { return (a.ancestorMap.size || 0) - (b.ancestorMap.size || 0); }), nextTx];
        const effectiveFeeRate = nextTx.ancestorFee / (nextTx.ancestorWeight / 4);
        const used: AuditTransaction[] = [];
        while (sortedTxSet.length) {
          const ancestor = sortedTxSet.pop();
          const mempoolTx = mempool[ancestor.txid];
          ancestor.used = true;
          ancestor.usedBy = nextTx.txid;
          // update original copy of this tx with effective fee rate & relatives data
          mempoolTx.effectiveFeePerVsize = effectiveFeeRate;
          mempoolTx.ancestors = sortedTxSet.map((a) => {
            return {
              txid: a.txid,
              fee: a.fee,
              weight: a.weight,
            };
          }).reverse();
          mempoolTx.descendants = descendants.map((a) => {
            return {
              txid: a.txid,
              fee: a.fee,
              weight: a.weight,
            };
          });
          descendants.push(ancestor);
          mempoolTx.cpfpChecked = true;
          transactions.push(ancestor);
          blockSize += ancestor.size;
          blockWeight += ancestor.weight;
          used.push(ancestor);
        }

        // remove these as valid package ancestors for any descendants remaining in the mempool
        if (used.length) {
          used.forEach(tx => {
            updateDescendants(tx, auditPool, modified);
          });
        }

        failures = 0;
      } else {
        // hold this package in an overflow list while we check for smaller options
        overflow.push(nextTx);
        failures++;
      }
    }

    // this block is full
    const exceededPackageTries = failures > 1000 && blockWeight > (config.MEMPOOL.BLOCK_WEIGHT_UNITS - 4000);
    const queueEmpty = top >= mempoolArray.length && modified.isEmpty();
    if ((exceededPackageTries || queueEmpty) && (!condenseRest || blocks.length < blockLimit - 1)) {
      // construct this block
      if (transactions.length) {
        blocks.push(dataToMempoolBlocks(transactions.map(t => mempool[t.txid]), blockSize, blockWeight, blocks.length));
      }
      // reset for the next block
      transactions = [];
      blockSize = 0;
      blockWeight = 4000;

      // 'overflow' packages didn't fit in this block, but are valid candidates for the next
      for (const overflowTx of overflow.reverse()) {
        if (overflowTx.modified) {
          overflowTx.modifiedNode = modified.add(overflowTx);
        } else {
          top--;
          mempoolArray[top] = overflowTx;
        }
      }
      overflow = [];
    }
  }
  if (condenseRest) {
    // pack any leftover transactions into the last block
    for (const tx of overflow) {
      if (!tx || tx?.used) {
        continue;
      }
      blockWeight += tx.weight;
      blockSize += tx.size;
      const mempoolTx = mempool[tx.txid];
      // update original copy of this tx with effective fee rate & relatives data
      mempoolTx.effectiveFeePerVsize = tx.score;
      mempoolTx.ancestors = (Array.from(tx.ancestorMap?.values()) as AuditTransaction[]).map((a) => {
        return {
          txid: a.txid,
          fee: a.fee,
          weight: a.weight,
        };
      });
      mempoolTx.bestDescendant = null;
      mempoolTx.cpfpChecked = true;
      transactions.push(tx);
      tx.used = true;
    }
    const blockTransactions = transactions.map(t => mempool[t.txid]);
    restOfArray.forEach(tx => {
      blockWeight += tx.weight;
      blockSize += tx.size;
      tx.effectiveFeePerVsize = tx.feePerVsize;
      tx.cpfpChecked = false;
      tx.ancestors = [];
      tx.bestDescendant = null;
      blockTransactions.push(tx);
    });
    if (blockTransactions.length) {
      blocks.push(dataToMempoolBlocks(blockTransactions, blockSize, blockWeight, blocks.length));
    }
    transactions = [];
  } else if (transactions.length) {
    blocks.push(dataToMempoolBlocks(transactions.map(t => mempool[t.txid]), blockSize, blockWeight, blocks.length));
  }

  const end = Date.now();
  const time = end - start;
  logger.debug('Mempool templates calculated in ' + time / 1000 + ' seconds');

  return {
    mempool,
    blocks
  };
}

// traverse in-mempool ancestors
// recursion unavoidable, but should be limited to depth < 25 by mempool policy
function setRelatives(
  tx: AuditTransaction,
  mempool: { [txid: string]: AuditTransaction },
): void {
  for (const parent of tx.vin) {
    const parentTx = mempool[parent.txid];
    if (parentTx && !tx.ancestorMap?.has(parent.txid)) {
      tx.ancestorMap.set(parent.txid, parentTx);
      parentTx.children.add(tx);
      // visit each node only once
      if (!parentTx.relativesSet) {
        setRelatives(parentTx, mempool);
      }
      parentTx.ancestorMap.forEach((ancestor) => {
        tx.ancestorMap.set(ancestor.txid, ancestor);
      });
    }
  };
  tx.ancestorFee = tx.fee || 0;
  tx.ancestorWeight = tx.weight || 0;
  tx.ancestorMap.forEach((ancestor) => {
    tx.ancestorFee += ancestor.fee;
    tx.ancestorWeight += ancestor.weight;
  });
  tx.score = tx.ancestorFee / ((tx.ancestorWeight / 4) || 1);
  tx.relativesSet = true;
}

// iterate over remaining descendants, removing the root as a valid ancestor & updating the ancestor score
// avoids recursion to limit call stack depth
function updateDescendants(
  rootTx: AuditTransaction,
  mempool: { [txid: string]: AuditTransaction },
  modified: PairingHeap<AuditTransaction>,
): void {
  const descendantSet: Set<AuditTransaction> = new Set();
  // stack of nodes left to visit
  const descendants: AuditTransaction[] = [];
  let descendantTx;
  let tmpScore;
  rootTx.children.forEach(childTx => {
    if (!descendantSet.has(childTx)) {
      descendants.push(childTx);
      descendantSet.add(childTx);
    }
  });
  while (descendants.length) {
    descendantTx = descendants.pop();
    if (descendantTx && descendantTx.ancestorMap && descendantTx.ancestorMap.has(rootTx.txid)) {
      // remove tx as ancestor
      descendantTx.ancestorMap.delete(rootTx.txid);
      descendantTx.ancestorFee -= rootTx.fee;
      descendantTx.ancestorWeight -= rootTx.weight;
      tmpScore = descendantTx.score;
      descendantTx.score = descendantTx.ancestorFee / (descendantTx.ancestorWeight / 4);

      if (!descendantTx.modifiedNode) {
        descendantTx.modified = true;
        descendantTx.modifiedNode = modified.add(descendantTx);
      } else {
        // rebalance modified heap if score has changed
        if (descendantTx.score < tmpScore) {
          modified.decreasePriority(descendantTx.modifiedNode);
        } else if (descendantTx.score > tmpScore) {
          modified.increasePriority(descendantTx.modifiedNode);
        }
      }

      // add this node's children to the stack
      descendantTx.children.forEach(childTx => {
        // visit each node only once
        if (!descendantSet.has(childTx)) {
          descendants.push(childTx);
          descendantSet.add(childTx);
        }
      });
    }
  }
}

function dataToMempoolBlocks(transactions: TransactionExtended[],
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