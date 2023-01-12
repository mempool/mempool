import config from '../config';
import logger from '../logger';
import { ThreadTransaction, MempoolBlockWithTransactions, AuditTransaction } from '../mempool.interfaces';
import { PairingHeap } from '../utils/pairing-heap';
import { Common } from './common';
import { parentPort } from 'worker_threads';

let mempool: { [txid: string]: ThreadTransaction } = {};

if (parentPort) {
  parentPort.on('message', (params) => {
    if (params.type === 'set') {
      mempool = params.mempool;
    } else if (params.type === 'update') {
      params.added.forEach(tx => {
        mempool[tx.txid] = tx;
      });
      params.removed.forEach(txid => {
        delete mempool[txid];
      });
    }
    
    const { blocks, clusters } = makeBlockTemplates(mempool);

    // return the result to main thread.
    if (parentPort) {
     parentPort.postMessage({ blocks, clusters });
    }
  });
}

/*
* Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core
* (see BlockAssembler in https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp)
*/
function makeBlockTemplates(mempool: { [txid: string]: ThreadTransaction })
  : { blocks: ThreadTransaction[][], clusters: { [root: string]: string[] } } {
  const start = Date.now();
  const auditPool: { [txid: string]: AuditTransaction } = {};
  const mempoolArray: AuditTransaction[] = [];
  const restOfArray: ThreadTransaction[] = [];
  const cpfpClusters: { [root: string]: string[] } = {};
  
  // grab the top feerate txs up to maxWeight
  Object.values(mempool).sort((a, b) => b.feePerVsize - a.feePerVsize).forEach(tx => {
    // initializing everything up front helps V8 optimize property access later
    auditPool[tx.txid] = {
      txid: tx.txid,
      fee: tx.fee,
      weight: tx.weight,
      feePerVsize: tx.feePerVsize,
      effectiveFeePerVsize: tx.feePerVsize,
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
  const blocks: ThreadTransaction[][] = [];
  let blockWeight = 4000;
  let blockSize = 0;
  let transactions: AuditTransaction[] = [];
  const modified: PairingHeap<AuditTransaction> = new PairingHeap((a, b): boolean => (a.score || 0) > (b.score || 0));
  let overflow: AuditTransaction[] = [];
  let failures = 0;
  let top = 0;
  while ((top < mempoolArray.length || !modified.isEmpty())) {
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
        // sort ancestors by dependency graph (equivalent to sorting by ascending ancestor count)
        const sortedTxSet = [...ancestors.sort((a, b) => { return (a.ancestorMap.size || 0) - (b.ancestorMap.size || 0); }), nextTx];
        let isCluster = false;
        if (sortedTxSet.length > 1) {
          cpfpClusters[nextTx.txid] = sortedTxSet.map(tx => tx.txid);
          isCluster = true;
        }
        const effectiveFeeRate = nextTx.ancestorFee / (nextTx.ancestorWeight / 4);
        const used: AuditTransaction[] = [];
        while (sortedTxSet.length) {
          const ancestor = sortedTxSet.pop();
          const mempoolTx = mempool[ancestor.txid];
          ancestor.used = true;
          ancestor.usedBy = nextTx.txid;
          // update original copy of this tx with effective fee rate & relatives data
          mempoolTx.effectiveFeePerVsize = effectiveFeeRate;
          if (isCluster) {
            mempoolTx.cpfpRoot = nextTx.txid;
          }
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
    if ((exceededPackageTries || queueEmpty) && blocks.length < 7) {
      // construct this block
      if (transactions.length) {
        blocks.push(transactions.map(t => mempool[t.txid]));
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
  // pack any leftover transactions into the last block
  for (const tx of overflow) {
    if (!tx || tx?.used) {
      continue;
    }
    blockWeight += tx.weight;
    const mempoolTx = mempool[tx.txid];
    // update original copy of this tx with effective fee rate & relatives data
    mempoolTx.effectiveFeePerVsize = tx.score;
    if (tx.ancestorMap.size > 0) {
      cpfpClusters[tx.txid] = Array.from(tx.ancestorMap?.values()).map(a => a.txid);
      mempoolTx.cpfpRoot = tx.txid;
    }
    mempoolTx.cpfpChecked = true;
    transactions.push(tx);
    tx.used = true;
  }
  const blockTransactions = transactions.map(t => mempool[t.txid]);
  restOfArray.forEach(tx => {
    blockWeight += tx.weight;
    tx.effectiveFeePerVsize = tx.feePerVsize;
    tx.cpfpChecked = false;
    blockTransactions.push(tx);
  });
  if (blockTransactions.length) {
    blocks.push(blockTransactions);
  }
  transactions = [];

  const end = Date.now();
  const time = end - start;
  logger.debug('Mempool templates calculated in ' + time / 1000 + ' seconds');

  return { blocks, clusters: cpfpClusters };
}

// traverse in-mempool ancestors
// recursion unavoidable, but should be limited to depth < 25 by mempool policy
function setRelatives(
  tx: AuditTransaction,
  mempool: { [txid: string]: AuditTransaction },
): void {
  for (const parent of tx.vin) {
    const parentTx = mempool[parent];
    if (parentTx && !tx.ancestorMap?.has(parent)) {
      tx.ancestorMap.set(parent, parentTx);
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