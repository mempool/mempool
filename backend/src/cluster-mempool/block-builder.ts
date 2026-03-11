import { PairingHeap } from '../utils/pairing-heap';
import { LinearizationChunk } from './linearize';
import { MempoolTransactionExtended } from '../mempool.interfaces';
import { Cluster } from './cluster-mempool';

export interface ProjectedBlock {
  txids: string[];
  weight: number;
  sigops: number;
}

interface ChunkHeapEntry {
  fee: number;
  weight: number;
  sigops: number;
  equalFeeratePrefixWeight: number;
  maxOrder: number;
  clusterId: number;
  chunkIndex: number;
}

const BLOCK_WEIGHT_UNITS = 4_000_000;
const MAX_BLOCK_SIGOPS_COST = 80_000;
const COINBASE_RESERVED_WEIGHT = 8000;
const MAX_CONSECUTIVE_FAILURES = 1000;
const MAX_WASTED_WEIGHT = 4000;

function chunkHeapHigherPriority(a: ChunkHeapEntry, b: ChunkHeapEntry): boolean {
  const feerateDiff = a.fee * b.weight - b.fee * a.weight;
  if (feerateDiff !== 0) {
    return feerateDiff > 0;
  }
  if (a.equalFeeratePrefixWeight !== b.equalFeeratePrefixWeight) {
    return a.equalFeeratePrefixWeight < b.equalFeeratePrefixWeight;
  }
  return a.maxOrder < b.maxOrder;
}

function equalFeerate(a: LinearizationChunk, b: LinearizationChunk): boolean {
  return a.fee * b.weight === b.fee * a.weight;
}

function makeChunkHeapEntry(cluster: Cluster, chunkIndex: number, mempool: { [txid: string]: MempoolTransactionExtended }): ChunkHeapEntry {
  const chunk = cluster.chunks[chunkIndex];
  let maxOrder = 0;
  let sigops = 0;
  for (const tx of chunk.txs) {
    if (tx.order > maxOrder) {
      maxOrder = tx.order;
    }
    const mempoolTx = mempool[tx.txid];
    if (mempoolTx) {
      sigops += mempoolTx.sigops || 0;
    }
  }
  let prefixWeight = chunk.weight;
  for (let i = chunkIndex - 1; i >= 0; i--) {
    if (equalFeerate(cluster.chunks[i], chunk)) {
      prefixWeight += cluster.chunks[i].weight;
    } else {
      break;
    }
  }
  return {
    fee: chunk.fee,
    weight: chunk.weight,
    sigops,
    equalFeeratePrefixWeight: prefixWeight,
    maxOrder,
    clusterId: cluster.id,
    chunkIndex,
  };
}

function buildChunkHeap(clusters: Map<number, Cluster>, mempool: { [txid: string]: MempoolTransactionExtended }): PairingHeap<ChunkHeapEntry> {
  const heap = new PairingHeap<ChunkHeapEntry>(chunkHeapHigherPriority);
  for (const cluster of clusters.values()) {
    if (cluster.chunks.length > 0) {
      heap.add(makeChunkHeapEntry(cluster, 0, mempool));
    }
  }
  return heap;
}

export function assembleBlocks(
  n: number,
  clusters: Map<number, Cluster>,
  mempool: { [txid: string]: MempoolTransactionExtended },
  enforceLimit: boolean,
): ProjectedBlock[] {
  const heap = buildChunkHeap(clusters, mempool);
  const blocks: ProjectedBlock[] = [];
  for (let blockIdx = 0; blockIdx < n; blockIdx++) {
    const limited = enforceLimit || blockIdx < n - 1;
    const maxWeight = limited ? BLOCK_WEIGHT_UNITS : Infinity;
    const maxSigops = limited ? MAX_BLOCK_SIGOPS_COST : Infinity;
    const block = fillBlock(heap, clusters, mempool, maxWeight, maxSigops);
    if (block.txids.length === 0) {
      break;
    }
    blocks.push(block);
  }
  return blocks;
}

function fillBlock(
  heap: PairingHeap<ChunkHeapEntry>,
  clusters: Map<number, Cluster>,
  mempool: { [txid: string]: MempoolTransactionExtended },
  maxWeight: number,
  maxSigops: number,
): ProjectedBlock {
  const block: ProjectedBlock = { txids: [], weight: COINBASE_RESERVED_WEIGHT, sigops: 0 };
  const deferred: ChunkHeapEntry[] = [];
  let consecutiveFailed = 0;
  let full = false;

  while (!heap.isEmpty() && !full) {
    const entry = heap.pop() as ChunkHeapEntry;
    const cluster = clusters.get(entry.clusterId);
    const chunk = cluster?.chunks[entry.chunkIndex];

    if (!cluster || !chunk) {
      // stale entry
    } else if (block.weight + entry.weight < maxWeight
      && block.sigops + entry.sigops < maxSigops) {
      consecutiveFailed = 0;
      block.weight += chunkWeight(chunk, mempool);
      block.sigops += entry.sigops;
      for (const tx of chunk.txs) {
        block.txids.push(tx.txid);
      }
      if (entry.chunkIndex + 1 < cluster.chunks.length) {
        heap.add(makeChunkHeapEntry(cluster, entry.chunkIndex + 1, mempool));
      }
    } else {
      deferred.push(entry);
      consecutiveFailed++;
      if (consecutiveFailed > MAX_CONSECUTIVE_FAILURES
        && block.weight + MAX_WASTED_WEIGHT > maxWeight) {
        full = true;
      }
    }
  }

  for (const entry of deferred) {
    heap.add(entry);
  }

  return block;
}

function chunkWeight(
  chunk: LinearizationChunk,
  mempool: { [txid: string]: MempoolTransactionExtended },
): number {
  let weight = 0;
  for (const clusterTx of chunk.txs) {
    const mempoolTx = mempool[clusterTx.txid];
    if (mempoolTx) {
      weight += mempoolTx.weight;
    }
  }
  return weight;
}
