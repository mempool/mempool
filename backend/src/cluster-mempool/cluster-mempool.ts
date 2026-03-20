import { ClusterTx, DepGraph, sortTopological, subgraph } from './depgraph';
import { linearizeCluster, LinearizationChunk } from './linearize';
import { ProjectedBlock, assembleBlocks } from './block-builder';
import { CpfpClusterData, CpfpClusterTx, MempoolTransactionExtended } from '../mempool.interfaces';
import logger from '../logger';

export interface MempoolDiff {
  added: MempoolTransactionExtended[];
  removed: string[];
  accelerations: { [txid: string]: { feeDelta: number } };
}

export interface ClusterInfo {
  clusterId: number;
  chunkIndex: number;
  chunkFeerate: number;
}

export { ProjectedBlock };

export interface Cluster {
  id: number;
  depgraph: DepGraph;
  txs: Map<string, ClusterTx>;
  linearization: ClusterTx[];
  chunks: LinearizationChunk[];
  dirty: boolean;
}

export class ClusterMempool {
  private clusters = new Map<number, Cluster>();
  private txToCluster = new Map<string, number>();
  private spentBy = new Map<string, string>();
  private mempool: Readonly<{ [txid: string]: MempoolTransactionExtended }>;
  private accelerations: { [txid: string]: { feeDelta: number } } = {};
  private nextClusterId = 0;

  constructor(mempool: { [txid: string]: MempoolTransactionExtended }, accelerations?: { [txid: string]: { feeDelta: number } }) {
    this.mempool = mempool;
    if (accelerations) {
      this.accelerations = accelerations;
    }
    this.buildFromMempool();
  }

  applyMempoolChange(diff: MempoolDiff): void {
    this.processRemovals(diff.removed);
    this.splitDisconnectedClusters();
    this.processAccelerationChanges(diff.accelerations);
    this.processAdditions(diff.added);
    this.relinearizeDirtyClusters();
  }

  getBlocks(n: number, enforceLimit = false): ProjectedBlock[] {
    return assembleBlocks(n, this.clusters, this.mempool, enforceLimit);
  }

  getCluster(clusterId: number): CpfpClusterData | null {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return null;
    }
    return this.buildClusterData(cluster);
  }

  getClusterInfo(txid: string): ClusterInfo | null {
    const match = this.getClusterForTx(txid);
    if (!match) {
      return null;
    }
    return this.findChunkInfo(match.cluster, match.clusterTx);
  }

  getClusterForApi(txid: string): (CpfpClusterData & { chunkIndex: number }) | null {
    const info = this.getClusterInfo(txid);
    if (!info) {
      return null;
    }
    const cluster = this.getCluster(info.clusterId);
    if (!cluster || cluster.txs.length <= 1) {
      return null;
    }
    return { ...cluster, chunkIndex: info.chunkIndex };
  }

  getClusterCount(): number {
    return this.clusters.size;
  }

  getTxCount(): number {
    return this.txToCluster.size;
  }

  private getClusterForTx(txid: string): { cluster: Cluster; clusterTx: ClusterTx } | null {
    const clusterId = this.txToCluster.get(txid);
    if (clusterId === undefined) {
      return null;
    }
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return null;
    }
    const clusterTx = cluster.txs.get(txid);
    if (!clusterTx) {
      return null;
    }
    return { cluster, clusterTx };
  }

  private buildFromMempool(): void {
    const parentMap = this.buildMempoolParentMap();
    this.spentBy = this.buildSpentByMap();
    const components = this.findMempoolComponents(parentMap);
    for (const component of components) {
      this.createClusterFromTxids(component, parentMap);
    }
  }

  private buildMempoolParentMap(): Map<string, Set<string>> {
    const parents = new Map<string, Set<string>>();
    for (const [txid, tx] of Object.entries(this.mempool)) {
      const txParents = new Set<string>();
      for (const vin of tx.vin) {
        if (!vin.is_coinbase && this.mempool[vin.txid]) {
          txParents.add(vin.txid);
        }
      }
      if (txParents.size > 0) {
        parents.set(txid, txParents);
      }
    }
    return parents;
  }

  private buildSpentByMap(): Map<string, string> {
    const spentBy = new Map<string, string>();
    for (const [txid, tx] of Object.entries(this.mempool)) {
      for (const vin of tx.vin) {
        if (!vin.is_coinbase) {
          spentBy.set(`${vin.txid}:${vin.vout}`, txid);
        }
      }
    }
    return spentBy;
  }

  private findMempoolComponents(
    parentMap: Map<string, Set<string>>
  ): Set<string>[] {
    const visited = new Set<string>();
    const components: Set<string>[] = [];

    for (const txid of Object.keys(this.mempool)) {
      if (!visited.has(txid)) {
        const component = this.dfsComponent(txid, parentMap, visited);
        components.push(component);
      }
    }
    return components;
  }

  private dfsComponent(
    startTxid: string,
    parentMap: Map<string, Set<string>>,
    visited: Set<string>
  ): Set<string> {
    const component = new Set<string>();
    const stack = [startTxid];
    while (stack.length > 0) {
      const current = stack.pop();
      if (current !== undefined && !visited.has(current)) {
        visited.add(current);
        component.add(current);

        const txParents = parentMap.get(current);
        if (txParents) {
          for (const p of txParents) {
            if (!visited.has(p)) {
              stack.push(p);
            }
          }
        }

        const tx = this.mempool[current];
        if (tx) {
          for (let vout = 0; vout < tx.vout.length; vout++) {
            const child = this.spentBy.get(`${current}:${vout}`);
            if (child && !visited.has(child)) {
              stack.push(child);
            }
          }
        }
      }
    }
    return component;
  }

  private effectiveFee(txid: string, tx: MempoolTransactionExtended): number {
    return tx.fee + (this.accelerations[txid]?.feeDelta || 0);
  }

  private adjustedWeight(tx: MempoolTransactionExtended): number {
    return Math.max(tx.weight, (tx.sigops || 0) * 20);
  }

  private createClusterFromTxids(
    txids: Set<string>,
    parentMap: Map<string, Set<string>>
  ): Cluster | null {
    const clusterId = this.nextClusterId++;
    const depgraph = new DepGraph();
    const txMap = new Map<string, ClusterTx>();

    for (const txid of txids) {
      const tx = this.mempool[txid];
      if (!tx) {
        logger.warn(`Warning: missing mempool tx ${txid} during cluster creation, skipping`);
        return null;
      }
      const clusterTx = depgraph.addTransaction(txid, this.effectiveFee(txid, tx), this.adjustedWeight(tx), tx.order ?? 0);
      txMap.set(txid, clusterTx);
    }

    for (const txid of txids) {
      const txParents = parentMap.get(txid);
      if (txParents) {
        for (const parentTxid of txParents) {
          if (txids.has(parentTxid)) {
            const parentTx = txMap.get(parentTxid);
            const childTx = txMap.get(txid);
            if (parentTx && childTx) {
              depgraph.addDependency(parentTx, childTx);
            }
          }
        }
      }
    }

    const { linearization, chunks } = linearizeCluster(depgraph.getTxs());

    const cluster: Cluster = {
      id: clusterId,
      depgraph,
      txs: txMap,
      linearization,
      chunks,
      dirty: false,
    };

    this.clusters.set(clusterId, cluster);
    for (const txid of txids) {
      this.txToCluster.set(txid, clusterId);
    }

    this.writeBackCluster(cluster);
    return cluster;
  }

  private writeBackCluster(cluster: Cluster): void {
    for (let chunkIdx = 0; chunkIdx < cluster.chunks.length; chunkIdx++) {
      const chunk = cluster.chunks[chunkIdx];
      const chunkFeerate = chunk.weight > 0 ? (chunk.fee * 4) / chunk.weight : 0;
      const chunkSet = chunk.txs.length > 1 ? new Set(chunk.txs) : null;
      for (const clusterTx of chunk.txs) {
        this.writeBackTx(cluster, clusterTx, chunkIdx, chunkFeerate, chunkSet);
      }
    }
  }

  private writeBackTx(
    cluster: Cluster,
    clusterTx: ClusterTx,
    chunkIdx: number,
    chunkFeerate: number,
    chunkSet: Set<ClusterTx> | null
  ): void {
    const txid = clusterTx.txid;
    if (!this.mempool[txid]) {
      logger.warn(`ClusterMempool.writeBackTx: ${txid} missing from mempool (cluster ${cluster.id})`);
      return;
    }
    const tx = this.mempool[txid];
    if (tx.effectiveFeePerVsize !== chunkFeerate || tx.clusterId !== cluster.id) {
      tx.cpfpDirty = true;
    }
    tx.effectiveFeePerVsize = chunkFeerate;
    tx.clusterId = cluster.id;
    tx.chunkIndex = chunkIdx;
    tx.cpfpChecked = true;

    if (chunkSet) {
      tx.ancestors = this.getChunkRelatives(clusterTx, chunkSet, 'ancestors');
      tx.descendants = this.getChunkRelatives(clusterTx, chunkSet, 'descendants');
    } else {
      tx.ancestors = [];
      tx.descendants = [];
    }
  }

  private getChunkRelatives(
    clusterTx: ClusterTx,
    chunkSet: Set<ClusterTx>,
    direction: 'ancestors' | 'descendants'
  ): { txid: string; fee: number; weight: number }[] {
    const relatives: { txid: string; fee: number; weight: number }[] = [];
    const related = direction === 'ancestors' ? clusterTx.ancestors : clusterTx.descendants;
    for (const rel of related) {
      if (rel !== clusterTx && chunkSet.has(rel)) {
        const mempoolTx = this.mempool[rel.txid];
        if (mempoolTx) {
          relatives.push({ txid: rel.txid, fee: mempoolTx.fee, weight: mempoolTx.weight });
        } else {
          logger.warn(`ClusterMempool.getChunkRelatives: ${rel.txid} missing from mempool`);
        }
      }
    }
    return relatives;
  }

  private processRemovals(removed: string[]): void {
    for (const txid of removed) {
      const tx = this.mempool[txid];
      if (tx) {
        for (const vin of tx.vin) {
          if (!vin.is_coinbase) {
            this.spentBy.delete(`${vin.txid}:${vin.vout}`);
          }
        }
      } else if (this.txToCluster.has(txid)) {
        logger.warn(`ClusterMempool.processRemovals: ${txid} missing from mempool, spentBy cleanup skipped`);
      }
    }

    for (const txid of removed) {
      const match = this.getClusterForTx(txid);
      if (match) {
        match.cluster.depgraph.removeTransactions(new Set([match.clusterTx]));
        match.cluster.txs.delete(txid);
        match.cluster.linearization = match.cluster.linearization.filter(t => t !== match.clusterTx);
        this.txToCluster.delete(txid);
        match.cluster.dirty = true;
      }
    }
  }

  private splitDisconnectedClusters(): void {
    for (const [clusterId, cluster] of [...this.clusters]) {
      if (cluster.dirty) {
        if (cluster.depgraph.size === 0) {
          this.clusters.delete(clusterId);
        } else {
          const components = cluster.depgraph.findConnectedComponents();
          if (components.length > 1) {
            this.clusters.delete(clusterId);
            for (const component of components) {
              this.splitComponentToCluster(cluster, component);
            }
          }
        }
      }
    }
  }

  private splitComponentToCluster(sourceCluster: Cluster, component: Set<ClusterTx>): void {
    const newClusterId = this.nextClusterId++;
    const { depgraph: newDepgraph, txMap } = subgraph(component);

    const newTxs = new Map<string, ClusterTx>();
    for (const oldTx of component) {
      const newTx = txMap.get(oldTx);
      if (newTx) {
        newTxs.set(oldTx.txid, newTx);
        this.txToCluster.set(oldTx.txid, newClusterId);
      }
    }

    const newLinearization: ClusterTx[] = [];
    for (const oldTx of sourceCluster.linearization) {
      if (component.has(oldTx)) {
        const newTx = txMap.get(oldTx);
        if (newTx) {
          newLinearization.push(newTx);
        }
      }
    }

    const newCluster: Cluster = {
      id: newClusterId,
      dirty: true,
      depgraph: newDepgraph,
      txs: newTxs,
      linearization: newLinearization,
      chunks: [],
    };
    this.clusters.set(newClusterId, newCluster);
  }

  private processAdditions(added: MempoolTransactionExtended[]): void {
    for (const tx of added) {
      const txid = tx.txid;

      for (const vin of tx.vin) {
        if (!vin.is_coinbase) {
          this.spentBy.set(`${vin.txid}:${vin.vout}`, txid);
        }
      }

      const { relatedClusterIds, parentTxids, childTxids } = this.findRelatedClusters(tx);

      if (relatedClusterIds.size === 0) {
        this.addSingletonCluster(tx);
      } else if (relatedClusterIds.size === 1) {
        this.addToExistingCluster(tx, relatedClusterIds, parentTxids, childTxids);
      } else {
        this.mergeAndAddToCluster(tx, relatedClusterIds, parentTxids, childTxids);
      }
    }
  }

  private findRelatedClusters(tx: MempoolTransactionExtended): {
    relatedClusterIds: Set<number>;
    parentTxids: string[];
    childTxids: string[];
  } {
    const relatedClusterIds = new Set<number>();
    const parentTxids: string[] = [];
    const childTxids: string[] = [];

    for (const vin of tx.vin) {
      if (!vin.is_coinbase && this.mempool[vin.txid]) {
        const parentCluster = this.txToCluster.get(vin.txid);
        if (parentCluster !== undefined) {
          relatedClusterIds.add(parentCluster);
          parentTxids.push(vin.txid);
        }
      }
    }

    for (let vout = 0; vout < tx.vout.length; vout++) {
      const childTxid = this.spentBy.get(`${tx.txid}:${vout}`);
      if (childTxid && this.mempool[childTxid]) {
        const childCluster = this.txToCluster.get(childTxid);
        if (childCluster !== undefined) {
          relatedClusterIds.add(childCluster);
          childTxids.push(childTxid);
        }
      }
    }

    return { relatedClusterIds, parentTxids, childTxids };
  }

  private addSingletonCluster(tx: MempoolTransactionExtended): void {
    const txid = tx.txid;
    const clusterId = this.nextClusterId++;
    const depgraph = new DepGraph();
    const clusterTx = depgraph.addTransaction(txid, this.effectiveFee(txid, tx), this.adjustedWeight(tx), tx.order ?? 0);

    const cluster: Cluster = {
      id: clusterId,
      dirty: true,
      depgraph,
      txs: new Map([[txid, clusterTx]]),
      linearization: [clusterTx],
      chunks: [],
    };
    this.clusters.set(clusterId, cluster);
    this.txToCluster.set(txid, clusterId);
  }

  private addToExistingCluster(
    tx: MempoolTransactionExtended,
    relatedClusterIds: Set<number>,
    parentTxids: string[],
    childTxids: string[],
  ): void {
    const txid = tx.txid;
    const clusterId = [...relatedClusterIds][0];
    const cluster = this.clusters.get(clusterId);
    if (!cluster) {
      return;
    }
    const clusterTx = cluster.depgraph.addTransaction(txid, this.effectiveFee(txid, tx), this.adjustedWeight(tx), tx.order ?? 0);
    cluster.txs.set(txid, clusterTx);
    cluster.linearization.push(clusterTx);
    this.txToCluster.set(txid, clusterId);

    this.addParentDeps(cluster, clusterTx, parentTxids);
    this.addChildDeps(cluster, clusterTx, childTxids);
    cluster.dirty = true;
  }

  private mergeAndAddToCluster(
    tx: MempoolTransactionExtended,
    relatedClusterIds: Set<number>,
    parentTxids: string[],
    childTxids: string[],
  ): void {
    const txid = tx.txid;
    const clusterIds = [...relatedClusterIds];
    const primaryId = clusterIds[0];
    const primary = this.clusters.get(primaryId);
    if (!primary) {
      return;
    }

    for (let i = 1; i < clusterIds.length; i++) {
      const otherId = clusterIds[i];
      const other = this.clusters.get(otherId);
      if (other) {
        this.mergeClusterInto(primary, other);
        this.clusters.delete(otherId);
      }
    }

    const clusterTx = primary.depgraph.addTransaction(txid, this.effectiveFee(txid, tx), this.adjustedWeight(tx), tx.order ?? 0);
    primary.txs.set(txid, clusterTx);
    primary.linearization.push(clusterTx);
    this.txToCluster.set(txid, primaryId);

    this.addParentDeps(primary, clusterTx, parentTxids);
    this.addChildDeps(primary, clusterTx, childTxids);
    primary.dirty = true;
  }

  private addParentDeps(cluster: Cluster, childTx: ClusterTx, parentTxids: string[]): void {
    for (const parentTxid of parentTxids) {
      const parentTx = cluster.txs.get(parentTxid);
      if (parentTx) {
        cluster.depgraph.addDependency(parentTx, childTx);
      }
    }
  }

  private addChildDeps(cluster: Cluster, parentTx: ClusterTx, childTxids: string[]): void {
    for (const childTxid of childTxids) {
      const childTx = cluster.txs.get(childTxid);
      if (childTx) {
        cluster.depgraph.addDependency(parentTx, childTx);
      }
    }
  }

  private mergeClusterInto(primary: Cluster, other: Cluster): void {
    for (const [txid, otherTx] of other.txs) {
      const newTx = primary.depgraph.addTransaction(txid, otherTx.effectiveFee, otherTx.weight, otherTx.order);
      primary.txs.set(txid, newTx);
      this.txToCluster.set(txid, primary.id);
    }

    for (const otherTx of other.depgraph.getTxs()) {
      for (const parent of otherTx.parents) {
        const newChild = primary.txs.get(otherTx.txid);
        const newParent = primary.txs.get(parent.txid);
        if (newChild && newParent) {
          primary.depgraph.addDependency(newParent, newChild);
        }
      }
    }

    for (const otherTx of other.linearization) {
      const newTx = primary.txs.get(otherTx.txid);
      if (newTx) {
        primary.linearization.push(newTx);
      }
    }
  }

  private processAccelerationChanges(newAccelerations: { [txid: string]: { feeDelta: number } }): void {
    const changed = new Set<string>();
    for (const txid of Object.keys(newAccelerations)) {
      if ((newAccelerations[txid]?.feeDelta || 0) !== (this.accelerations[txid]?.feeDelta || 0)) {
        changed.add(txid);
      }
    }
    for (const txid of Object.keys(this.accelerations)) {
      if (!newAccelerations[txid]) {
        changed.add(txid);
      }
    }
    this.accelerations = newAccelerations;
    for (const txid of changed) {
      const tx = this.mempool[txid];
      if (!tx) {
        continue;
      }
      const match = this.getClusterForTx(txid);
      if (match) {
        match.clusterTx.effectiveFee = this.effectiveFee(txid, tx);
        match.cluster.dirty = true;
      }
    }
  }

  private relinearizeDirtyClusters(): void {
    for (const [clusterId, cluster] of [...this.clusters]) {
      if (cluster.dirty) {
        cluster.dirty = false;
        const newId = this.nextClusterId++;
        this.clusters.delete(clusterId);
        cluster.id = newId;
        this.clusters.set(newId, cluster);
        for (const txid of cluster.txs.keys()) {
          this.txToCluster.set(txid, newId);
        }

        const { linearization, chunks } = linearizeCluster(
          cluster.depgraph.getTxs(),
          cluster.linearization,
        );
        cluster.linearization = linearization;
        cluster.chunks = chunks;

        this.writeBackCluster(cluster);
      }
    }
  }

  private buildClusterData(cluster: Cluster): CpfpClusterData {
    const txs: CpfpClusterTx[] = [];
    const txToFlatIdx = new Map<ClusterTx, number>();

    for (const chunk of cluster.chunks) {
      const ordered = sortTopological(new Set(chunk.txs));
      for (const clusterTx of ordered) {
        if (this.mempool[clusterTx.txid]) {
          txToFlatIdx.set(clusterTx, txs.length);
          const parents: number[] = [];
          for (const parentTx of clusterTx.parents) {
            const flatIdx = txToFlatIdx.get(parentTx);
            if (flatIdx !== undefined) {
              parents.push(flatIdx);
            }
          }
          const mempoolTx = this.mempool[clusterTx.txid];
          txs.push({ txid: clusterTx.txid, fee: mempoolTx.fee, weight: mempoolTx.weight, parents });
        } else {
          logger.warn(`ClusterMempool.buildClusterData: ${clusterTx.txid} missing from mempool (cluster ${cluster.id})`);
        }
      }
    }

    let offset = 0;
    const chunks = cluster.chunks.map(chunk => {
      const count = chunk.txs.length;
      const chunkEntry = {
        txs: Array.from({ length: count }, (_, i) => offset + i),
        feerate: chunk.weight > 0 ? (chunk.fee * 4) / chunk.weight : 0,
      };
      offset += count;
      return chunkEntry;
    });

    return { txs, chunks };
  }

  private findChunkInfo(cluster: Cluster, tx: ClusterTx): ClusterInfo | null {
    for (let chunkIdx = 0; chunkIdx < cluster.chunks.length; chunkIdx++) {
      const chunk = cluster.chunks[chunkIdx];
      if (chunk.txs.includes(tx)) {
        return {
          clusterId: cluster.id,
          chunkIndex: chunkIdx,
          chunkFeerate: chunk.weight > 0 ? (chunk.fee * 4) / chunk.weight : 0,
        };
      }
    }
    return null;
  }
}
