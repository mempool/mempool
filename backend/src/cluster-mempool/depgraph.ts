import logger from '../logger';

export class ClusterTx {
  txid: string;
  effectiveFee: number;
  weight: number;
  order: number;
  ancestors: Set<ClusterTx>;
  descendants: Set<ClusterTx>;
  parents: Set<ClusterTx>;
  children: Set<ClusterTx>;

  constructor(txid: string, effectiveFee: number, weight: number, order: number) {
    this.txid = txid;
    this.effectiveFee = effectiveFee;
    this.weight = weight;
    this.order = order;
    this.ancestors = new Set([this]);
    this.descendants = new Set([this]);
    this.parents = new Set();
    this.children = new Set();
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

    parent.children.add(child);
    child.parents.add(parent);

    if (child.ancestors.has(parent)) {
      return;
    }

    for (const descendant of child.descendants) {
      for (const ancestor of parent.ancestors) {
        descendant.ancestors.add(ancestor);
        ancestor.descendants.add(descendant);
      }
    }
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

    for (const tx of this.txs) {
      for (const removed of toRemove) {
        tx.ancestors.delete(removed);
        tx.descendants.delete(removed);
      }
    }

    this.rederiveAncestorsDescendants();
  }

  private rederiveAncestorsDescendants(): void {
    const ordered = [...this.txs].sort((a, b) => a.ancestors.size - b.ancestors.size);
    for (const tx of this.txs) {
      tx.ancestors = new Set([tx]);
      tx.descendants = new Set([tx]);
    }
    for (const tx of ordered) {
      for (const parent of tx.parents) {
        for (const ancestor of parent.ancestors) {
          tx.ancestors.add(ancestor);
        }
      }
      for (const ancestor of tx.ancestors) {
        ancestor.descendants.add(tx);
      }
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
            for (const a of node.ancestors) {
              if (!visited.has(a) && this.txs.has(a)) {
                stack.push(a);
              }
            }
            for (const d of node.descendants) {
              if (!visited.has(d) && this.txs.has(d)) {
                stack.push(d);
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

export function sortTopological(subset: Set<ClusterTx>): ClusterTx[] {
  return [...subset].sort((a, b) => a.ancestors.size - b.ancestors.size);
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
