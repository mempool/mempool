import { Ancestor, CpfpCluster, CpfpInfo, MempoolTransactionExtended, TemplateAlgorithm, TransactionExtended } from '../mempool.interfaces';
import { GraphTx, convertToGraphTx, expandRelativesGraph, initializeRelatives, makeBlockTemplate, mempoolComparator, removeAncestors, setAncestorScores } from './mini-miner';
import memPool from './mempool';
import { Acceleration } from './acceleration/acceleration';
import { ClusterMempool } from '../cluster-mempool/cluster-mempool';

const CPFP_UPDATE_INTERVAL = 60_000; // update CPFP info at most once per 60s per transaction
const MAX_CLUSTER_ITERATIONS = 100;

type TransactionCpfpData = Partial<CpfpInfo & { cpfpDirty?: boolean, clusterId?: number, chunkIndex?: number }>;
export interface BlockCpfpData {
  txs: Record<string, TransactionCpfpData>,
  clusters: CpfpCluster[];
  version: number;
}

export function calculateFastBlockCpfp(height: number, transactions: MempoolTransactionExtended[], saveRelatives: boolean = false): BlockCpfpData {
  const clusters: CpfpCluster[] = []; // list of all cpfp clusters in this block
  const clusterMap: { [txid: string]: CpfpCluster } = {}; // map transactions to their cpfp cluster
  let clusterTxs: TransactionExtended[] = []; // working list of elements of the current cluster
  let ancestors: { [txid: string]: boolean } = {}; // working set of ancestors of the current cluster root
  const txMap: { [txid: string]: TransactionExtended } = {};
  const cpfpData: Record<string, TransactionCpfpData> = {};
  // initialize the txMap
  for (const tx of transactions) {
    txMap[tx.txid] = tx;
    cpfpData[tx.txid] = {};
  }
  // reverse pass to identify CPFP clusters
  for (let i = transactions.length - 1; i >= 0; i--) {
    const tx = transactions[i];
    if (!ancestors[tx.txid]) {
      let totalFee = 0;
      let totalVSize = 0;
      clusterTxs.forEach(tx => {
        totalFee += tx?.fee || 0;
        totalVSize += (tx.weight / 4);
      });
      const effectiveFeePerVsize = totalFee / totalVSize;
      let cluster: CpfpCluster;
      if (clusterTxs.length > 1) {
        cluster = {
          root: clusterTxs[0].txid,
          height,
          txs: clusterTxs.map(tx => { return { txid: tx.txid, weight: tx.weight, fee: tx.fee || 0 }; }),
          effectiveFeePerVsize,
        };
        clusters.push(cluster);
      }
      clusterTxs.forEach(tx => {
        cpfpData[tx.txid] = {
          effectiveFeePerVsize
        };
        if (cluster) {
          clusterMap[tx.txid] = cluster;
        }
      });
      // reset working vars
      clusterTxs = [];
      ancestors = {};
    }
    clusterTxs.push(tx);
    tx.vin.forEach(vin => {
      ancestors[vin.txid] = true;
    });
  }
  // forward pass to enforce ancestor rate caps
  for (const tx of transactions) {
    const txRate = cpfpData[tx.txid]?.effectiveFeePerVsize ?? tx.effectiveFeePerVsize;
    let minAncestorRate = txRate;
    for (const vin of tx.vin) {
      const vinRate = cpfpData[vin.txid]?.effectiveFeePerVsize ?? txMap[vin.txid]?.effectiveFeePerVsize;
      if (vinRate) {
        minAncestorRate = Math.min(minAncestorRate, vinRate);
      }
    }
    // check rounded values to skip cases with almost identical fees
    const roundedMinAncestorRate = Math.ceil(minAncestorRate);
    const roundedEffectiveFeeRate = Math.floor(txRate);
    if (roundedMinAncestorRate < roundedEffectiveFeeRate) {
      cpfpData[tx.txid].effectiveFeePerVsize = minAncestorRate;
      if (!clusterMap[tx.txid]) {
        // add a single-tx cluster to record the dependent rate
        const cluster = {
          root: tx.txid,
          height,
          txs: [{ txid: tx.txid, weight: tx.weight, fee: tx.fee || 0 }],
          effectiveFeePerVsize: minAncestorRate,
        };
        clusterMap[tx.txid] = cluster;
        clusters.push(cluster);
      } else {
        // update the existing cluster with the dependent rate
        clusterMap[tx.txid].effectiveFeePerVsize = minAncestorRate;
      }
    }
  }
  if (saveRelatives) {
    for (const cluster of clusters) {
      cluster.txs.forEach((member, index) => {
        cpfpData[member.txid].descendants = cluster.txs.slice(0, index).reverse();
        cpfpData[member.txid].ancestors = cluster.txs.slice(index + 1).reverse();
        cpfpData[member.txid].effectiveFeePerVsize = cluster.effectiveFeePerVsize;
      });
    }
  }
  return {
    txs: cpfpData,
    clusters,
    version: 1,
  };
}

export function calculateGoodBlockCpfp(height: number, transactions: MempoolTransactionExtended[], accelerations: Acceleration[]): BlockCpfpData {
  const txMap: { [txid: string]: MempoolTransactionExtended } = {};
  const cpfpData: Record<string, TransactionCpfpData> = {};
  for (const tx of transactions) {
    txMap[tx.txid] = tx;
    cpfpData[tx.txid] = {};
  }
  const template = makeBlockTemplate(transactions, accelerations, 1, Infinity, Infinity);
  const clusters = new Map<string, string[]>();
  for (const tx of template) {
    const cluster = tx.cluster || [];
    const root = cluster.length ? cluster[cluster.length - 1] : null;
    if (cluster.length > 1 && root && !clusters.has(root)) {
      clusters.set(root, cluster);
    }
    cpfpData[tx.txid].effectiveFeePerVsize = tx.effectiveFeePerVsize;
  }

  const clusterArray: CpfpCluster[] = [];

  for (const cluster of clusters.values()) {
    for (const txid of cluster) {
      const mempoolTxCpfpData = cpfpData[txid];
      if (mempoolTxCpfpData) {
        const ancestors: Ancestor[] = [];
        const descendants: Ancestor[] = [];
        let matched = false;
        cluster.forEach(relativeTxid => {
          if (relativeTxid === txid) {
            matched = true;
          } else {
            const relative = {
              txid: relativeTxid,
              fee: txMap[relativeTxid].fee,
              weight: (txMap[relativeTxid].adjustedVsize * 4) || txMap[relativeTxid].weight,
            };
            if (matched) {
              descendants.push(relative);
            } else {
              ancestors.push(relative);
            }
          }
        });
        if (mempoolTxCpfpData.ancestors?.length !== ancestors.length || mempoolTxCpfpData.descendants?.length !== descendants.length) {
          mempoolTxCpfpData.cpfpDirty = true;
        }
        Object.assign(mempoolTxCpfpData, { ancestors, descendants, bestDescendant: null, cpfpChecked: true });
      }
    }
    const root = cluster[cluster.length - 1];
    clusterArray.push({
      root: root,
      height,
      txs: cluster.reverse().map(txid => ({
        txid,
        fee: txMap[txid].fee,
        weight: (txMap[txid].adjustedVsize * 4) || txMap[txid].weight,
      })),
      effectiveFeePerVsize: cpfpData[root].effectiveFeePerVsize ?? txMap[root].effectiveFeePerVsize,
    });
  }

  return {
    txs: cpfpData,
    clusters: clusterArray,
    version: 2,
  };
}

export function calculateClusterMempoolBlockCpfp(height: number, transactions: MempoolTransactionExtended[], accelerations: Acceleration[]): BlockCpfpData {
  const txMap: { [txid: string]: MempoolTransactionExtended } = {};
  const cpfpData: Record<string, TransactionCpfpData> = {};
  for (const tx of transactions) {
    txMap[tx.txid] = tx;
    cpfpData[tx.txid] = {};
  }

  const accelMap: { [txid: string]: { feeDelta: number } } = {};
  for (const acc of accelerations) {
    accelMap[acc.txid] = { feeDelta: acc.max_bid };
  }

  const cm = new ClusterMempool(txMap, accelMap, false, 25000);

  const seenClusters = new Set<number>();
  const clusters: CpfpCluster[] = [];

  for (const txid in cpfpData) {
    const txCpfpData = cm.getCpfpDataForTx(txid);
    if (!txCpfpData) {
      continue;
    }
    cpfpData[txid].effectiveFeePerVsize = txCpfpData.effectiveFeePerVsize;
    cpfpData[txid].clusterId = txCpfpData.clusterId;
    cpfpData[txid].chunkIndex = txCpfpData.chunkIndex;
    cpfpData[txid].ancestors = txCpfpData.ancestors;
    cpfpData[txid].descendants = txCpfpData.descendants;
    if (txCpfpData.clusterId !== undefined && !seenClusters.has(txCpfpData.clusterId)) {
      seenClusters.add(txCpfpData.clusterId);

      const clusterData = cm.getCluster(txCpfpData.clusterId);
      if (clusterData && clusterData.txs.length > 1) {
        let totalFee = 0;
        let totalWeight = 0;
        for (const t of clusterData.txs) {
          totalFee += t.fee;
          totalWeight += t.weight;
        }
        clusters.push({
          root: clusterData.txs[0].txid,
          height,
          txs: clusterData.txs.map(t => ({ txid: t.txid, weight: t.weight, fee: t.fee })),
          effectiveFeePerVsize: totalFee / (totalWeight / 4),
          templateAlgorithm: TemplateAlgorithm.clusterMempool,
          clusterData,
        });
      }
    }
  }

  return {
    txs: cpfpData,
    clusters,
    version: 3,
  };
}

/**
 * Takes a mempool transaction and a copy of the current mempool, and calculates the CPFP data for
 * that transaction (and all others in the same cluster)
 * If the passed transaction is not guaranteed to be in the mempool, set localTx to true: this will
 * prevent updating the CPFP data of other transactions in the cluster
 */
export function calculateMempoolTxCpfp(tx: MempoolTransactionExtended, mempool: { [txid: string]: MempoolTransactionExtended }, localTx: boolean = false): CpfpInfo {
  if (tx.cpfpUpdated && Date.now() < (tx.cpfpUpdated + CPFP_UPDATE_INTERVAL)) {
    tx.cpfpDirty = false;
    return {
      ancestors: tx.ancestors || [],
      bestDescendant: tx.bestDescendant || null,
      descendants: tx.descendants || [],
      effectiveFeePerVsize: tx.effectiveFeePerVsize || tx.adjustedFeePerVsize || tx.feePerVsize,
      sigops: tx.sigops,
      fee: tx.fee,
      adjustedVsize: tx.adjustedVsize,
      acceleration: tx.acceleration
    };
  }

  const ancestorMap = new Map<string, GraphTx>();
  const graphTx = convertToGraphTx(tx, memPool.getSpendMap());
  ancestorMap.set(tx.txid, graphTx);

  const allRelatives = expandRelativesGraph(mempool, ancestorMap, memPool.getSpendMap());
  const relativesMap = initializeRelatives(allRelatives);
  const cluster = calculateCpfpCluster(tx.txid, relativesMap);

  let totalVsize = 0;
  let totalFee = 0;
  for (const tx of cluster.values()) {
    totalVsize += tx.vsize;
    totalFee += tx.fees.base;
  }
  const effectiveFeePerVsize = totalFee / totalVsize;

  if (localTx) {
    tx.effectiveFeePerVsize = effectiveFeePerVsize;
    tx.ancestors = Array.from(cluster.get(tx.txid)?.ancestors.values() || []).map(ancestor => ({ txid: ancestor.txid, weight: ancestor.weight, fee: ancestor.fees.base }));
    tx.descendants = Array.from(cluster.values()).filter(entry => entry.txid !== tx.txid && !cluster.get(tx.txid)?.ancestors.has(entry.txid)).map(tx => ({ txid: tx.txid, weight: tx.weight, fee: tx.fees.base }));
    tx.bestDescendant = null;
  } else {
    for (const tx of cluster.values()) {
      mempool[tx.txid].effectiveFeePerVsize = effectiveFeePerVsize;
      mempool[tx.txid].ancestors = Array.from(tx.ancestors.values()).map(tx => ({ txid: tx.txid, weight: tx.weight, fee: tx.fees.base }));
      mempool[tx.txid].descendants = Array.from(cluster.values()).filter(entry => entry.txid !== tx.txid && !tx.ancestors.has(entry.txid)).map(tx => ({ txid: tx.txid, weight: tx.weight, fee: tx.fees.base }));
      mempool[tx.txid].bestDescendant = null;
      mempool[tx.txid].cpfpChecked = true;
      mempool[tx.txid].cpfpDirty = true;
      mempool[tx.txid].cpfpUpdated = Date.now();
    }

    tx = mempool[tx.txid];

  }

  return {
    ancestors: tx.ancestors || [],
    bestDescendant: tx.bestDescendant || null,
    descendants: tx.descendants || [],
    effectiveFeePerVsize: tx.effectiveFeePerVsize || tx.adjustedFeePerVsize || tx.feePerVsize,
    sigops: tx.sigops,
    fee: tx.fee,
    adjustedVsize: tx.adjustedVsize,
    acceleration: tx.acceleration
  };
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
  let maxIterations = MAX_CLUSTER_ITERATIONS;
  let best = sortedRelatives.shift();
  let bestCluster = new Map<string, GraphTx>(best?.ancestors?.entries() || []);
  while (sortedRelatives.length && best && (best.txid !== tx.txid && !best.ancestors.has(tx.txid)) && maxIterations > 0) {
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
        bestCluster = new Map<string, GraphTx>(best?.ancestors?.entries() || []);
        bestCluster.set(best?.txid, best);
      }
    }
  }

  bestCluster.set(tx.txid, tx);

  return bestCluster;
}