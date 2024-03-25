import config from '../config';
import logger from '../logger';
import { CompactThreadTransaction, AuditTransaction } from '../mempool.interfaces';
import { PairingHeap } from '../utils/pairing-heap';
import { parentPort } from 'worker_threads';

let mempool: Map<number, CompactThreadTransaction> = new Map();

if (parentPort) {
  parentPort.on('message', (params) => {
    if (params.type === 'set') {
      mempool = params.mempool;
    } else if (params.type === 'update') {
      params.added.forEach(tx => {
        mempool.set(tx.uid, tx);
      });
      params.removed.forEach(uid => {
        mempool.delete(uid);
      });
    }
    
    const { blocks, rates, clusters } = makeBlockTemplates(mempool);

    // return the result to main thread.
    if (parentPort) {
      parentPort.postMessage({ blocks, rates, clusters });
    }
  });
}

/*
* Build projected mempool blocks using an approximation of the transaction selection algorithm from Bitcoin Core
* (see BlockAssembler in https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp)
*/
function makeBlockTemplates(mempool: Map<number, CompactThreadTransaction>)
  : { blocks: number[][], rates: Map<number, number>, clusters: Map<number, number[]> } {
  const start = Date.now();
  const auditPool: Map<number, AuditTransaction> = new Map();
  const mempoolArray: AuditTransaction[] = [];
  const cpfpClusters: Map<number, number[]> = new Map();
  
  mempool.forEach(tx => {
    tx.dirty = false;
    // initializing everything up front helps V8 optimize property access later
    auditPool.set(tx.uid, {
      uid: tx.uid,
      fee: tx.fee,
      weight: tx.weight,
      feePerVsize: tx.feePerVsize,
      effectiveFeePerVsize: tx.feePerVsize,
      sigops: tx.sigops,
      inputs: tx.inputs || [],
      relativesSet: false,
      ancestorMap: new Map<number, AuditTransaction>(),
      children: new Set<AuditTransaction>(),
      ancestorFee: 0,
      ancestorWeight: 0,
      ancestorSigops: 0,
      score: 0,
      used: false,
      modified: false,
      modifiedNode: null,
    });
    mempoolArray.push(auditPool.get(tx.uid) as AuditTransaction);
  });

  // Build relatives graph & calculate ancestor scores
  for (const tx of mempoolArray) {
    if (!tx.relativesSet) {
      setRelatives(tx, auditPool);
    }
  }

  // Sort by descending ancestor score
  mempoolArray.sort((a, b) => {
    if (b.score === a.score) {
      // tie-break by uid for stability
      return a.uid < b.uid ? -1 : 1;
    } else {
      return (b.score || 0) - (a.score || 0);
    }
  });

  // Build blocks by greedily choosing the highest feerate package
  // (i.e. the package rooted in the transaction with the best ancestor score)
  const blocks: number[][] = [];
  let blockWeight = 4000;
  let blockSigops = 0;
  let transactions: AuditTransaction[] = [];
  const modified: PairingHeap<AuditTransaction> = new PairingHeap((a, b): boolean => {
    if (a.score === b.score) {
      // tie-break by uid for stability
      return a.uid > b.uid;
    } else {
      return (a.score || 0) > (b.score || 0);
    }
  });
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
      if (blocks.length >= 7 || ((blockWeight + nextTx.ancestorWeight < config.MEMPOOL.BLOCK_WEIGHT_UNITS) && (blockSigops + nextTx.ancestorSigops <= 80000))) {
        const ancestors: AuditTransaction[] = Array.from(nextTx.ancestorMap.values());
        // sort ancestors by dependency graph (equivalent to sorting by ascending ancestor count)
        const sortedTxSet = [...ancestors.sort((a, b) => { return (a.ancestorMap.size || 0) - (b.ancestorMap.size || 0); }), nextTx];
        let isCluster = false;
        if (sortedTxSet.length > 1) {
          cpfpClusters.set(nextTx.uid, sortedTxSet.map(tx => tx.uid));
          isCluster = true;
        }
        const effectiveFeeRate = Math.min(nextTx.dependencyRate || Infinity, nextTx.ancestorFee / (nextTx.ancestorWeight / 4));
        const used: AuditTransaction[] = [];
        while (sortedTxSet.length) {
          const ancestor = sortedTxSet.pop();
          const mempoolTx = mempool.get(ancestor.uid);
          if (!mempoolTx) {
            continue;
          }
          ancestor.used = true;
          ancestor.usedBy = nextTx.uid;
          // update original copy of this tx with effective fee rate & relatives data
          if (mempoolTx.effectiveFeePerVsize !== effectiveFeeRate) {
            mempoolTx.effectiveFeePerVsize = effectiveFeeRate;
            mempoolTx.dirty = true;
          }
          if (mempoolTx.cpfpRoot !== nextTx.uid) {
            mempoolTx.cpfpRoot = isCluster ? nextTx.uid : null;
            mempoolTx.dirty;
          }
          mempoolTx.cpfpChecked = true;
          transactions.push(ancestor);
          blockWeight += ancestor.weight;
          used.push(ancestor);
        }

        // remove these as valid package ancestors for any descendants remaining in the mempool
        if (used.length) {
          used.forEach(tx => {
            updateDescendants(tx, auditPool, modified, effectiveFeeRate);
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
        blocks.push(transactions.map(t => t.uid));
      } else {
        break;
      }
      // reset for the next block
      transactions = [];
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

  if (overflow.length > 0) {
    logger.warn('GBT overflow list unexpectedly non-empty after final block constructed');
  }
  // add the final unbounded block if it contains any transactions
  if (transactions.length > 0) {
    blocks.push(transactions.map(t => t.uid));
  }

  // get map of dirty transactions
  const rates = new Map<number, number>();
  for (const tx of mempool.values()) {
    if (tx?.dirty) {
      rates.set(tx.uid, tx.effectiveFeePerVsize || tx.feePerVsize);
    }
  }

  const end = Date.now();
  const time = end - start;
  logger.debug('Mempool templates calculated in ' + time / 1000 + ' seconds');

  return { blocks, rates, clusters: cpfpClusters };
}

// traverse in-mempool ancestors
// recursion unavoidable, but should be limited to depth < 25 by mempool policy
function setRelatives(
  tx: AuditTransaction,
  mempool: Map<number, AuditTransaction>,
): void {
  for (const parent of tx.inputs) {
    const parentTx = mempool.get(parent);
    if (parentTx && !tx.ancestorMap?.has(parent)) {
      tx.ancestorMap.set(parent, parentTx);
      parentTx.children.add(tx);
      // visit each node only once
      if (!parentTx.relativesSet) {
        setRelatives(parentTx, mempool);
      }
      parentTx.ancestorMap.forEach((ancestor) => {
        tx.ancestorMap.set(ancestor.uid, ancestor);
      });
    }
  };
  tx.ancestorFee = tx.fee || 0;
  tx.ancestorWeight = tx.weight || 0;
  tx.ancestorSigops = tx.sigops || 0;
  tx.ancestorMap.forEach((ancestor) => {
    tx.ancestorFee += ancestor.fee;
    tx.ancestorWeight += ancestor.weight;
    tx.ancestorSigops += ancestor.sigops;
  });
  tx.score = tx.ancestorFee / ((tx.ancestorWeight / 4) || 1);
  tx.relativesSet = true;
}

// iterate over remaining descendants, removing the root as a valid ancestor & updating the ancestor score
// avoids recursion to limit call stack depth
function updateDescendants(
  rootTx: AuditTransaction,
  mempool: Map<number, AuditTransaction>,
  modified: PairingHeap<AuditTransaction>,
  clusterRate: number,
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
    if (descendantTx && descendantTx.ancestorMap && descendantTx.ancestorMap.has(rootTx.uid)) {
      // remove tx as ancestor
      descendantTx.ancestorMap.delete(rootTx.uid);
      descendantTx.ancestorFee -= rootTx.fee;
      descendantTx.ancestorWeight -= rootTx.weight;
      descendantTx.ancestorSigops -= rootTx.sigops;
      tmpScore = descendantTx.score;
      descendantTx.score = descendantTx.ancestorFee / (descendantTx.ancestorWeight / 4);
      descendantTx.dependencyRate = descendantTx.dependencyRate ? Math.min(descendantTx.dependencyRate, clusterRate) : clusterRate;

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