import logger from '../../logger';
import { MempoolTransactionExtended } from '../../mempool.interfaces';
import { GraphTx, getSameBlockRelatives, initializeRelatives, makeBlockTemplate, mempoolComparator, removeAncestors, setAncestorScores } from '../mini-miner';

const BLOCK_WEIGHT_UNITS = 4_000_000;
const MAX_RELATIVE_GRAPH_SIZE = 200;
const BID_BOOST_WINDOW = 40_000;
const BID_BOOST_MIN_OFFSET = 10_000;
const BID_BOOST_MAX_OFFSET = 400_000;

export type Acceleration = {
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

class AccelerationCosts {
  /**
   * Takes a list of accelerations and verbose block data
   * Returns the "fair" boost rate to charge accelerations
   *
   * @param accelerationsx
   * @param verboseBlock
   */
  public calculateBoostRate(accelerations: Acceleration[], blockTxs: MempoolTransactionExtended[]): number {
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
    const allRelatives = getSameBlockRelatives(tx, transactions);
    const relativesMap = initializeRelatives(allRelatives);
    const rootTx = relativesMap.get(tx.txid) as GraphTx;

    // Calculate cost to boost
    return this.calculateAccelerationAncestors(rootTx, relativesMap, targetFeeRate);
  }

  /**
   * Given a root transaction, a list of in-mempool ancestors, and a target fee rate,
   * Calculate the minimum set of transactions to fee-bump, their total vsize + fees
   *
   * @param tx
   * @param ancestors
   */
  private calculateAccelerationAncestors(tx: GraphTx, relatives: Map<string, GraphTx>, targetFeeRate: number): AccelerationInfo {
    // add root tx to the ancestor map
    relatives.set(tx.txid, tx);

    // Check for high-sigop transactions (not supported)
    relatives.forEach(entry => {
      if (entry.vsize > Math.ceil(entry.weight / 4)) {
        throw new Error(`high_sigop_tx`);
      }
    });

    // Initialize individual & ancestor fee rates
    relatives.forEach(entry => setAncestorScores(entry));

    // Sort by descending ancestor score
    let sortedRelatives = Array.from(relatives.values()).sort(mempoolComparator);

    let includedInCluster: Map<string, GraphTx> | null = null;

    // While highest score >= targetFeeRate
    let maxIterations = MAX_RELATIVE_GRAPH_SIZE;
    while (sortedRelatives.length && sortedRelatives[0].score && sortedRelatives[0].score >= targetFeeRate && maxIterations > 0) {
      maxIterations--;
      // Grab the highest scoring entry
      const best = sortedRelatives.shift();
      if (best) {
        const cluster = new Map<string, GraphTx>(best.ancestors?.entries() || []);
        if (best.ancestors.has(tx.txid)) {
          includedInCluster = cluster;
        }
        cluster.set(best.txid, best);
        // Remove this cluster (it already pays over the target rate, so doesn't need to be boosted)
        // and update scores, ancestor totals and dependencies for the survivors
        removeAncestors(cluster, relatives);

        // re-sort
        sortedRelatives = Array.from(relatives.values()).sort(mempoolComparator);
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
}

export default new AccelerationCosts;