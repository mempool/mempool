import { DepGraph } from '../../cluster-mempool/depgraph';
import { chunkify, postLinearize, spanningForestLinearize, linearizeCluster } from '../../cluster-mempool/linearize';
import { buildChain, buildFanOut, buildStar, verifyLinearization, verifyTopologicalOrder } from './test-utils';

describe('chunkify', () => {
  it('should create one chunk per tx when feerates are decreasing', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 300, 10);
    const b = dg.addTransaction('b', 200, 10);
    const c = dg.addTransaction('c', 100, 10);

    const chunks = chunkify([a, b, c]);
    expect(chunks.length).toBe(3);
    expect(chunks[0].txs).toEqual([a]);
    expect(chunks[1].txs).toEqual([b]);
    expect(chunks[2].txs).toEqual([c]);
  });

  it('should merge all into one chunk when feerates are increasing', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 10);
    const b = dg.addTransaction('b', 200, 10);
    const c = dg.addTransaction('c', 300, 10);

    const chunks = chunkify([a, b, c]);
    expect(chunks.length).toBe(1);
    expect(chunks[0].txs).toEqual([a, b, c]);
    expect(chunks[0].fee).toBe(600);
    expect(chunks[0].weight).toBe(30);
  });

  it('should NOT merge equal feerates (matching Core behavior)', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 10);
    const b = dg.addTransaction('b', 100, 10);

    const chunks = chunkify([a, b]);
    expect(chunks.length).toBe(2);
  });

  it('should handle single transaction', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 500, 50);

    const chunks = chunkify([a]);
    expect(chunks.length).toBe(1);
    expect(chunks[0].fee).toBe(500);
    expect(chunks[0].weight).toBe(50);
  });

  it('should handle empty linearization', () => {
    const chunks = chunkify([]);
    expect(chunks.length).toBe(0);
  });

  it('should produce decreasing chunk feerates', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 10);
    const b = dg.addTransaction('b', 50, 10);
    const c = dg.addTransaction('c', 200, 10);
    const d = dg.addTransaction('d', 30, 10);

    const chunks = chunkify([a, c, b, d]);
    for (let i = 1; i < chunks.length; i++) {
      const prevRate = chunks[i - 1].fee / chunks[i - 1].weight;
      const curRate = chunks[i].fee / chunks[i].weight;
      expect(prevRate).toBeGreaterThanOrEqual(curRate);
    }
  });
});

describe('postLinearize', () => {
  it('should improve a bad linearization', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 100);
    const b = dg.addTransaction('b', 500, 100);

    const result = postLinearize([a, b]);
    expect(result[0]).toBe(b);
    expect(result[1]).toBe(a);
  });

  it('should not violate dependencies', () => {
    const dg = new DepGraph();
    const parent = dg.addTransaction('parent', 100, 100);
    const child = dg.addTransaction('child', 500, 100);
    dg.addDependency(parent, child);

    const result = postLinearize([parent, child]);
    expect(result.indexOf(parent)).toBeLessThan(result.indexOf(child));
  });

  it('should handle already-optimal ordering', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 500, 100);
    const b = dg.addTransaction('b', 100, 100);

    const result = postLinearize([a, b]);
    expect(result).toEqual([a, b]);
  });
});

describe('spanningForestLinearize', () => {
  it('should sort independent transactions by feerate', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 100);
    const b = dg.addTransaction('b', 500, 100);
    const c = dg.addTransaction('c', 300, 100);

    const result = spanningForestLinearize(dg.getTxs(), 75000);
    expect(result[0]).toBe(b);
    expect(result[1]).toBe(c);
    expect(result[2]).toBe(a);
  });

  it('should respect dependencies', () => {
    const dg = new DepGraph();
    const parent = dg.addTransaction('parent', 100, 100);
    const child = dg.addTransaction('child', 500, 100);
    dg.addDependency(parent, child);

    const result = spanningForestLinearize(dg.getTxs(), 75000);
    expect(result.indexOf(parent)).toBeLessThan(result.indexOf(child));
  });

  it('should handle CPFP pattern', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 100);
    const b = dg.addTransaction('b', 10000, 100);
    dg.addDependency(a, b);

    const { chunks } = linearizeCluster(dg.getTxs(), 75000);
    expect(chunks.length).toBe(1);
    expect(chunks[0].txs.length).toBe(2);
  });

  it('should separate high and low feerate independent txs', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 1000, 100);
    const b = dg.addTransaction('b', 100, 100);

    const { chunks } = linearizeCluster(dg.getTxs(), 75000);
    expect(chunks.length).toBe(2);
    expect(chunks[0].txs).toContain(a);
    expect(chunks[1].txs).toContain(b);
  });

  it('should handle single transaction', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 1000, 100);

    const result = spanningForestLinearize(dg.getTxs(), 75000);
    expect(result).toEqual([a]);
  });

  it('should handle empty graph', () => {
    const dg = new DepGraph();
    const result = spanningForestLinearize(dg.getTxs(), 75000);
    expect(result).toEqual([]);
  });
});

describe('minimize', () => {
  it('should keep equal-feerate chain as individual chunks', () => {
    const dg = new DepGraph();
    const txs: any[] = [];
    for (let i = 0; i < 5; i++) {
      txs.push(dg.addTransaction(`tx${i}`, 19, 140));
    }
    for (let i = 1; i < 5; i++) {
      dg.addDependency(txs[i - 1], txs[i]);
    }

    const { chunks } = linearizeCluster(dg.getTxs(), 75000);
    expect(chunks.length).toBe(5);
    for (const chunk of chunks) {
      expect(chunk.txs.length).toBe(1);
    }
  });

  it('should merge chain where child has strictly higher feerate', () => {
    const dg = new DepGraph();
    const parent = dg.addTransaction('parent', 100, 200);
    const child = dg.addTransaction('child', 900, 100);
    dg.addDependency(parent, child);

    const { chunks } = linearizeCluster(dg.getTxs(), 75000);
    expect(chunks.length).toBe(1);
    expect(chunks[0].txs.length).toBe(2);
  });

  it('should split parent-child with equal feerate', () => {
    const dg = new DepGraph();
    const parent = dg.addTransaction('parent', 1720, 344);
    const child = dg.addTransaction('child', 1240, 248);
    dg.addDependency(parent, child);

    const { chunks } = linearizeCluster(dg.getTxs(), 75000);
    expect(chunks.length).toBe(2);
  });

  it('should split disconnected equal-feerate components', () => {
    const dg = new DepGraph();
    dg.addTransaction('a', 100, 100);
    dg.addTransaction('b', 100, 100);

    const { chunks } = linearizeCluster(dg.getTxs(), 75000);
    expect(chunks.length).toBe(2);
    expect(chunks[0].txs.length).toBe(1);
    expect(chunks[1].txs.length).toBe(1);
  });
});

describe('chunkify edge cases', () => {
  it('should produce N separate chunks when all feerates are equal', () => {
    const dg = new DepGraph();
    const txs: any[] = [];
    for (let i = 0; i < 5; i++) {
      txs.push(dg.addTransaction(`tx${i}`, 100, 10));
    }
    const chunks = chunkify(txs);
    expect(chunks.length).toBe(5);
  });

  it('should handle alternating high/low feerates', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 1000, 10);
    const b = dg.addTransaction('b', 100, 10);
    const c = dg.addTransaction('c', 1000, 10);
    const d = dg.addTransaction('d', 100, 10);

    const chunks = chunkify([a, b, c, d]);
    for (let i = 1; i < chunks.length; i++) {
      const prevRate = chunks[i - 1].fee * chunks[i].weight;
      const curRate = chunks[i].fee * chunks[i - 1].weight;
      expect(prevRate).toBeGreaterThanOrEqual(curRate);
    }
  });

  it('should merge all when single very high feerate tx is at the end', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 10, 10);
    const b = dg.addTransaction('b', 10, 10);
    const c = dg.addTransaction('c', 10, 10);
    const d = dg.addTransaction('d', 10000, 10);

    const chunks = chunkify([a, b, c, d]);
    expect(chunks.length).toBe(1);
    expect(chunks[0].txs.length).toBe(4);
  });

  it('should maintain non-increasing feerates for 50+ tx linearization', () => {
    const dg = new DepGraph();
    const txs: any[] = [];
    for (let i = 0; i < 50; i++) {
      txs.push(dg.addTransaction(`tx${i}`, 5000 - i * 100, 100));
    }
    const chunks = chunkify(txs);
    for (let i = 1; i < chunks.length; i++) {
      const prevRate = chunks[i - 1].fee * chunks[i].weight;
      const curRate = chunks[i].fee * chunks[i - 1].weight;
      expect(prevRate).toBeGreaterThanOrEqual(curRate);
    }
  });

  it('should handle zero-fee transaction', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 1000, 100);
    const b = dg.addTransaction('b', 0, 100);

    const chunks = chunkify([a, b]);
    expect(chunks.length).toBe(2);
    expect(chunks[1].fee).toBe(0);
  });
});

describe('postLinearize edge cases', () => {
  it('should sort three independent txs by feerate', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 100);
    const b = dg.addTransaction('b', 500, 100);
    const c = dg.addTransaction('c', 300, 100);

    const result = postLinearize([a, c, b]);
    expect(result[0]).toBe(b);
    expect(result[2]).toBe(a);
  });

  it('should respect parent-child dependency even when child has higher feerate', () => {
    const dg = new DepGraph();
    const parent = dg.addTransaction('parent', 100, 100);
    const child = dg.addTransaction('child', 1000, 100);
    dg.addDependency(parent, child);

    const result = postLinearize([parent, child]);
    expect(result[0]).toBe(parent);
    expect(result[1]).toBe(child);
  });

  it('should handle chain A→B→C with CPFP-like feerates', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 100);
    const b = dg.addTransaction('b', 200, 100);
    const c = dg.addTransaction('c', 10000, 100);
    dg.addDependency(a, b);
    dg.addDependency(b, c);

    const result = postLinearize([a, b, c]);
    verifyTopologicalOrder(result);
  });
});

describe('SFL adversarial topologies', () => {
  it('should handle comb pattern: one root with many children at different feerates', () => {
    const dg = new DepGraph();
    const root = dg.addTransaction('root', 100, 100);
    for (let i = 0; i < 8; i++) {
      const child = dg.addTransaction(`child${i}`, (i + 1) * 500, 100);
      dg.addDependency(root, child);
    }

    const { linearization, chunks } = linearizeCluster(dg.getTxs(), 75000);
    verifyLinearization(dg.getTxs(), linearization, chunks);
  });

  it('should handle inverted tree: many leaves → intermediates → root', () => {
    const dg = new DepGraph();
    const root = dg.addTransaction('root', 100, 100);
    const mid1 = dg.addTransaction('mid1', 200, 100);
    const mid2 = dg.addTransaction('mid2', 300, 100);
    dg.addDependency(root, mid1);
    dg.addDependency(root, mid2);

    for (let i = 0; i < 4; i++) {
      const leaf = dg.addTransaction(`leaf${i}`, 5000, 100);
      dg.addDependency(i < 2 ? mid1 : mid2, leaf);
    }

    const { linearization, chunks } = linearizeCluster(dg.getTxs(), 75000);
    verifyLinearization(dg.getTxs(), linearization, chunks);
  });

  it('should handle two parallel chains with shared root', () => {
    const dg = new DepGraph();
    const root = dg.addTransaction('root', 100, 100);

    let prev1: any = root;
    for (let i = 0; i < 5; i++) {
      const tx = dg.addTransaction(`chain1_${i}`, 200, 100);
      dg.addDependency(prev1, tx);
      prev1 = tx;
    }

    let prev2: any = root;
    for (let i = 0; i < 3; i++) {
      const tx = dg.addTransaction(`chain2_${i}`, 300, 100);
      dg.addDependency(prev2, tx);
      prev2 = tx;
    }

    const { linearization, chunks } = linearizeCluster(dg.getTxs(), 75000);
    verifyLinearization(dg.getTxs(), linearization, chunks);
  });

  it('should handle deep CPFP: low-fee chain with high-fee tip', () => {
    const { depgraph, txs } = buildChain(6, 10, 100);
    txs[5].effectiveFee = 50000;

    const { linearization, chunks } = linearizeCluster(depgraph.getTxs(), 75000);
    verifyLinearization(depgraph.getTxs(), linearization, chunks);
    expect(chunks[0].txs.length).toBeGreaterThan(1);
  });

  it('should find better result than ancestor-feerate for overlapping high-feerate subsets', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 100);
    const b = dg.addTransaction('b', 100, 100);
    const c = dg.addTransaction('c', 10000, 100);
    dg.addDependency(a, c);
    dg.addDependency(b, c);

    const { linearization, chunks } = linearizeCluster(dg.getTxs(), 75000 );
    verifyLinearization(dg.getTxs(), linearization, chunks);
    const firstChunkFee = chunks[0].fee;
    const firstChunkSize = chunks[0].weight;
    expect(firstChunkFee / firstChunkSize).toBeGreaterThan(100 / 100);
  });
});

describe('linearizeCluster', () => {
  it('should produce valid topological linearization', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 10);
    const b = dg.addTransaction('b', 200, 20);
    const c = dg.addTransaction('c', 300, 30);
    dg.addDependency(a, b);
    dg.addDependency(b, c);

    const { linearization } = linearizeCluster(dg.getTxs(), 75000);
    expect(linearization.indexOf(a)).toBeLessThan(linearization.indexOf(b));
    expect(linearization.indexOf(b)).toBeLessThan(linearization.indexOf(c));
  });

  it('should produce monotonically decreasing chunk feerates', () => {
    const dg = new DepGraph();
    for (let i = 0; i < 10; i++) {
      dg.addTransaction(`tx${i}`, Math.floor(Math.random() * 10000) + 100, Math.floor(Math.random() * 500) + 50);
    }

    const { chunks } = linearizeCluster(dg.getTxs(), 75000);
    for (let i = 1; i < chunks.length; i++) {
      const prevRate = chunks[i - 1].fee * chunks[i].weight;
      const curRate = chunks[i].fee * chunks[i - 1].weight;
      expect(prevRate).toBeGreaterThanOrEqual(curRate);
    }
  });

  it('should handle complex diamond dependency graph', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 1000, 100);
    const b = dg.addTransaction('b', 500, 100);
    const c = dg.addTransaction('c', 100, 100);
    const d = dg.addTransaction('d', 300, 100);

    dg.addDependency(a, b);
    dg.addDependency(a, c);
    dg.addDependency(b, d);
    dg.addDependency(c, d);

    const { linearization, chunks } = linearizeCluster(dg.getTxs(), 75000);
    verifyLinearization(dg.getTxs(), linearization, chunks);
  });

  it('should produce at-least-as-good result when given suboptimal hint', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 500, 100);
    const b = dg.addTransaction('b', 100, 100);
    const c = dg.addTransaction('c', 1000, 100);

    const suboptimal = [b, a, c];
    const { chunks: hintChunks } = linearizeCluster(dg.getTxs(), 75000, suboptimal);
    const { chunks: freshChunks } = linearizeCluster(dg.getTxs(), 75000);

    const hintFirstFeerate = hintChunks[0].fee * freshChunks[0].weight;
    const freshFirstFeerate = freshChunks[0].fee * hintChunks[0].weight;
    expect(hintFirstFeerate).toBeGreaterThanOrEqual(freshFirstFeerate - 1);
  });

  it('should preserve an already-optimal linearization', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 1000, 100);
    const b = dg.addTransaction('b', 500, 100);
    const c = dg.addTransaction('c', 100, 100);

    const optimal = [a, b, c];
    const { linearization } = linearizeCluster(dg.getTxs(), 75000, optimal);
    expect(linearization).toEqual(optimal);
  });

  it('should produce valid linearizations on repeated calls', () => {
    const dg = new DepGraph();
    const a = dg.addTransaction('a', 100, 100);
    const b = dg.addTransaction('b', 100, 100);
    const c = dg.addTransaction('c', 100, 100);
    dg.addDependency(a, c);
    dg.addDependency(b, c);

    const result1 = linearizeCluster(dg.getTxs(), 75000);
    const result2 = linearizeCluster(dg.getTxs(), 75000);
    verifyLinearization(dg.getTxs(), result1.linearization, result1.chunks);
    verifyLinearization(dg.getTxs(), result2.linearization, result2.chunks);
  });

  it('should pass invariant checks for fan-out topology', () => {
    const { depgraph } = buildFanOut(6, 100, 100, 500, 100);
    const { linearization, chunks } = linearizeCluster(depgraph.getTxs(), 75000);
    verifyLinearization(depgraph.getTxs(), linearization, chunks);
  });

  it('should pass invariant checks for star topology', () => {
    const { depgraph } = buildStar(5, 100, 100, 300, 100);
    const { linearization, chunks } = linearizeCluster(depgraph.getTxs(), 75000);
    verifyLinearization(depgraph.getTxs(), linearization, chunks);
  });
});
