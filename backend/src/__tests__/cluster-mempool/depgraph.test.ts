import { DepGraph, sortTopological, subgraph } from '../../cluster-mempool/depgraph';
import { buildChain, buildFanOut, buildDiamond, buildStar } from './test-utils';

describe('DepGraph', () => {
  describe('addTransaction', () => {
    it('should add a transaction and return a ClusterTx', () => {
      const dg = new DepGraph();
      const tx = dg.addTransaction('tx0', 1000, 100);
      expect(dg.size).toBe(1);
      expect(tx.effectiveFee).toBe(1000);
      expect(tx.weight).toBe(100);
      expect(tx.txid).toBe('tx0');
    });

    it('should assign distinct ClusterTx objects', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(dg.size).toBe(3);
    });

    it('should include self in ancestors and descendants', () => {
      const dg = new DepGraph();
      const tx = dg.addTransaction('tx0', 100, 10);
      expect(tx.ancestors.has(tx)).toBe(true);
      expect(tx.descendants.has(tx)).toBe(true);
    });

    it('should handle large clusters', () => {
      const dg = new DepGraph();
      for (let i = 0; i < 100; i++) {
        dg.addTransaction(`tx${i}`, 100, 10);
      }
      expect(dg.size).toBe(100);
    });
  });

  describe('addDependency', () => {
    it('should establish parent-child relationship', () => {
      const dg = new DepGraph();
      const parent = dg.addTransaction('parent', 100, 10);
      const child = dg.addTransaction('child', 200, 20);
      dg.addDependency(parent, child);

      expect(child.ancestors.has(parent)).toBe(true);
      expect(parent.descendants.has(child)).toBe(true);
      expect(child.parents.has(parent)).toBe(true);
      expect(parent.children.has(child)).toBe(true);
    });

    it('should propagate ancestors transitively', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      dg.addDependency(a, b);
      dg.addDependency(b, c);

      expect(c.ancestors.has(a)).toBe(true);
      expect(c.ancestors.has(b)).toBe(true);
      expect(c.ancestors.has(c)).toBe(true);

      expect(a.descendants.has(a)).toBe(true);
      expect(a.descendants.has(b)).toBe(true);
      expect(a.descendants.has(c)).toBe(true);
    });

    it('should handle diamond dependencies', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      const d = dg.addTransaction('d', 400, 40);
      dg.addDependency(a, b);
      dg.addDependency(a, c);
      dg.addDependency(b, d);
      dg.addDependency(c, d);

      expect(d.ancestors.size).toBe(4);
      expect(a.descendants.size).toBe(4);
    });
  });

  describe('removeTransactions', () => {
    it('should remove transactions and update sets', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      dg.addDependency(a, b);
      dg.addDependency(b, c);

      dg.removeTransactions(new Set([b]));
      expect(dg.size).toBe(2);
      expect(dg.hasTx(b)).toBe(false);
      expect(c.ancestors.has(b)).toBe(false);
      expect(a.descendants.has(b)).toBe(false);
    });

    it('should handle slot reuse after removal', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      dg.addTransaction('b', 200, 20);
      dg.removeTransactions(new Set([a]));
      const c = dg.addTransaction('c', 300, 30);
      expect(dg.size).toBe(2);
      expect(c.txid).toBe('c');
    });
  });

  describe('dependsOn (via ancestors)', () => {
    it('should correctly identify dependencies', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      dg.addDependency(a, b);

      expect(b.ancestors.has(a)).toBe(true);
      expect(a.ancestors.has(b)).toBe(false);
      expect(c.ancestors.has(a)).toBe(false);
    });
  });

  describe('findConnectedComponents', () => {
    it('should find a single component', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      dg.addDependency(a, b);

      const components = dg.findConnectedComponents();
      expect(components.length).toBe(1);
      expect(components[0].size).toBe(2);
    });

    it('should find multiple disconnected components', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      const d = dg.addTransaction('d', 400, 40);
      dg.addDependency(a, b);
      dg.addDependency(c, d);

      const components = dg.findConnectedComponents();
      expect(components.length).toBe(2);
    });

    it('should handle isolated transactions', () => {
      const dg = new DepGraph();
      dg.addTransaction('a', 100, 10);
      dg.addTransaction('b', 200, 20);
      dg.addTransaction('c', 300, 30);

      const components = dg.findConnectedComponents();
      expect(components.length).toBe(3);
    });
  });

  describe('parents / children (direct)', () => {
    it('should return only direct parents, not transitive', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      dg.addDependency(a, b);
      dg.addDependency(b, c);

      expect(c.parents.has(b)).toBe(true);
      expect(c.parents.has(a)).toBe(false);
    });

    it('should return only direct children', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      dg.addDependency(a, b);
      dg.addDependency(b, c);

      expect(a.children.has(b)).toBe(true);
      expect(a.children.has(c)).toBe(false);
    });
  });

  describe('appendTopo', () => {
    it('should output in topological order', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      dg.addDependency(a, b);
      dg.addDependency(b, c);

      const output = sortTopological(new Set([c, a, b]));
      expect(output.indexOf(a)).toBeLessThan(output.indexOf(b));
      expect(output.indexOf(b)).toBeLessThan(output.indexOf(c));
    });
  });

  describe('restrict', () => {
    it('should create a subgraph with correct deps', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      dg.addTransaction('c', 300, 30);
      dg.addDependency(a, b);

      const { depgraph: sub, txMap } = subgraph(new Set([a, b]));
      expect(sub.size).toBe(2);
      const newA = txMap.get(a)!;
      const newB = txMap.get(b)!;
      expect(newB.ancestors.has(newA)).toBe(true);
    });
  });

  describe('graceful error handling', () => {
    it('should no-op addDependency with non-member txs', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const dg2 = new DepGraph();
      const foreign = dg2.addTransaction('foreign', 200, 20);
      dg.addDependency(a, foreign);
      dg.addDependency(foreign, a);
      expect(a.ancestors.size).toBe(1);
    });
  });

  describe('deep chain topology', () => {
    it('should track ancestors and descendants at each depth', () => {
      const { depgraph, txs } = buildChain(20, 100, 10);
      expect(depgraph.size).toBe(20);

      expect(txs[19].ancestors.size).toBe(20);
      expect(txs[0].descendants.size).toBe(20);

      expect(txs[10].ancestors.size).toBe(11);
      expect(txs[10].descendants.size).toBe(10);

      expect(txs[10].parents.size).toBe(1);
      expect(txs[10].parents.has(txs[9])).toBe(true);
      expect(txs[10].children.size).toBe(1);
      expect(txs[10].children.has(txs[11])).toBe(true);
    });
  });

  describe('wide fan-out topology', () => {
    it('should track parent-children relationships for 1 parent with 10 children', () => {
      const { depgraph, parent, children } = buildFanOut(10, 100, 10, 50, 10);
      expect(depgraph.size).toBe(11);
      expect(parent.children.size).toBe(10);
      expect(parent.descendants.size).toBe(11);

      for (const child of children) {
        expect(child.ancestors.size).toBe(2);
        expect(child.ancestors.has(parent)).toBe(true);
        expect(child.parents.size).toBe(1);
        expect(child.parents.has(parent)).toBe(true);
      }
    });
  });

  describe('wide fan-in topology', () => {
    it('should track many parents converging to one child', () => {
      const dg = new DepGraph();
      const parents: any[] = [];
      for (let i = 0; i < 10; i++) {
        parents.push(dg.addTransaction(`p${i}`, 100, 10));
      }
      const child = dg.addTransaction('child', 500, 50);
      for (const p of parents) {
        dg.addDependency(p, child);
      }

      expect(child.parents.size).toBe(10);
      expect(child.ancestors.size).toBe(11);
      for (const p of parents) {
        expect(p.descendants.has(child)).toBe(true);
      }
    });
  });

  describe('multiple diamonds in sequence', () => {
    it('should handle A→B,C→D→E,F→G topology', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 100, 10);
      const c = dg.addTransaction('c', 100, 10);
      const d = dg.addTransaction('d', 100, 10);
      const e = dg.addTransaction('e', 100, 10);
      const f = dg.addTransaction('f', 100, 10);
      const g = dg.addTransaction('g', 100, 10);
      dg.addDependency(a, b);
      dg.addDependency(a, c);
      dg.addDependency(b, d);
      dg.addDependency(c, d);
      dg.addDependency(d, e);
      dg.addDependency(d, f);
      dg.addDependency(e, g);
      dg.addDependency(f, g);

      expect(g.ancestors.size).toBe(7);
      expect(a.descendants.size).toBe(7);
      expect(d.parents.size).toBe(2);
      expect(d.children.size).toBe(2);
    });
  });

  describe('disconnected subgraphs', () => {
    it('should coexist in one DepGraph', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      dg.addDependency(a, b);

      const c = dg.addTransaction('c', 300, 30);
      const d = dg.addTransaction('d', 400, 40);
      dg.addDependency(c, d);

      const e = dg.addTransaction('e', 500, 50);

      expect(dg.size).toBe(5);
      expect(b.ancestors.has(c)).toBe(false);
      expect(a.descendants.has(d)).toBe(false);
      expect(e.ancestors.size).toBe(1);
      expect(dg.findConnectedComponents().length).toBe(3);
    });
  });

  describe('removeTransactions edge cases', () => {
    it('should remove a leaf without affecting siblings', () => {
      const { depgraph, parent, children } = buildFanOut(3, 100, 10, 50, 10);
      depgraph.removeTransactions(new Set([children[2]]));
      expect(depgraph.size).toBe(3);
      expect(parent.children.size).toBe(2);
      expect(depgraph.hasTx(children[0])).toBe(true);
      expect(depgraph.hasTx(children[1])).toBe(true);
    });

    it('should remove a root without affecting unrelated txs', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      dg.addDependency(a, b);
      dg.removeTransactions(new Set([a]));
      expect(dg.size).toBe(1);
      expect(dg.hasTx(a)).toBe(false);
      expect(b.ancestors.size).toBe(1);
      expect(b.ancestors.has(b)).toBe(true);
    });

    it('should break transitive edges when middle of chain is removed', () => {
      const { depgraph, txs } = buildChain(5, 100, 10);
      depgraph.removeTransactions(new Set([txs[2]]));
      expect(depgraph.size).toBe(4);
      expect(txs[0].descendants.has(txs[3])).toBe(false);
      expect(txs[0].descendants.has(txs[1])).toBe(true);
      expect(txs[3].ancestors.has(txs[0])).toBe(false);
      expect(txs[3].descendants.has(txs[4])).toBe(true);
    });

    it('should handle batch removal of multiple txs', () => {
      const { depgraph, txs } = buildChain(5, 100, 10);
      depgraph.removeTransactions(new Set([txs[1], txs[3]]));
      expect(depgraph.size).toBe(3);
      expect(depgraph.hasTx(txs[0])).toBe(true);
      expect(depgraph.hasTx(txs[2])).toBe(true);
      expect(depgraph.hasTx(txs[4])).toBe(true);
    });

    it('should result in empty graph when all txs removed', () => {
      const { depgraph, txs } = buildChain(3, 100, 10);
      depgraph.removeTransactions(new Set(txs));
      expect(depgraph.size).toBe(0);
      expect(depgraph.getTxs().size).toBe(0);
    });

    it('should produce clean state when new tx is added after removal', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      dg.addDependency(a, b);
      dg.removeTransactions(new Set([a]));

      const c = dg.addTransaction('c', 300, 30);
      expect(c.ancestors.size).toBe(1);
      expect(c.descendants.size).toBe(1);
      expect(c.ancestors.has(c)).toBe(true);
      expect(b.ancestors.has(c)).toBe(false);
    });
  });

  describe('findConnectedComponents after removal', () => {
    it('should split into 2 components when bridge tx is removed', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);
      const d = dg.addTransaction('d', 400, 40);
      dg.addDependency(a, b);
      dg.addDependency(b, c);
      dg.addDependency(d, c);

      dg.removeTransactions(new Set([b]));
      const components = dg.findConnectedComponents();
      expect(components.length).toBe(2);
      const sizes = components.map(comp => comp.size).sort((x, y) => x - y);
      expect(sizes).toEqual([1, 2]);
    });

    it('should produce N singletons when center of star is removed', () => {
      const { depgraph, center, leaves } = buildStar(5, 100, 10, 50, 10);
      depgraph.removeTransactions(new Set([center]));
      const components = depgraph.findConnectedComponents();
      expect(components.length).toBe(5);
      for (const comp of components) {
        expect(comp.size).toBe(1);
      }
    });

    it('should remain 1 component when non-bridge tx is removed', () => {
      const { depgraph, txs } = buildDiamond([100, 200, 300, 400], [10, 20, 30, 40]);
      depgraph.removeTransactions(new Set([txs[1]]));
      const components = depgraph.findConnectedComponents();
      expect(components.length).toBe(1);
    });
  });

  describe('restrict edge cases', () => {
    it('should restrict to a single tx', () => {
      const { depgraph, txs } = buildChain(3, 100, 10);
      const { depgraph: sub } = subgraph(new Set([txs[1]]));
      expect(sub.size).toBe(1);
    });

    it('should preserve edges within partial chain subset', () => {
      const { depgraph, txs } = buildChain(5, 100, 10);
      const subset = new Set([txs[0], txs[1], txs[2]]);
      const { depgraph: sub, txMap } = subgraph(subset);
      expect(sub.size).toBe(3);

      const newA = txMap.get(txs[0]);
      const newB = txMap.get(txs[1]);
      const newC = txMap.get(txs[2]);
      if (!newA || !newB || !newC) {
        throw new Error('txMap missing entries');
      }
      expect(newB.ancestors.has(newA)).toBe(true);
      expect(newC.ancestors.has(newB)).toBe(true);
    });
  });

  describe('sortTopological edge cases', () => {
    it('should handle subset with no internal dependencies', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      const c = dg.addTransaction('c', 300, 30);

      const output = sortTopological(new Set([a, b, c]));
      expect(output.length).toBe(3);
      expect(new Set(output).size).toBe(3);
    });

    it('should handle single-tx subset', () => {
      const { txs } = buildChain(3, 100, 10);
      const output = sortTopological(new Set([txs[1]]));
      expect(output).toEqual([txs[1]]);
    });
  });

  describe('addDependency edge cases', () => {
    it('should be idempotent when adding the same dependency twice', () => {
      const dg = new DepGraph();
      const a = dg.addTransaction('a', 100, 10);
      const b = dg.addTransaction('b', 200, 20);
      dg.addDependency(a, b);
      dg.addDependency(a, b);
      expect(b.ancestors.size).toBe(2);
      expect(a.descendants.size).toBe(2);
    });

    it('should handle redundant edge when parent is already transitive ancestor', () => {
      const { depgraph, txs } = buildChain(3, 100, 10);
      depgraph.addDependency(txs[0], txs[2]);
      expect(txs[2].ancestors.size).toBe(3);
      expect(txs[2].parents.size).toBe(2);
    });
  });
});
