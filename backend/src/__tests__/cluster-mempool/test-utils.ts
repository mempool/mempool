import { MempoolTransactionExtended } from '../../mempool.interfaces';
import { ClusterTx, DepGraph } from '../../cluster-mempool/depgraph';
import { LinearizationChunk } from '../../cluster-mempool/linearize';

export function makeTx(
  txid: string,
  fee: number,
  vsize: number,
  parentTxids: string[] = [],
): MempoolTransactionExtended {
  const vin = parentTxids.length > 0
    ? parentTxids.map(ptxid => ({
        txid: ptxid,
        vout: 0,
        is_coinbase: false,
        scriptsig: '',
        scriptsig_asm: '',
        inner_redeemscript_asm: '',
        inner_witnessscript_asm: '',
        sequence: 0,
        witness: [] as string[],
        prevout: null,
      }))
    : [{
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        is_coinbase: false,
        scriptsig: '',
        scriptsig_asm: '',
        inner_redeemscript_asm: '',
        inner_witnessscript_asm: '',
        sequence: 0,
        witness: [] as string[],
        prevout: null,
      }];

  return {
    txid,
    version: 2,
    locktime: 0,
    size: vsize,
    weight: vsize * 4,
    fee,
    vin,
    vout: [{
      scriptpubkey: '',
      scriptpubkey_asm: '',
      scriptpubkey_type: 'v0_p2wpkh',
      value: 50000,
    }],
    status: { confirmed: false },
    vsize,
    feePerVsize: fee / vsize,
    effectiveFeePerVsize: fee / vsize,
    order: 0,
    sigops: 0,
    adjustedVsize: vsize,
    adjustedFeePerVsize: fee / vsize,
  } as MempoolTransactionExtended;
}

export function txid(short: string): string {
  return short.padStart(64, '0');
}

export function buildChain(
  n: number,
  baseFee: number,
  baseSize: number,
): { depgraph: DepGraph; txs: ClusterTx[] } {
  const depgraph = new DepGraph();
  const txs: ClusterTx[] = [];
  for (let i = 0; i < n; i++) {
    txs.push(depgraph.addTransaction(`chain_${i}`, baseFee, baseSize));
  }
  for (let i = 1; i < n; i++) {
    depgraph.addDependency(txs[i - 1], txs[i]);
  }
  return { depgraph, txs };
}

export function buildFanOut(
  nChildren: number,
  parentFee: number,
  parentSize: number,
  childFee: number,
  childSize: number,
): { depgraph: DepGraph; parent: ClusterTx; children: ClusterTx[] } {
  const depgraph = new DepGraph();
  const parent = depgraph.addTransaction('fanout_parent', parentFee, parentSize);
  const children: ClusterTx[] = [];
  for (let i = 0; i < nChildren; i++) {
    const child = depgraph.addTransaction(`fanout_child_${i}`, childFee, childSize);
    depgraph.addDependency(parent, child);
    children.push(child);
  }
  return { depgraph, parent, children };
}

export function buildDiamond(
  fees: [number, number, number, number],
  sizes: [number, number, number, number],
): { depgraph: DepGraph; txs: [ClusterTx, ClusterTx, ClusterTx, ClusterTx] } {
  const depgraph = new DepGraph();
  const a = depgraph.addTransaction('diamond_a', fees[0], sizes[0]);
  const b = depgraph.addTransaction('diamond_b', fees[1], sizes[1]);
  const c = depgraph.addTransaction('diamond_c', fees[2], sizes[2]);
  const d = depgraph.addTransaction('diamond_d', fees[3], sizes[3]);
  depgraph.addDependency(a, b);
  depgraph.addDependency(a, c);
  depgraph.addDependency(b, d);
  depgraph.addDependency(c, d);
  return { depgraph, txs: [a, b, c, d] };
}

export function buildStar(
  nLeaves: number,
  centerFee: number,
  centerSize: number,
  leafFee: number,
  leafSize: number,
): { depgraph: DepGraph; center: ClusterTx; leaves: ClusterTx[] } {
  const depgraph = new DepGraph();
  const center = depgraph.addTransaction('star_center', centerFee, centerSize);
  const leaves: ClusterTx[] = [];
  for (let i = 0; i < nLeaves; i++) {
    const leaf = depgraph.addTransaction(`star_leaf_${i}`, leafFee, leafSize);
    depgraph.addDependency(center, leaf);
    leaves.push(leaf);
  }
  return { depgraph, center, leaves };
}

export function verifyTopologicalOrder(ordering: ClusterTx[]): void {
  const positionMap = new Map<ClusterTx, number>();
  for (let i = 0; i < ordering.length; i++) {
    positionMap.set(ordering[i], i);
  }
  for (const tx of ordering) {
    for (const parent of tx.parents) {
      const parentPos = positionMap.get(parent);
      const childPos = positionMap.get(tx);
      if (parentPos !== undefined && childPos !== undefined) {
        expect(parentPos).toBeLessThan(childPos);
      }
    }
  }
}

export function verifyLinearization(
  txs: Set<ClusterTx>,
  linearization: ClusterTx[],
  chunks: LinearizationChunk[],
): void {
  expect(linearization.length).toBe(txs.size);
  const linSet = new Set(linearization);
  expect(linSet.size).toBe(linearization.length);
  for (const tx of txs) {
    expect(linSet.has(tx)).toBe(true);
  }

  verifyTopologicalOrder(linearization);

  for (let i = 1; i < chunks.length; i++) {
    const prevRate = chunks[i - 1].fee * chunks[i].weight;
    const curRate = chunks[i].fee * chunks[i - 1].weight;
    expect(prevRate).toBeGreaterThanOrEqual(curRate);
  }

  const chunkTxs = chunks.flatMap(c => c.txs);
  expect(chunkTxs.length).toBe(linearization.length);
  for (let i = 0; i < chunkTxs.length; i++) {
    expect(chunkTxs[i]).toBe(linearization[i]);
  }
}
