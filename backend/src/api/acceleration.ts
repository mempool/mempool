import logger from '../logger';
import { MempoolTransactionExtended } from '../mempool.interfaces';
import { IEsploraApi } from './bitcoin/esplora-api.interface';

const BLOCK_WEIGHT_UNITS = 4_000_000;
const BLOCK_SIGOPS = 80_000;
const MAX_RELATIVE_GRAPH_SIZE = 200;
const BID_BOOST_WINDOW = 40_000;
const BID_BOOST_MIN_OFFSET = 10_000;
const BID_BOOST_MAX_OFFSET = 400_000;

type Acceleration = {
  txid: string;
  max_bid: number;
};

interface TxSummary {
  txid: string; // txid of the current transaction
  effectiveVsize: number; // Total vsize of the dependency tree
  effectiveFee: number;  // Total fee of the dependency tree in sats
  ancestorCount: number; // Number of ancestors
}

export interface AccelerationInfo {
  txSummary: TxSummary;
  targetFeeRate: number; // target fee rate (recommended next block fee, or median fee for mined block)
  nextBlockFee: number; // fee in sats required to be in the next block (using recommended next block fee, or median fee for mined block)
  cost: number; // additional cost to accelerate ((cost + txSummary.effectiveFee) / txSummary.effectiveVsize) >= targetFeeRate
}

interface GraphTx {
  txid: string;
  vsize: number;
  weight: number;
  fees: {
    base: number; // in sats
  };
  depends: string[];
  spentby: string[];
}

interface MempoolTx extends GraphTx {
  ancestorcount: number;
  ancestorsize: number;
  fees: { // in sats
    base: number;
    ancestor: number;
  };

  ancestors: Map<string, MempoolTx>,
  ancestorRate: number;
  individualRate: number;
  score: number;
}

class AccelerationCosts {
  /**
   * Takes a list of accelerations and verbose block data
   * Returns the "fair" boost rate to charge accelerations
   *
   * @param accelerationsx
   * @param verboseBlock
   */
  public calculateBoostRate(accelerations: Acceleration[], blockTxs: IEsploraApi.Transaction[]): number {
    // Run GBT ourselves to calculate accurate effective fee rates
    // the list of transactions comes from a mined block, so we already know everything fits within consensus limits
    const template = makeBlockTemplate(blockTxs, accelerations, 1, Infinity, Infinity);

    // initialize working maps for fast tx lookups
    const accMap = {};
    const txMap = {};
    for (const acceleration of accelerations) {
      accMap[acceleration.txid] = acceleration;
    }
    for (const tx of template) {
      txMap[tx.txid] = tx;
    }

    // Identify and exclude accelerated and otherwise prioritized transactions
    const excludeMap = {};
    let totalWeight = 0;
    let minAcceleratedPackage = Infinity;
    let lastEffectiveRate = 0;
    // Iterate over the mined template from bottom to top.
    // Transactions should appear in ascending order of mining priority.
    for (const blockTx of [...blockTxs].reverse()) {
      const txid = blockTx.txid;
      const tx = txMap[txid];
      totalWeight += tx.weight;
      const isAccelerated = accMap[txid] != null;
      // If a cluster has a in-band effective fee rate than the previous cluster,
      // it must have been prioritized out-of-band (in order to have a higher mining priority)
      // so exclude from the analysis.
      const isPrioritized = tx.effectiveFeePerVsize < lastEffectiveRate;
      if (isPrioritized || isAccelerated) {
        let packageWeight = 0;
        // exclude this whole CPFP cluster
        for (const clusterTxid of tx.cluster) {
          packageWeight += txMap[clusterTxid].weight;
          if (!excludeMap[clusterTxid]) {
            excludeMap[clusterTxid] = true;
          }
        }
        // keep track of the smallest accelerated CPFP cluster for later
        if (isAccelerated) {
          minAcceleratedPackage = Math.min(minAcceleratedPackage, packageWeight);
        }
      }
      if (!isPrioritized) {
        if (!isAccelerated) {
          lastEffectiveRate = tx.effectiveFeePerVsize;
        }
      }
    }

    // The Bid Boost Rate is calculated by disregarding the bottom X weight units of the block,
    // where X is the larger of BID_BOOST_MIN_OFFSET or the smallest accelerated package weight (the "offset"),
    // then taking the average fee rate of the following BID_BOOST_WINDOW weight units
    // (ignoring accelerated transactions and their ancestors).
    //
    // Transactions within the offset might pay less than the fair rate due to bin-packing effects
    // But the average rate paid by the next chunk of non-accelerated transactions provides a good
    // upper bound on the "next best rate" of alternatives to including the accelerated transactions
    // (since, if there were any better options, they would have been included instead)
    const spareWeight = BLOCK_WEIGHT_UNITS - totalWeight;
    const windowOffset = Math.min(Math.max(minAcceleratedPackage, BID_BOOST_MIN_OFFSET, spareWeight), BID_BOOST_MAX_OFFSET);
    const leftBound = windowOffset;
    const rightBound = windowOffset + BID_BOOST_WINDOW;
    let totalFeeInWindow = 0;
    let totalWeightInWindow = Math.max(0, spareWeight - leftBound);
    let txIndex = blockTxs.length - 1;
    for (let offset = spareWeight; offset < BLOCK_WEIGHT_UNITS && txIndex >= 0; txIndex--) {
      const txid = blockTxs[txIndex].txid;
      const tx = txMap[txid];
      if (excludeMap[txid]) {
        // skip prioritized transactions and their ancestors
        continue;
      }

      const left = offset;
      const right = offset + tx.weight;
      offset += tx.weight;
      if (right < leftBound) {
        // not within window yet
        continue;
      }
      if (left > rightBound) {
        // past window
        break;
      }
      // count fees for weight units within the window
      const overlapLeft = Math.max(leftBound, left);
      const overlapRight = Math.min(rightBound, right);
      const overlapUnits = overlapRight - overlapLeft;
      totalFeeInWindow += (tx.effectiveFeePerVsize * (overlapUnits / 4));
      totalWeightInWindow += overlapUnits;
    }

    if (totalWeightInWindow < BID_BOOST_WINDOW) {
      // not enough un-prioritized transactions to calculate a fair rate
      // just charge everyone their max bids
      return Infinity;
    }
    // Divide the total fee by the size of the BID_BOOST_WINDOW in vbytes
    const averageRate = totalFeeInWindow / (BID_BOOST_WINDOW / 4);
    return averageRate;
  }


  /**
   * Takes an accelerated mined txid and a target rate
   * Returns the total vsize, fees and acceleration cost (in sats) of the tx and all same-block ancestors
   * 
   * @param txid 
   * @param medianFeeRate 
   */
  public getAccelerationInfo(tx: MempoolTransactionExtended, targetFeeRate: number, transactions: MempoolTransactionExtended[]): AccelerationInfo {
    // Get same-block transaction ancestors
    const allRelatives = this.getSameBlockRelatives(tx, transactions);
    const relativesMap = this.initializeRelatives(allRelatives);
    const rootTx = relativesMap.get(tx.txid) as MempoolTx;

    // Calculate cost to boost
    return this.calculateAccelerationAncestors(rootTx, relativesMap, targetFeeRate);
  }

  /**
   * Takes a raw transaction, and builds a graph of same-block relatives,
   * and returns as a MempoolTx
   * 
   * @param tx 
   */
  private getSameBlockRelatives(tx: MempoolTransactionExtended, transactions: MempoolTransactionExtended[]): Map<string, GraphTx> {
    const blockTxs = new Map<string, MempoolTransactionExtended>(); // map of txs in this block
    const spendMap = new Map<string, string>(); // map of outpoints to spending txids
    for (const tx of transactions) {
      blockTxs.set(tx.txid, tx);
      for (const vin of tx.vin) {
        spendMap.set(`${vin.txid}:${vin.vout}`, tx.txid);
      }
    }

    const relatives: Map<string, GraphTx> = new Map();
    const stack: string[] = [tx.txid];

    // build set of same-block ancestors
    while (stack.length > 0) {
      const nextTxid = stack.pop();
      const nextTx = nextTxid ? blockTxs.get(nextTxid) : null;
      if (!nextTx || relatives.has(nextTx.txid)) {
        continue;
      }

      const mempoolTx = this.convertToGraphTx(nextTx);

      mempoolTx.fees.base = nextTx.fee || 0;
      mempoolTx.depends = nextTx.vin.map(vin => vin.txid).filter(inTxid => inTxid && blockTxs.has(inTxid)) as string[];
      mempoolTx.spentby = nextTx.vout.map((vout, index) => spendMap.get(`${nextTx.txid}:${index}`)).filter(outTxid => outTxid && blockTxs.has(outTxid)) as string[];

      for (const txid of [...mempoolTx.depends, ...mempoolTx.spentby]) {
        if (txid) {
          stack.push(txid);
        }
      }

      relatives.set(mempoolTx.txid, mempoolTx);
    }

    return relatives;
  }

  /**
   * Takes a raw transaction and converts it to MempoolTx format
   * fee and ancestor data is initialized with dummy/null values
   * 
   * @param tx 
   */
  private convertToGraphTx(tx: MempoolTransactionExtended): GraphTx {
    return {
      txid: tx.txid,
      vsize: Math.ceil(tx.weight / 4),
      weight: tx.weight,
      fees: {
        base: 0, // dummy
      },
      depends: [], // dummy
      spentby: [], //dummy
    };
  }

  private convertGraphToMempoolTx(tx: GraphTx): MempoolTx {
    return {
      ...tx,
      fees: {
        base: tx.fees.base,
        ancestor: tx.fees.base,
      },
      ancestorcount: 1,
      ancestorsize: Math.ceil(tx.weight / 4),
      ancestors: new Map<string, MempoolTx>(),
      ancestorRate: 0,
      individualRate: 0,
      score: 0,
    };
  }

  /**
   * Given a root transaction, a list of in-mempool ancestors, and a target fee rate,
   * Calculate the minimum set of transactions to fee-bump, their total vsize + fees
   * 
   * @param tx
   * @param ancestors
   */
  private calculateAccelerationAncestors(tx: MempoolTx, relatives: Map<string, MempoolTx>, targetFeeRate: number): AccelerationInfo {
    // add root tx to the ancestor map
    relatives.set(tx.txid, tx);

    // Check for high-sigop transactions (not supported)
    relatives.forEach(entry => {
      if (entry.vsize > Math.ceil(entry.weight / 4)) {
        throw new Error(`high_sigop_tx`);
      }
    });

    // Initialize individual & ancestor fee rates
    relatives.forEach(entry => this.setAncestorScores(entry));

    // Sort by descending ancestor score
    let sortedRelatives = Array.from(relatives.values()).sort(this.mempoolComparator);

    let includedInCluster: Map<string, MempoolTx> | null = null;

    // While highest score >= targetFeeRate
    let maxIterations = MAX_RELATIVE_GRAPH_SIZE;
    while (sortedRelatives.length && sortedRelatives[0].score && sortedRelatives[0].score >= targetFeeRate && maxIterations > 0) {
      maxIterations--;
      // Grab the highest scoring entry
      const best = sortedRelatives.shift();
      if (best) {
        const cluster = new Map<string, MempoolTx>(best.ancestors?.entries() || []);
        if (best.ancestors.has(tx.txid)) {
          includedInCluster = cluster;
        }
        cluster.set(best.txid, best);
        // Remove this cluster (it already pays over the target rate, so doesn't need to be boosted)
        // and update scores, ancestor totals and dependencies for the survivors
        this.removeAncestors(cluster, relatives);

        // re-sort
        sortedRelatives = Array.from(relatives.values()).sort(this.mempoolComparator);
      }
    }

    // sanity check for infinite loops / too many ancestors (should never happen)
    if (maxIterations <= 0) {
      logger.warn(`acceleration dependency calculation failed: calculateAccelerationAncestors loop exceeded ${MAX_RELATIVE_GRAPH_SIZE} iterations, unable to proceed`);
      throw new Error('invalid_tx_dependencies');
    }

    let totalFee = tx.fees.ancestor;

    // transaction is already CPFP-d above the target rate by some descendant
    if (includedInCluster) {
      let clusterSize = 0;
      let clusterFee = 0;
      includedInCluster.forEach(entry => {
        clusterSize += entry.vsize;
        clusterFee += entry.fees.base;
      });
      const clusterRate = clusterFee / clusterSize;
      totalFee = Math.ceil(tx.ancestorsize * clusterRate);
    }

    // Whatever remains in the accelerated tx's dependencies needs to be boosted to the targetFeeRate
    // Cost = (totalVsize * targetFeeRate) - totalFee
    return {
      txSummary: {
        txid: tx.txid,
        effectiveVsize: tx.ancestorsize,
        effectiveFee: totalFee,
        ancestorCount: tx.ancestorcount,
      },
      cost: Math.max(0, Math.ceil(tx.ancestorsize * targetFeeRate) - totalFee),
      targetFeeRate,
      nextBlockFee: Math.ceil(tx.ancestorsize * targetFeeRate),
    };
  }

  /**
   * Recursively traverses an in-mempool dependency graph, and sets a Map of in-mempool ancestors
   * for each transaction.
   * 
   * @param tx 
   * @param all 
   */
  private setAncestors(tx: MempoolTx, all: Map<string, MempoolTx>, visited: Map<string, Map<string, MempoolTx>>, depth: number = 0): Map<string, MempoolTx> {
    // sanity check for infinite recursion / too many ancestors (should never happen)
    if (depth >= 100) {
      logger.warn('acceleration dependency calculation failed: setAncestors reached depth of 100, unable to proceed', `Accelerator`);
      throw new Error('invalid_tx_dependencies');
    }
    
    // initialize the ancestor map for this tx
    tx.ancestors = new Map<string, MempoolTx>();
    tx.depends.forEach(parentId => {
      const parent = all.get(parentId);
      if (parent) {
        // add the parent
        tx.ancestors?.set(parentId, parent);
        // check for a cached copy of this parent's ancestors
        let ancestors = visited.get(parent.txid);
        if (!ancestors) {
          // recursively fetch the parent's ancestors
          ancestors = this.setAncestors(parent, all, visited, depth + 1);
        }
        // and add to this tx's map
        ancestors.forEach((ancestor, ancestorId) => {
          tx.ancestors?.set(ancestorId, ancestor);
        });
      }
    });
    visited.set(tx.txid, tx.ancestors);

    return tx.ancestors;
  }

  /**
   * Efficiently sets a Map of in-mempool ancestors for each member of an expanded relative graph
   * by running setAncestors on each leaf, and caching intermediate results.
   * then initializes ancestor data for each transaction
   * 
   * @param all 
   */
  private initializeRelatives(all: Map<string, GraphTx>): Map<string, MempoolTx> {
    const mempoolTxs = new Map<string, MempoolTx>();
    all.forEach(entry => {
      mempoolTxs.set(entry.txid, this.convertGraphToMempoolTx(entry));
    });
    const visited: Map<string, Map<string, MempoolTx>> = new Map();
    const leaves: MempoolTx[] = Array.from(mempoolTxs.values()).filter(entry => entry.spentby.length === 0);
    for (const leaf of leaves) {
      this.setAncestors(leaf, mempoolTxs, visited);
    }
    mempoolTxs.forEach(entry => {
      entry.ancestors?.forEach(ancestor => {
        entry.ancestorcount++;
        entry.ancestorsize += ancestor.vsize;
        entry.fees.ancestor += ancestor.fees.base;
      });
      this.setAncestorScores(entry);
    });
    return mempoolTxs;
  }

  /**
   * Remove a cluster of transactions from an in-mempool dependency graph
   * and update the survivors' scores and ancestors
   * 
   * @param cluster 
   * @param ancestors 
   */
  private removeAncestors(cluster: Map<string, MempoolTx>, all: Map<string, MempoolTx>): void {
    // remove
    cluster.forEach(tx => {
      all.delete(tx.txid);
    });

    // update survivors
    all.forEach(tx => {
      cluster.forEach(remove => {
        if (tx.ancestors?.has(remove.txid)) {
          // remove as dependency
          tx.ancestors.delete(remove.txid);
          tx.depends = tx.depends.filter(parent => parent !== remove.txid);
          // update ancestor sizes and fees
          tx.ancestorsize -= remove.vsize;
          tx.fees.ancestor -= remove.fees.base;
        }
      });
      // recalculate fee rates
      this.setAncestorScores(tx);
    });
  }

  /**
   * Take a mempool transaction, and set the fee rates and ancestor score
   * 
   * @param tx 
   */
  private setAncestorScores(tx: MempoolTx): void {
    tx.individualRate = tx.fees.base / tx.vsize;
    tx.ancestorRate = tx.fees.ancestor / tx.ancestorsize;
    tx.score = Math.min(tx.individualRate, tx.ancestorRate);
  }

  // Sort by descending score
  private mempoolComparator(a, b): number {
    return b.score - a.score;
  }
}

export default new AccelerationCosts;

interface TemplateTransaction {
  txid: string;
  order: number;
  weight: number;
  adjustedVsize: number; // sigop-adjusted vsize, rounded up to the nearest integer
  sigops: number;
  fee: number;
  feeDelta: number;
  ancestors: string[];
  cluster: string[];
  effectiveFeePerVsize: number;
}

interface MinerTransaction extends TemplateTransaction {
  inputs: string[];
  feePerVsize: number;
  relativesSet: boolean;
  ancestorMap: Map<string, MinerTransaction>;
  children: Set<MinerTransaction>;
  ancestorFee: number;
  ancestorVsize: number;
  ancestorSigops: number;
  score: number;
  used: boolean;
  modified: boolean;
  dependencyRate: number;
}

/*
* Build a block using an approximation of the transaction selection algorithm from Bitcoin Core
* (see BlockAssembler in https://github.com/bitcoin/bitcoin/blob/master/src/node/miner.cpp)
*/
export function makeBlockTemplate(candidates: IEsploraApi.Transaction[], accelerations: Acceleration[], maxBlocks: number = 8, weightLimit: number = BLOCK_WEIGHT_UNITS, sigopLimit: number = BLOCK_SIGOPS): TemplateTransaction[] {
  const auditPool: Map<string, MinerTransaction> = new Map();
  const mempoolArray: MinerTransaction[] = [];
  
  candidates.forEach(tx => {
    // initializing everything up front helps V8 optimize property access later
    const adjustedVsize = Math.ceil(Math.max(tx.weight / 4, 5 * (tx.sigops || 0)));
    const feePerVsize = (tx.fee / adjustedVsize);
    auditPool.set(tx.txid, {
      txid: tx.txid,
      order: txidToOrdering(tx.txid),
      fee: tx.fee,
      feeDelta: 0,
      weight: tx.weight,
      adjustedVsize,
      feePerVsize: feePerVsize,
      effectiveFeePerVsize: feePerVsize,
      dependencyRate: feePerVsize,
      sigops: tx.sigops || 0,
      inputs: (tx.vin?.map(vin => vin.txid) || []) as string[],
      relativesSet: false,
      ancestors: [],
      cluster: [],
      ancestorMap: new Map<string, MinerTransaction>(),
      children: new Set<MinerTransaction>(),
      ancestorFee: 0,
      ancestorVsize: 0,
      ancestorSigops: 0,
      score: 0,
      used: false,
      modified: false,
    });
    mempoolArray.push(auditPool.get(tx.txid) as MinerTransaction);
  });

  // set accelerated effective fee
  for (const acceleration of accelerations) {
    const tx = auditPool.get(acceleration.txid);
    if (tx) {
      tx.feeDelta = acceleration.max_bid;
      tx.feePerVsize = ((tx.fee + tx.feeDelta) / tx.adjustedVsize);
      tx.effectiveFeePerVsize = tx.feePerVsize;
      tx.dependencyRate = tx.feePerVsize;
    }
  }

  // Build relatives graph & calculate ancestor scores
  for (const tx of mempoolArray) {
    if (!tx.relativesSet) {
      setRelatives(tx, auditPool);
    }
  }

  // Sort by descending ancestor score
  mempoolArray.sort(priorityComparator);

  // Build blocks by greedily choosing the highest feerate package
  // (i.e. the package rooted in the transaction with the best ancestor score)
  const blocks: number[][] = [];
  let blockWeight = 0;
  let blockSigops = 0;
  const transactions: MinerTransaction[] = [];
  let modified: MinerTransaction[] = [];
  const overflow: MinerTransaction[] = [];
  let failures = 0;
  while (mempoolArray.length || modified.length) {
    // skip invalid transactions
    while (mempoolArray[0].used || mempoolArray[0].modified) {
      mempoolArray.shift();
    }

    // Select best next package
    let nextTx;
    const nextPoolTx = mempoolArray[0];
    const nextModifiedTx = modified[0];
    if (nextPoolTx && (!nextModifiedTx || (nextPoolTx.score || 0) > (nextModifiedTx.score || 0))) {
      nextTx = nextPoolTx;
      mempoolArray.shift();
    } else {
      modified.shift();
      if (nextModifiedTx) {
        nextTx = nextModifiedTx;
      }
    }

    if (nextTx && !nextTx?.used) {
      // Check if the package fits into this block
      if (blocks.length >= (maxBlocks - 1) || ((blockWeight + (4 * nextTx.ancestorVsize) < weightLimit) && (blockSigops + nextTx.ancestorSigops <= sigopLimit))) {
        const ancestors: MinerTransaction[] = Array.from(nextTx.ancestorMap.values());
        // sort ancestors by dependency graph (equivalent to sorting by ascending ancestor count)
        const sortedTxSet = [...ancestors.sort((a, b) => { return (a.ancestorMap.size || 0) - (b.ancestorMap.size || 0); }), nextTx];
        const clusterTxids = sortedTxSet.map(tx => tx.txid);
        const effectiveFeeRate = Math.min(nextTx.dependencyRate || Infinity, nextTx.ancestorFee / nextTx.ancestorVsize);
        const used: MinerTransaction[] = [];
        while (sortedTxSet.length) {
          const ancestor = sortedTxSet.pop();
          if (!ancestor) {
            continue;
          }
          ancestor.used = true;
          ancestor.usedBy = nextTx.txid;
          // update this tx with effective fee rate & relatives data
          if (ancestor.effectiveFeePerVsize !== effectiveFeeRate) {
            ancestor.effectiveFeePerVsize = effectiveFeeRate;
          }
          ancestor.cluster = clusterTxids;
          transactions.push(ancestor);
          blockWeight += ancestor.weight;
          blockSigops += ancestor.sigops;
          used.push(ancestor);
        }

        // remove these as valid package ancestors for any descendants remaining in the mempool
        if (used.length) {
          used.forEach(tx => {
            modified = updateDescendants(tx, auditPool, modified, effectiveFeeRate);
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
    const exceededPackageTries = failures > 1000 && blockWeight > (weightLimit - 4000);
    const queueEmpty = !mempoolArray.length && !modified.length;

    if (exceededPackageTries || queueEmpty) {
      break;
    }
  }

  for (const tx of transactions) {
    tx.ancestors = Object.values(tx.ancestorMap);
  }

  return transactions;
}

// traverse in-mempool ancestors
// recursion unavoidable, but should be limited to depth < 25 by mempool policy
function setRelatives(
  tx: MinerTransaction,
  mempool: Map<string, MinerTransaction>,
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
        tx.ancestorMap.set(ancestor.txid, ancestor);
      });
    }
  };
  tx.ancestorFee = (tx.fee + tx.feeDelta);
  tx.ancestorVsize = tx.adjustedVsize || 0;
  tx.ancestorSigops = tx.sigops || 0;
  tx.ancestorMap.forEach((ancestor) => {
    tx.ancestorFee += (ancestor.fee + ancestor.feeDelta);
    tx.ancestorVsize += ancestor.adjustedVsize;
    tx.ancestorSigops += ancestor.sigops;
  });
  tx.score = tx.ancestorFee / tx.ancestorVsize;
  tx.relativesSet = true;
}

// iterate over remaining descendants, removing the root as a valid ancestor & updating the ancestor score
// avoids recursion to limit call stack depth
function updateDescendants(
  rootTx: MinerTransaction,
  mempool: Map<string, MinerTransaction>,
  modified: MinerTransaction[],
  clusterRate: number,
): MinerTransaction[] {
  const descendantSet: Set<MinerTransaction> = new Set();
  // stack of nodes left to visit
  const descendants: MinerTransaction[] = [];
  let descendantTx: MinerTransaction | undefined;
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
      descendantTx.ancestorFee -= (rootTx.fee + rootTx.feeDelta);
      descendantTx.ancestorVsize -= rootTx.adjustedVsize;
      descendantTx.ancestorSigops -= rootTx.sigops;
      descendantTx.score = descendantTx.ancestorFee / descendantTx.ancestorVsize;
      descendantTx.dependencyRate = descendantTx.dependencyRate ? Math.min(descendantTx.dependencyRate, clusterRate) : clusterRate;

      if (!descendantTx.modified) {
        descendantTx.modified = true;
        modified.push(descendantTx);
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
  // return new, resorted modified list
  return modified.sort(priorityComparator);
}

// Used to sort an array of MinerTransactions by descending ancestor score
function priorityComparator(a: MinerTransaction, b: MinerTransaction): number {
  if (b.score === a.score) {
    // tie-break by txid for stability
    return a.order - b.order;
  } else {
    return b.score - a.score;
  }
}

// returns the most significant 4 bytes of the txid as an integer
function txidToOrdering(txid: string): number {
  return parseInt(
    txid.substring(62, 64) +
      txid.substring(60, 62) +
      txid.substring(58, 60) +
      txid.substring(56, 58),
    16
  );
}
