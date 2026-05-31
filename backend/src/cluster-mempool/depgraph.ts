import logger from '../logger';

export class ClusterTx {
  txid: string;
  effectiveFee: number;
  weight: number;
  order: number;
  parents: Set<ClusterTx>;
  children: Set<ClusterTx>;

  constructor(txid: string, effectiveFee: number, weight: number, order: number) {
    this.txid = txid;
    this.effectiveFee = effectiveFee;
    this.weight = weight;
    this.order = order;
    this.parents = new Set();
    this.children = new Set();
  }

  // Transitive ancestor/descendant sets (including self), derived on demand from the
  // stored direct `parents`/`children` edges.
  //
  // These used to be eagerly materialized and maintained on every addDependency(), which
  // cost O(K^2) memory per connected component of size K and OOM'd the backend on the
  // production mempool (millions of txs, large CPFP clusters during congestion). They are
  // now computed lazily so the graph only stores direct edges.
  //
  // WARNING: each access is an O(cluster size) traversal. Do NOT call these from hot paths
  // that run over the whole mempool. Internal consumers (linearization, chunk relatives,
  // topological sort, connected-component discovery) all walk `parents`/`children` directly
  // and never trigger these getters.
  get ancestors(): Set<ClusterTx> {
    return this.closure(true);
  }

  get descendants(): Set<ClusterTx> {
    return this.closure(false);
  }

  private closure(upwards: boolean): Set<ClusterTx> {
    const result = new Set<ClusterTx>([this]);
    const stack: ClusterTx[] = [this];
    while (stack.length > 0) {
      const node = stack.pop();
      if (node === undefined) {
        break;
      }
      const next = upwards ? node.parents : node.children;
      for (const relative of next) {
        if (!result.has(relative)) {
          result.add(relative);
          stack.push(relative);
        }
      }
    }
    return result;
  }
}

export class DepGraph {
  private txs: Set<ClusterTx> = new Set();

  get size(): number {
    return this.txs.size;
  }

  addTransaction(txid: string, fee: number, weight: number, order: number = 0): ClusterTx {
    const tx = new ClusterTx(txid, fee, weight, order);
    this.txs.add(tx);
    return tx;
  }

  addDependency(parent: ClusterTx, child: ClusterTx): void {
    if (!this.txs.has(parent) || !this.txs.has(child)) {
      logger.warn(`Warning: invalid dependency, skipping`);
      return;
    }

    // Only the direct edge is stored; transitive ancestry is derived on demand.
    parent.children.add(child);
    child.parents.add(parent);
  }

  removeTransactions(toRemove: Set<ClusterTx>): void {
    for (const tx of toRemove) {
      for (const parent of tx.parents) {
        parent.children.delete(tx);
      }
      for (const child of tx.children) {
        child.parents.delete(tx);
      }
      this.txs.delete(tx);
    }
  }

  hasTx(tx: ClusterTx): boolean {
    return this.txs.has(tx);
  }

  getTxs(): Set<ClusterTx> {
    return this.txs;
  }

  findConnectedComponents(): Set<ClusterTx>[] {
    const visited = new Set<ClusterTx>();
    const components: Set<ClusterTx>[] = [];

    for (const tx of this.txs) {
      if (!visited.has(tx)) {
        const component = new Set<ClusterTx>();
        const stack: ClusterTx[] = [tx];
        while (stack.length > 0) {
          const node = stack.pop();
          if (node && !visited.has(node)) {
            visited.add(node);
            component.add(node);
            for (const p of node.parents) {
              if (!visited.has(p) && this.txs.has(p)) {
                stack.push(p);
              }
            }
            for (const c of node.children) {
              if (!visited.has(c) && this.txs.has(c)) {
                stack.push(c);
              }
            }
          }
        }
        components.push(component);
      }
    }
    return components;
  }

}

// Topological order (parents before children) over a subset, computed via Kahn's algorithm
// on the direct edges restricted to the subset. Replaces the previous sort-by-ancestor-count
// implementation so it does not depend on the (now lazy) transitive ancestor sets.
export function sortTopological(subset: Set<ClusterTx>): ClusterTx[] {
  const result: ClusterTx[] = [];
  const emitted = new Set<ClusterTx>();
  const remainingParents = new Map<ClusterTx, number>();
  const queue: ClusterTx[] = [];

  for (const tx of subset) {
    let count = 0;
    for (const parent of tx.parents) {
      if (subset.has(parent)) {
        count++;
      }
    }
    remainingParents.set(tx, count);
    if (count === 0) {
      queue.push(tx);
    }
  }

  while (queue.length > 0) {
    const tx = queue.shift();
    if (tx === undefined) {
      break;
    }
    result.push(tx);
    emitted.add(tx);
    for (const child of tx.children) {
      if (subset.has(child)) {
        const remaining = (remainingParents.get(child) ?? 0) - 1;
        remainingParents.set(child, remaining);
        if (remaining === 0) {
          queue.push(child);
        }
      }
    }
  }

  // Safety net: if any members were not emitted (e.g. an unexpected cycle), preserve them
  // so callers never silently drop transactions.
  if (result.length < subset.size) {
    for (const tx of subset) {
      if (!emitted.has(tx)) {
        result.push(tx);
      }
    }
  }

  return result;
}

export function subgraph(txSubset: Set<ClusterTx>): { depgraph: DepGraph; txMap: Map<ClusterTx, ClusterTx> } {
  const newGraph = new DepGraph();
  const txMap = new Map<ClusterTx, ClusterTx>();

  for (const oldTx of txSubset) {
    const newTx = newGraph.addTransaction(oldTx.txid, oldTx.effectiveFee, oldTx.weight, oldTx.order);
    txMap.set(oldTx, newTx);
  }

  for (const oldTx of txSubset) {
    for (const parent of oldTx.parents) {
      if (txSubset.has(parent)) {
        const newChild = txMap.get(oldTx);
        const newParent = txMap.get(parent);
        if (newChild && newParent) {
          newGraph.addDependency(newParent, newChild);
        }
      }
    }
  }

  return { depgraph: newGraph, txMap };
}
