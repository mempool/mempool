import { CpfpInfo, MempoolTransactionExtended } from '../mempool.interfaces';
import memPool from './mempool';

const CPFP_UPDATE_INTERVAL = 60_000; // update CPFP info at most once per 60s per transaction
const MAX_GRAPH_SIZE = 50; // the maximum number of in-mempool relatives to consider

interface GraphTx extends MempoolTransactionExtended {
  depends: string[];
  spentby: string[];
  ancestorMap: Map<string, GraphTx>;
  fees: {
    base: number;
    ancestor: number;
  };
  ancestorcount: number;
  ancestorsize: number;
  ancestorRate: number;
  individualRate: number;
  score: number;
}

/**
 * Takes a mempool transaction and a copy of the current mempool, and calculates the CPFP data for
 * that transaction (and all others in the same cluster)
 */
export function calculateCpfp(tx: MempoolTransactionExtended, mempool: { [txid: string]: MempoolTransactionExtended }): CpfpInfo {
  if (tx.cpfpUpdated && Date.now() < (tx.cpfpUpdated + CPFP_UPDATE_INTERVAL)) {
    tx.cpfpDirty = false;
    return {
      ancestors: tx.ancestors || [],
      bestDescendant: tx.bestDescendant || null,
      descendants: tx.descendants || [],
      effectiveFeePerVsize: tx.effectiveFeePerVsize || tx.adjustedFeePerVsize || tx.feePerVsize,
      sigops: tx.sigops,
      adjustedVsize: tx.adjustedVsize,
      acceleration: tx.acceleration
    };
  }

  const ancestorMap = new Map<string, GraphTx>();
  const graphTx = mempoolToGraphTx(tx);
  ancestorMap.set(tx.txid, graphTx);

  const allRelatives = expandRelativesGraph(mempool, ancestorMap);
  const relativesMap = initializeRelatives(allRelatives);
  const cluster = calculateCpfpCluster(tx.txid, relativesMap);

  let totalVsize = 0;
  let totalFee = 0;
  for (const tx of cluster.values()) {
    totalVsize += tx.adjustedVsize;
    totalFee += tx.fee;
  }
  const effectiveFeePerVsize = totalFee / totalVsize;
  for (const tx of cluster.values()) {
    mempool[tx.txid].effectiveFeePerVsize = effectiveFeePerVsize;
    mempool[tx.txid].ancestors = Array.from(tx.ancestorMap.values()).map(tx => ({ txid: tx.txid, weight: tx.weight, fee: tx.fee }));
    mempool[tx.txid].descendants = Array.from(cluster.values()).filter(entry => entry.txid !== tx.txid && !tx.ancestorMap.has(entry.txid)).map(tx => ({ txid: tx.txid, weight: tx.weight, fee: tx.fee }));
    mempool[tx.txid].bestDescendant = null;
    mempool[tx.txid].cpfpChecked = true;
    mempool[tx.txid].cpfpDirty = true;
    mempool[tx.txid].cpfpUpdated = Date.now();
  }

  tx = mempool[tx.txid];

  return {
    ancestors: tx.ancestors || [],
    bestDescendant: tx.bestDescendant || null,
    descendants: tx.descendants || [],
    effectiveFeePerVsize: tx.effectiveFeePerVsize || tx.adjustedFeePerVsize || tx.feePerVsize,
    sigops: tx.sigops,
    adjustedVsize: tx.adjustedVsize,
    acceleration: tx.acceleration
  };
}

function mempoolToGraphTx(tx: MempoolTransactionExtended): GraphTx {
  return {
    ...tx,
    depends: tx.vin.map(v => v.txid),
    spentby: tx.vout.map((v, i) => memPool.getFromSpendMap(tx.txid, i)).map(tx => tx?.txid).filter(txid => txid != null) as string[],
    ancestorMap: new Map(),
    fees: {
      base: tx.fee,
      ancestor: tx.fee,
    },
    ancestorcount: 1,
    ancestorsize: tx.adjustedVsize,
    ancestorRate: 0,
    individualRate: 0,
    score: 0,
  };
}

/**
 * Takes a map of transaction ancestors, and expands it into a full graph of up to MAX_GRAPH_SIZE in-mempool relatives
 */
function expandRelativesGraph(mempool: { [txid: string]: MempoolTransactionExtended }, ancestors: Map<string, GraphTx>): Map<string, GraphTx> {
  const relatives: Map<string, GraphTx> = new Map();
  const stack: GraphTx[] = Array.from(ancestors.values());
  while (stack.length > 0) {
    if (relatives.size > MAX_GRAPH_SIZE) {
      return relatives;
    }

    const nextTx = stack.pop();
    if (!nextTx) {
      continue;
    }
    relatives.set(nextTx.txid, nextTx);

    for (const relativeTxid of [...nextTx.depends, ...nextTx.spentby]) {
      if (relatives.has(relativeTxid)) {
        // already processed this tx
        continue;
      }
      let mempoolTx = ancestors.get(relativeTxid);
      if (!mempoolTx && mempool[relativeTxid]) {
        mempoolTx = mempoolToGraphTx(mempool[relativeTxid]);
      }
      if (mempoolTx) {
        stack.push(mempoolTx);
      }
    }
  }

  return relatives;
}

 /**
   * Efficiently sets a Map of in-mempool ancestors for each member of an expanded relative graph
   * by running setAncestors on each leaf, and caching intermediate results.
   * then initializes ancestor data for each transaction
   * 
   * @param all 
   */
 function initializeRelatives(mempoolTxs: Map<string, GraphTx>): Map<string, GraphTx> {
  const visited: Map<string, Map<string, GraphTx>> = new Map();
  const leaves: GraphTx[] = Array.from(mempoolTxs.values()).filter(entry => entry.spentby.length === 0);
  for (const leaf of leaves) {
    setAncestors(leaf, mempoolTxs, visited);
  }
  mempoolTxs.forEach(entry => {
    entry.ancestorMap?.forEach(ancestor => {
      entry.ancestorcount++;
      entry.ancestorsize += ancestor.adjustedVsize;
      entry.fees.ancestor += ancestor.fees.base;
    });
    setAncestorScores(entry);
  });
  return mempoolTxs;
}

/**
   * Given a root transaction and a list of in-mempool ancestors,
   * Calculate the CPFP cluster
   * 
   * @param tx
   * @param ancestors
   */
function calculateCpfpCluster(txid: string, graph: Map<string, GraphTx>): Map<string, GraphTx> {
  const tx = graph.get(txid);
  if (!tx) {
    return new Map<string, GraphTx>([]);
  }

  // Initialize individual & ancestor fee rates
  graph.forEach(entry => setAncestorScores(entry));

  // Sort by descending ancestor score
  let sortedRelatives = Array.from(graph.values()).sort(mempoolComparator);

  // Iterate until we reach a cluster that includes our target tx
  let maxIterations = MAX_GRAPH_SIZE;
  let best = sortedRelatives.shift();
  let bestCluster = new Map<string, GraphTx>(best?.ancestorMap?.entries() || []);
  while (sortedRelatives.length && best && (best.txid !== tx.txid && !best.ancestorMap.has(tx.txid)) && maxIterations > 0) {
    maxIterations--;
    if ((best && best.txid === tx.txid) || (bestCluster && bestCluster.has(tx.txid))) {
      break;
    } else {
      // Remove this cluster (it doesn't include our target tx)
      // and update scores, ancestor totals and dependencies for the survivors
      removeAncestors(bestCluster, graph);

      // re-sort
      sortedRelatives = Array.from(graph.values()).sort(mempoolComparator);

      // Grab the next highest scoring entry
      best = sortedRelatives.shift();
      if (best) {
        bestCluster = new Map<string, GraphTx>(best?.ancestorMap?.entries() || []);
        bestCluster.set(best?.txid, best);
      }
    }
  }

  bestCluster.set(tx.txid, tx);

  return bestCluster;
}

 /**
   * Remove a cluster of transactions from an in-mempool dependency graph
   * and update the survivors' scores and ancestors
   * 
   * @param cluster 
   * @param ancestors 
   */
 function removeAncestors(cluster: Map<string, GraphTx>, all: Map<string, GraphTx>): void {
  // remove
  cluster.forEach(tx => {
    all.delete(tx.txid);
  });

  // update survivors
  all.forEach(tx => {
    cluster.forEach(remove => {
      if (tx.ancestorMap?.has(remove.txid)) {
        // remove as dependency
        tx.ancestorMap.delete(remove.txid);
        tx.depends = tx.depends.filter(parent => parent !== remove.txid);
        // update ancestor sizes and fees
        tx.ancestorsize -= remove.adjustedVsize;
        tx.fees.ancestor -= remove.fees.base;
      }
    });
    // recalculate fee rates
    setAncestorScores(tx);
  });
}

/**
   * Recursively traverses an in-mempool dependency graph, and sets a Map of in-mempool ancestors
   * for each transaction.
   * 
   * @param tx 
   * @param all 
   */
function setAncestors(tx: GraphTx, all: Map<string, GraphTx>, visited: Map<string, Map<string, GraphTx>>, depth: number = 0): Map<string, GraphTx> {
  // sanity check for infinite recursion / too many ancestors (should never happen)
  if (depth > MAX_GRAPH_SIZE) {
    return tx.ancestorMap;
  }
  
  // initialize the ancestor map for this tx
  tx.ancestorMap = new Map<string, GraphTx>();
  tx.depends.forEach(parentId => {
    const parent = all.get(parentId);
    if (parent) {
      // add the parent
      tx.ancestorMap?.set(parentId, parent);
      // check for a cached copy of this parent's ancestors
      let ancestors = visited.get(parent.txid);
      if (!ancestors) {
        // recursively fetch the parent's ancestors
        ancestors = setAncestors(parent, all, visited, depth + 1);
      }
      // and add to this tx's map
      ancestors.forEach((ancestor, ancestorId) => {
        tx.ancestorMap?.set(ancestorId, ancestor);
      });
    }
  });
  visited.set(tx.txid, tx.ancestorMap);

  return tx.ancestorMap;
}

/**
   * Take a mempool transaction, and set the fee rates and ancestor score
   * 
   * @param tx 
   */
function setAncestorScores(tx: GraphTx): GraphTx {
  tx.individualRate = (tx.fees.base * 100_000_000) / tx.adjustedVsize;
  tx.ancestorRate = (tx.fees.ancestor * 100_000_000) / tx.ancestorsize;
  tx.score = Math.min(tx.individualRate, tx.ancestorRate);
  return tx;
}

// Sort by descending score
function mempoolComparator(a: GraphTx, b: GraphTx): number {
  return b.score - a.score;
}