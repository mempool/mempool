import { ClusterTx } from './depgraph';

function higherFeerate(aFee: number, aWeight: number, bFee: number, bWeight: number): boolean {
  return aFee * bWeight > bFee * aWeight;
}

export interface LinearizationChunk {
  txs: ClusterTx[];
  fee: number;
  weight: number;
}

export function chunkify(linearization: ClusterTx[]): LinearizationChunk[] {
  const chunks: LinearizationChunk[] = [];

  for (const tx of linearization) {
    chunks.push({ txs: [tx], fee: tx.effectiveFee, weight: tx.weight });

    while (chunks.length >= 2) {
      const last = chunks[chunks.length - 1];
      const prev = chunks[chunks.length - 2];
      if (higherFeerate(last.fee, last.weight, prev.fee, prev.weight)) {
        prev.txs.push(...last.txs);
        prev.fee += last.fee;
        prev.weight += last.weight;
        chunks.pop();
      } else {
        break;
      }
    }
  }

  return chunks;
}

export function postLinearize(linearization: ClusterTx[]): ClusterTx[] {
  if (linearization.length <= 1) {
    return [...linearization];
  }
  let result = [...linearization];
  result = postLinearizePass(result, true);
  result = postLinearizePass(result, false);
  return result;
}

interface PostLinGroup {
  txs: ClusterTx[];
  deps: Set<ClusterTx>;
  fee: number;
  weight: number;
}

function postLinearizePass(lin: ClusterTx[], forward: boolean): ClusterTx[] {
  const n = lin.length;
  if (n <= 1) {
    return [...lin];
  }

  const input = forward ? lin : [...lin].reverse();
  const feeMul = forward ? 1 : -1;

  const groups: PostLinGroup[] = [];
  const seen = new Set<ClusterTx>();

  for (const tx of input) {
    const deps = new Set<ClusterTx>();
    const related = forward ? tx.parents : tx.children;
    for (const r of related) {
      if (seen.has(r)) {
        deps.add(r);
      }
    }
    seen.add(tx);

    groups.push({
      txs: [tx],
      deps,
      fee: tx.effectiveFee * feeMul,
      weight: tx.weight,
    });

    let pos = groups.length - 1;
    while (pos > 0) {
      const cur = groups[pos];
      const prev = groups[pos - 1];
      if (groupsDepsOverlap(cur, prev)) {
        mergeGroupIntoCurrent(groups, pos);
        pos--;
      } else if (higherFeerate(cur.fee, cur.weight, prev.fee, prev.weight)) {
        swapAdjacentGroups(groups, pos);
        pos--;
      } else {
        break;
      }
    }
  }

  const result: ClusterTx[] = [];
  for (const g of groups) {
    for (const tx of g.txs) {
      result.push(tx);
    }
  }

  if (!forward) {
    result.reverse();
  }

  return result;
}

function groupsDepsOverlap(cur: PostLinGroup, prev: PostLinGroup): boolean {
  for (const tx of prev.txs) {
    if (cur.deps.has(tx)) {
      return true;
    }
  }
  return false;
}

function mergeGroupIntoCurrent(groups: PostLinGroup[], pos: number): void {
  const cur = groups[pos];
  const prev = groups[pos - 1];
  prev.txs.push(...cur.txs);
  for (const d of cur.deps) {
    prev.deps.add(d);
  }
  prev.fee += cur.fee;
  prev.weight += cur.weight;
  groups.splice(pos, 1);
}

function swapAdjacentGroups(groups: PostLinGroup[], pos: number): void {
  const tmp = groups[pos];
  groups[pos] = groups[pos - 1];
  groups[pos - 1] = tmp;
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

interface SFLChunk {
  id: number;
  txs: Set<ClusterTx>;
  fee: number;
  weight: number;
}

interface SFLDependency {
  parent: ClusterTx;
  child: ClusterTx;
  active: boolean;
}

const DEFAULT_COST_BUDGET = 10000;

export function spanningForestLinearize(
  txs: Set<ClusterTx>,
  existingLinearization?: ClusterTx[],
  costBudget: number = DEFAULT_COST_BUDGET,
): ClusterTx[] {
  const allTxs = [...txs];
  if (allTxs.length === 0) {
    return [];
  }
  if (allTxs.length === 1) {
    return [...allTxs];
  }

  const deps = collectDirectDeps(allTxs);

  if (deps.length === 0) {
    return sortByFeerateDesc(allTxs);
  }

  const { chunks, txToChunk, nextChunkId } = initSFLChunks(allTxs);

  const initOrder = existingLinearization && existingLinearization.length > 0
    ? existingLinearization.filter(tx => txs.has(tx))
    : [...allTxs];

  shuffleArray(initOrder);

  for (const tx of initOrder) {
    const chunkId = txToChunk.get(tx);
    if (chunkId !== undefined) {
      if (Math.random() < 0.5) {
        mergeUpwards(chunkId, deps, chunks, txToChunk);
        mergeDownwards(chunkId, deps, chunks, txToChunk);
      } else {
        mergeDownwards(chunkId, deps, chunks, txToChunk);
        mergeUpwards(chunkId, deps, chunks, txToChunk);
      }
    }
  }

  optimizeSFL(deps, chunks, txToChunk, nextChunkId, costBudget);

  return extractLinearization(chunks, txToChunk);
}

function collectDirectDeps(txs: ClusterTx[]): SFLDependency[] {
  const deps: SFLDependency[] = [];
  for (const tx of txs) {
    for (const parent of tx.parents) {
      deps.push({ parent, child: tx, active: false });
    }
  }
  return deps;
}

function sortByFeerateDesc(txs: ClusterTx[]): ClusterTx[] {
  return [...txs].sort((a, b) => {
    if (higherFeerate(a.effectiveFee, a.weight, b.effectiveFee, b.weight)) {
      return -1;
    }
    if (higherFeerate(b.effectiveFee, b.weight, a.effectiveFee, a.weight)) {
      return 1;
    }
    return a.order - b.order;
  });
}

function initSFLChunks(
  txs: ClusterTx[]
): { chunks: Map<number, SFLChunk>; txToChunk: Map<ClusterTx, number>; nextChunkId: number } {
  let nextChunkId = 0;
  const txToChunk = new Map<ClusterTx, number>();
  const chunks = new Map<number, SFLChunk>();

  for (const tx of txs) {
    const chunkId = nextChunkId++;
    chunks.set(chunkId, {
      id: chunkId,
      txs: new Set([tx]),
      fee: tx.effectiveFee,
      weight: tx.weight,
    });
    txToChunk.set(tx, chunkId);
  }

  return { chunks, txToChunk, nextChunkId };
}

function mergeChunks(
  dstId: number,
  srcId: number,
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>
): void {
  const dst = chunks.get(dstId);
  const src = chunks.get(srcId);
  if (!dst || !src) {
    return;
  }
  for (const tx of src.txs) {
    dst.txs.add(tx);
    txToChunk.set(tx, dstId);
  }
  dst.fee += src.fee;
  dst.weight += src.weight;
  chunks.delete(srcId);
}

function activateInternalDeps(
  chunkId: number,
  deps: SFLDependency[],
  txToChunk: Map<ClusterTx, number>
): void {
  for (const d of deps) {
    if (!d.active) {
      const c1 = txToChunk.get(d.parent);
      const c2 = txToChunk.get(d.child);
      if (c1 === chunkId && c2 === chunkId) {
        d.active = true;
      }
    }
  }
}

function findMergeableParent(
  chunkId: number,
  chunk: SFLChunk,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>
): { dep: SFLDependency; parentChunkId: number } | null {
  for (const dep of deps) {
    if (!dep.active) {
      const childChunk = txToChunk.get(dep.child);
      const parentChunkId = txToChunk.get(dep.parent);
      if (childChunk === chunkId && parentChunkId !== chunkId && parentChunkId !== undefined) {
        const pChunk = chunks.get(parentChunkId);
        if (pChunk && !higherFeerate(pChunk.fee, pChunk.weight, chunk.fee, chunk.weight)) {
          return { dep, parentChunkId };
        }
      }
    }
  }
  return null;
}

function mergeUpwards(
  chunkId: number,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>
): void {
  let chunk = chunks.get(chunkId);
  let match = chunk ? findMergeableParent(chunkId, chunk, deps, chunks, txToChunk) : null;
  while (match) {
    match.dep.active = true;
    mergeChunks(chunkId, match.parentChunkId, chunks, txToChunk);
    activateInternalDeps(chunkId, deps, txToChunk);
    chunk = chunks.get(chunkId);
    match = chunk ? findMergeableParent(chunkId, chunk, deps, chunks, txToChunk) : null;
  }
}

function findMergeableChild(
  chunkId: number,
  chunk: SFLChunk,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>
): { dep: SFLDependency; childChunkId: number } | null {
  for (const dep of deps) {
    if (!dep.active) {
      const parentChunk = txToChunk.get(dep.parent);
      const childChunkId = txToChunk.get(dep.child);
      if (parentChunk === chunkId && childChunkId !== chunkId && childChunkId !== undefined) {
        const cChunk = chunks.get(childChunkId);
        if (cChunk && !higherFeerate(chunk.fee, chunk.weight, cChunk.fee, cChunk.weight)) {
          return { dep, childChunkId };
        }
      }
    }
  }
  return null;
}

function mergeDownwards(
  chunkId: number,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>
): void {
  let chunk = chunks.get(chunkId);
  let match = chunk ? findMergeableChild(chunkId, chunk, deps, chunks, txToChunk) : null;
  while (match) {
    match.dep.active = true;
    mergeChunks(chunkId, match.childChunkId, chunks, txToChunk);
    activateInternalDeps(chunkId, deps, txToChunk);
    chunk = chunks.get(chunkId);
    match = chunk ? findMergeableChild(chunkId, chunk, deps, chunks, txToChunk) : null;
  }
}

function buildChunkAdjacency(
  deps: SFLDependency[],
  chunkTxs: Set<ClusterTx>,
  excludeDep?: SFLDependency
): Map<ClusterTx, Set<ClusterTx>> {
  const adj = new Map<ClusterTx, Set<ClusterTx>>();
  for (const tx of chunkTxs) {
    adj.set(tx, new Set());
  }
  for (const d of deps) {
    if (d !== excludeDep && d.active && chunkTxs.has(d.parent) && chunkTxs.has(d.child)) {
      const parentAdj = adj.get(d.parent);
      const childAdj = adj.get(d.child);
      if (parentAdj) {
        parentAdj.add(d.child);
      }
      if (childAdj) {
        childAdj.add(d.parent);
      }
    }
  }
  return adj;
}

function bfsReachable(adj: Map<ClusterTx, Set<ClusterTx>>, start: ClusterTx): Set<ClusterTx> {
  const visited = new Set<ClusterTx>();
  const queue: ClusterTx[] = [start];
  visited.add(start);
  while (queue.length > 0) {
    const node = queue.shift();
    if (node) {
      const neighbors = adj.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }
  return visited;
}

function optimizeSFL(
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  nextChunkId: number,
  costBudget: number,
): number {
  let budget = costBudget;

  while (budget > 0) {
    budget--;

    const best = findBestDepToSplit(deps, chunks, txToChunk);
    if (!best) {
      break;
    }

    best.dep.active = false;

    const parentChunkId = txToChunk.get(best.dep.parent);
    if (parentChunkId === undefined) {
      break;
    }
    const chunk = chunks.get(parentChunkId);
    if (!chunk) {
      break;
    }

    const adj = buildChunkAdjacency(deps, chunk.txs, best.dep);
    const parentSide = bfsReachable(adj, best.dep.parent);

    if (parentSide.has(best.dep.child)) {
      best.dep.active = true;
    } else if (hasTransitiveDependency(chunk.txs, parentSide)) {
      best.dep.active = true;
    } else {
      const childSide = new Set<ClusterTx>();
      for (const tx of chunk.txs) {
        if (!parentSide.has(tx)) {
          childSide.add(tx);
        }
      }

      let childFee = 0;
      let childWeight = 0;
      for (const tx of childSide) {
        childFee += tx.effectiveFee;
        childWeight += tx.weight;
      }

      const newChunkId = nextChunkId++;
      chunks.set(newChunkId, {
        id: newChunkId,
        txs: childSide,
        fee: childFee,
        weight: childWeight,
      });

      let parentFee = 0;
      let parentWeight = 0;
      for (const tx of parentSide) {
        parentFee += tx.effectiveFee;
        parentWeight += tx.weight;
      }

      chunk.txs = parentSide;
      chunk.fee = parentFee;
      chunk.weight = parentWeight;

      for (const tx of childSide) {
        txToChunk.set(tx, newChunkId);
      }

      for (const d of deps) {
        if (d.active) {
          const c1 = txToChunk.get(d.parent);
          const c2 = txToChunk.get(d.child);
          if (c1 !== c2) {
            d.active = false;
          }
        }
      }

      mergeUpwards(parentChunkId, deps, chunks, txToChunk);
      mergeDownwards(newChunkId, deps, chunks, txToChunk);
    }
  }

  return nextChunkId;
}

function hasTransitiveDependency(
  chunkTxs: Set<ClusterTx>,
  parentSide: Set<ClusterTx>
): boolean {
  for (const tx of chunkTxs) {
    if (!parentSide.has(tx)) {
      for (const pTx of parentSide) {
        if (tx.ancestors.has(pTx)) {
          return true;
        }
      }
    }
  }
  return false;
}

function computeSplitQuality(
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  dep: SFLDependency
): number | null {
  const parentChunkId = txToChunk.get(dep.parent);
  const childChunkId = txToChunk.get(dep.child);
  if (parentChunkId === undefined || childChunkId === undefined || parentChunkId !== childChunkId) {
    return null;
  }
  const chunk = chunks.get(parentChunkId);
  if (!chunk) {
    return null;
  }

  const adj = buildChunkAdjacency(deps, chunk.txs, dep);
  const parentSide = bfsReachable(adj, dep.parent);
  if (parentSide.has(dep.child)) {
    return null;
  }

  let hpFee = 0;
  let hpWeight = 0;
  for (const tx of parentSide) {
    hpFee += tx.effectiveFee;
    hpWeight += tx.weight;
  }

  let hcFee = 0;
  let hcWeight = 0;
  for (const tx of chunk.txs) {
    if (!parentSide.has(tx)) {
      hcFee += tx.effectiveFee;
      hcWeight += tx.weight;
    }
  }

  return hpFee * hcWeight - hcFee * hpWeight;
}

interface BestDep {
  dep: SFLDependency;
  q: number;
}

function findBestDepToSplit(
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
): BestDep | null {
  let bestDep: SFLDependency | null = null;
  let bestQ = 0;

  for (const dep of deps) {
    if (dep.active) {
      const q = computeSplitQuality(deps, chunks, txToChunk, dep);
      if (q !== null && (q > bestQ || (q > 0 && q === bestQ && Math.random() < 0.5))) {
        bestQ = q;
        bestDep = dep;
      }
    }
  }

  if (!bestDep || bestQ <= 0) {
    return null;
  }
  return { dep: bestDep, q: bestQ };
}

function chunkCmp(a: SFLChunk, b: SFLChunk, chunkMaxOrder: Map<number, number>): number {
  if (higherFeerate(a.fee, a.weight, b.fee, b.weight)) {
    return -1;
  }
  if (higherFeerate(b.fee, b.weight, a.fee, a.weight)) {
    return 1;
  }
  if (a.weight !== b.weight) {
    return b.weight - a.weight;
  }
  return (chunkMaxOrder.get(a.id) ?? 0) - (chunkMaxOrder.get(b.id) ?? 0);
}

function txCmp(a: ClusterTx, b: ClusterTx): number {
  if (higherFeerate(a.effectiveFee, a.weight, b.effectiveFee, b.weight)) {
    return -1;
  }
  if (higherFeerate(b.effectiveFee, b.weight, a.effectiveFee, a.weight)) {
    return 1;
  }
  if (a.weight !== b.weight) {
    return b.weight - a.weight;
  }
  return a.order - b.order;
}

function extractLinearization(
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
): ClusterTx[] {
  const chunkList = [...chunks.values()];

  const chunkMaxOrder = new Map<number, number>();
  for (const c of chunkList) {
    let max = 0;
    for (const tx of c.txs) {
      if (tx.order > max) {
        max = tx.order;
      }
    }
    chunkMaxOrder.set(c.id, max);
  }

  const { chunkDeps, chunkChildren } = buildChunkDependencies(chunkList, txToChunk);

  return emitLinearization(chunkList, chunkDeps, chunkChildren, chunkMaxOrder, chunks);
}

function buildChunkDependencies(
  chunkList: SFLChunk[],
  txToChunk: Map<ClusterTx, number>
): { chunkDeps: Map<number, number>; chunkChildren: Map<number, number[]> } {
  const chunkDeps = new Map<number, number>();
  const chunkChildren = new Map<number, number[]>();

  for (const c of chunkList) {
    chunkChildren.set(c.id, []);
  }

  for (const c of chunkList) {
    const depChunks = new Set<number>();
    for (const tx of c.txs) {
      for (const parent of tx.parents) {
        const parentChunk = txToChunk.get(parent);
        if (parentChunk !== undefined && parentChunk !== c.id) {
          depChunks.add(parentChunk);
        }
      }
    }
    chunkDeps.set(c.id, depChunks.size);
    for (const d of depChunks) {
      const children = chunkChildren.get(d);
      if (children) {
        children.push(c.id);
      }
    }
  }

  return { chunkDeps, chunkChildren };
}

function emitLinearization(
  chunkList: SFLChunk[],
  chunkDeps: Map<number, number>,
  chunkChildren: Map<number, number[]>,
  chunkMaxOrder: Map<number, number>,
  chunkMap: Map<number, SFLChunk>
): ClusterTx[] {
  const result: ClusterTx[] = [];

  const readyChunks: SFLChunk[] = [];
  for (const c of chunkList) {
    if (chunkDeps.get(c.id) === 0) {
      readyChunks.push(c);
    }
  }
  readyChunks.sort((a, b) => chunkCmp(a, b, chunkMaxOrder));

  while (readyChunks.length > 0) {
    const chunk = readyChunks.shift();
    if (!chunk) {
      break;
    }

    emitChunkTxs(chunk, result);

    const children = chunkChildren.get(chunk.id);
    if (children) {
      for (const childChunkId of children) {
        const prevCount = chunkDeps.get(childChunkId) ?? 0;
        const newCount = prevCount - 1;
        chunkDeps.set(childChunkId, newCount);
        if (newCount === 0) {
          const childChunk = chunkMap.get(childChunkId);
          if (childChunk) {
            insertSortedChunk(readyChunks, childChunk, chunkMaxOrder);
          }
        }
      }
    }
  }

  return result;
}

function emitChunkTxs(
  chunk: SFLChunk,
  result: ClusterTx[]
): void {
  const txSet = new Set(chunk.txs);
  const txDepCount = new Map<ClusterTx, number>();
  for (const tx of txSet) {
    let count = 0;
    for (const parent of tx.parents) {
      if (txSet.has(parent)) {
        count++;
      }
    }
    txDepCount.set(tx, count);
  }

  const readyTxs: ClusterTx[] = [];
  for (const tx of txSet) {
    if (txDepCount.get(tx) === 0) {
      readyTxs.push(tx);
    }
  }
  readyTxs.sort((a, b) => txCmp(a, b));

  const emitted = new Set<ClusterTx>();
  while (readyTxs.length > 0) {
    const best = readyTxs.shift();
    if (!best) {
      break;
    }
    result.push(best);
    emitted.add(best);

    for (const child of best.children) {
      if (txSet.has(child) && !emitted.has(child)) {
        const prevCount = txDepCount.get(child) ?? 0;
        const newCount = prevCount - 1;
        txDepCount.set(child, newCount);
        if (newCount === 0) {
          insertSortedTx(readyTxs, child);
        }
      }
    }
  }
}

function insertSortedChunk(arr: SFLChunk[], item: SFLChunk, chunkMaxOrder: Map<number, number>): void {
  const idx = arr.findIndex(e => chunkCmp(item, e, chunkMaxOrder) < 0);
  if (idx === -1) {
    arr.push(item);
  } else {
    arr.splice(idx, 0, item);
  }
}

function insertSortedTx(arr: ClusterTx[], item: ClusterTx): void {
  const idx = arr.findIndex(e => txCmp(item, e) < 0);
  if (idx === -1) {
    arr.push(item);
  } else {
    arr.splice(idx, 0, item);
  }
}

function minimizeChunks(chunks: LinearizationChunk[]): LinearizationChunk[] {
  const result: LinearizationChunk[] = [];

  for (const chunk of chunks) {
    if (chunk.txs.length <= 1) {
      result.push(chunk);
    } else {
      const subChunks = splitChunkByComponents(chunk);
      result.push(...subChunks);
    }
  }

  return result;
}

function splitChunkByComponents(chunk: LinearizationChunk): LinearizationChunk[] {
  const txSet = new Set(chunk.txs);
  const visited = new Set<ClusterTx>();
  const components: ClusterTx[][] = [];

  for (const tx of chunk.txs) {
    if (!visited.has(tx)) {
      const component = bfsComponentWithinChunk(tx, txSet, visited);
      components.push(component);
    }
  }

  if (components.length <= 1) {
    return [chunk];
  }

  const posInLin = new Map<ClusterTx, number>();
  for (let i = 0; i < chunk.txs.length; i++) {
    posInLin.set(chunk.txs[i], i);
  }

  components.sort((a, b) => {
    let aFee = 0, aWeight = 0;
    for (const t of a) { aFee += t.effectiveFee; aWeight += t.weight; }
    let bFee = 0, bWeight = 0;
    for (const t of b) { bFee += t.effectiveFee; bWeight += t.weight; }
    if (higherFeerate(aFee, aWeight, bFee, bWeight)) { return -1; }
    if (higherFeerate(bFee, bWeight, aFee, aWeight)) { return 1; }
    const aMin = Math.min(...a.map(t => posInLin.get(t) ?? 0));
    const bMin = Math.min(...b.map(t => posInLin.get(t) ?? 0));
    return aMin - bMin;
  });

  return components.map(comp => {
    comp.sort((a, b) => (posInLin.get(a) ?? 0) - (posInLin.get(b) ?? 0));

    let fee = 0;
    let weight = 0;
    for (const tx of comp) {
      fee += tx.effectiveFee;
      weight += tx.weight;
    }
    return { txs: comp, fee, weight };
  });
}

function bfsComponentWithinChunk(
  start: ClusterTx,
  txSet: Set<ClusterTx>,
  visited: Set<ClusterTx>
): ClusterTx[] {
  const component: ClusterTx[] = [];
  const queue: ClusterTx[] = [start];
  visited.add(start);

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) {
      break;
    }
    component.push(node);
    for (const parent of node.parents) {
      if (txSet.has(parent) && !visited.has(parent)) {
        visited.add(parent);
        queue.push(parent);
      }
    }
    for (const child of node.children) {
      if (txSet.has(child) && !visited.has(child)) {
        visited.add(child);
        queue.push(child);
      }
    }
  }

  return component;
}

export function linearizeCluster(
  txs: Set<ClusterTx>,
  existingLinearization?: ClusterTx[],
  costBudget?: number,
): { linearization: ClusterTx[]; chunks: LinearizationChunk[] } {
  let linearization = spanningForestLinearize(txs, existingLinearization, costBudget);
  linearization = postLinearize(linearization);
  let chunks = chunkify(linearization);
  chunks = minimizeChunks(chunks);
  linearization = chunks.flatMap(c => c.txs);
  chunks = chunkify(linearization);
  chunks = canonicalizeChunkOrder(chunks);
  linearization = chunks.flatMap(c => c.txs);
  return { linearization, chunks };
}

function canonicalizeChunkOrder(chunks: LinearizationChunk[]): LinearizationChunk[] {
  if (chunks.length <= 1) {
    return chunks;
  }

  const txToChunkIdx = new Map<ClusterTx, number>();
  for (let i = 0; i < chunks.length; i++) {
    for (const tx of chunks[i].txs) {
      txToChunkIdx.set(tx, i);
    }
  }

  const { depCount, chunkChildren } = buildCanonicalChunkDeps(chunks, txToChunkIdx);
  const maxOrder = computeChunkMaxOrder(chunks);

  const ready: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (depCount[i] === 0) {
      ready.push(i);
    }
  }
  ready.sort((a, b) => canonicalChunkCmp(chunks, maxOrder, a, b));

  const result: LinearizationChunk[] = [];
  while (ready.length > 0) {
    const idx = ready.shift();
    if (idx === undefined) {
      break;
    }
    result.push(chunks[idx]);

    for (const childIdx of chunkChildren[idx]) {
      depCount[childIdx]--;
      if (depCount[childIdx] === 0) {
        insertSortedCanonicalChunk(ready, childIdx, chunks, maxOrder);
      }
    }
  }

  return result;
}

function buildCanonicalChunkDeps(
  chunks: LinearizationChunk[],
  txToChunkIdx: Map<ClusterTx, number>,
): { depCount: number[]; chunkChildren: number[][] } {
  const depCount = new Array(chunks.length).fill(0);
  const chunkChildren: number[][] = chunks.map(() => []);
  const seen: Set<number>[] = chunks.map(() => new Set());

  for (let i = 0; i < chunks.length; i++) {
    for (const tx of chunks[i].txs) {
      for (const parent of tx.parents) {
        const parentIdx = txToChunkIdx.get(parent);
        if (parentIdx !== undefined && parentIdx !== i && !seen[i].has(parentIdx)) {
          seen[i].add(parentIdx);
          depCount[i]++;
          chunkChildren[parentIdx].push(i);
        }
      }
    }
  }

  return { depCount, chunkChildren };
}

function computeChunkMaxOrder(chunks: LinearizationChunk[]): number[] {
  return chunks.map(chunk => {
    let max = 0;
    for (const tx of chunk.txs) {
      if (tx.order > max) {
        max = tx.order;
      }
    }
    return max;
  });
}

function canonicalChunkCmp(chunks: LinearizationChunk[], maxOrder: number[], a: number, b: number): number {
  const ac = chunks[a];
  const bc = chunks[b];
  if (higherFeerate(ac.fee, ac.weight, bc.fee, bc.weight)) {
    return -1;
  }
  if (higherFeerate(bc.fee, bc.weight, ac.fee, ac.weight)) {
    return 1;
  }
  if (ac.weight !== bc.weight) {
    return ac.weight - bc.weight;
  }
  return maxOrder[a] - maxOrder[b];
}

function insertSortedCanonicalChunk(ready: number[], idx: number, chunks: LinearizationChunk[], maxOrder: number[]): void {
  const insertPos = ready.findIndex(r => canonicalChunkCmp(chunks, maxOrder, idx, r) < 0);
  if (insertPos === -1) {
    ready.push(idx);
  } else {
    ready.splice(insertPos, 0, idx);
  }
}
