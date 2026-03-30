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

function pickRandomTx(txs: Set<ClusterTx>): ClusterTx | null {
  const arr = [...txs];
  if (arr.length === 0) {
    return null;
  }
  return arr[Math.floor(Math.random() * arr.length)];
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

const enum MergeDir { Up, Down, Both }

interface SFLCost { cost: number; }

export function spanningForestLinearize(
  txs: Set<ClusterTx>,
  costBudget: number,
  existingLinearization?: ClusterTx[],
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

  const { chunks, txToChunk, nextChunkId: startNextId } = initSFLChunks(allTxs);

  const cost: SFLCost = { cost: 87 * allTxs.length + 4 * deps.length };

  if (existingLinearization && existingLinearization.length > 0) {
    for (const tx of existingLinearization) {
      const chunkId = txs.has(tx) ? txToChunk.get(tx) : undefined;
      if (chunkId !== undefined) {
        mergeUpwards(chunkId, deps, chunks, txToChunk, cost);
      }
    }
  }

  let nextId = makeTopological(deps, chunks, txToChunk, startNextId, cost);
  if (cost.cost < costBudget) {
    nextId = optimizeSFL(deps, chunks, txToChunk, nextId, costBudget, cost);
  }
  if (cost.cost < costBudget) {
    minimizeSFL(deps, chunks, txToChunk, nextId, costBudget, cost);
  }

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
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
  chunks?: Map<number, SFLChunk>,
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
  const mergedChunkSize = chunks?.get(chunkId)?.txs.size ?? 0;
  cost.cost += 10 * mergedChunkSize + 1;
}

function pickMergeCandidateUp(
  chunkId: number,
  chunk: SFLChunk,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): number | null {
  let bestChunkId: number | null = null;
  let bestFee = 0;
  let bestWeight = 0;
  let bestTiebreak = 0;
  const visited = new Set<number>();
  for (const dep of deps) {
    if (!dep.active) {
      const childChunk = txToChunk.get(dep.child);
      const parentChunkId = txToChunk.get(dep.parent);
      if (childChunk === chunkId && parentChunkId !== chunkId && parentChunkId !== undefined) {
        visited.add(parentChunkId);
        const pChunk = chunks.get(parentChunkId);
        if (pChunk && !higherFeerate(pChunk.fee, pChunk.weight, chunk.fee, chunk.weight)) {
          const tiebreak = Math.random();
          if (bestChunkId === null
            || higherFeerate(bestFee, bestWeight, pChunk.fee, pChunk.weight)
            || (!higherFeerate(pChunk.fee, pChunk.weight, bestFee, bestWeight) && tiebreak > bestTiebreak)) {
            bestChunkId = parentChunkId;
            bestFee = pChunk.fee;
            bestWeight = pChunk.weight;
            bestTiebreak = tiebreak;
          }
        }
      }
    }
  }
  cost.cost += 8 * visited.size;
  return bestChunkId;
}

function mergeStep(
  dir: MergeDir.Up | MergeDir.Down,
  chunkId: number,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): number | null {
  if (dir === MergeDir.Up) {
    return mergeStepUp(chunkId, deps, chunks, txToChunk, cost);
  }
  return mergeStepDown(chunkId, deps, chunks, txToChunk, cost);
}

function mergeStepUp(
  chunkId: number,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): number | null {
  const chunk = chunks.get(chunkId);
  if (!chunk) {
    return null;
  }
  const parentChunkId = pickMergeCandidateUp(chunkId, chunk, deps, chunks, txToChunk, cost);
  if (parentChunkId === null) {
    return null;
  }
  const dep = pickRandomCrossChunkDep(parentChunkId, chunkId, deps, txToChunk, chunks, cost);
  if (!dep) {
    return null;
  }
  dep.active = true;
  mergeChunks(chunkId, parentChunkId, chunks, txToChunk);
  activateInternalDeps(chunkId, deps, txToChunk, cost, chunks);
  return chunkId;
}

function mergeStepDown(
  chunkId: number,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): number | null {
  const chunk = chunks.get(chunkId);
  if (!chunk) {
    return null;
  }
  const childChunkId = pickMergeCandidateDown(chunkId, chunk, deps, chunks, txToChunk, cost);
  if (childChunkId === null) {
    return null;
  }
  const dep = pickRandomCrossChunkDep(chunkId, childChunkId, deps, txToChunk, chunks, cost);
  if (!dep) {
    return null;
  }
  dep.active = true;
  mergeChunks(chunkId, childChunkId, chunks, txToChunk);
  activateInternalDeps(chunkId, deps, txToChunk, cost, chunks);
  return chunkId;
}

function makeTopological(
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  nextChunkId: number,
  cost: SFLCost,
): number {
  const queue: number[] = [];
  const onQueue = new Set<number>();
  for (const [chunkId] of chunks) {
    queue.push(chunkId);
    const j = Math.floor(Math.random() * queue.length);
    if (j !== queue.length - 1) {
      [queue[queue.length - 1], queue[j]] = [queue[j], queue[queue.length - 1]];
    }
    onQueue.add(chunkId);
  }

  const mergedChunks = new Set<number>();
  const initDir: MergeDir = Math.random() < 0.5 ? MergeDir.Up : MergeDir.Down;
  let numSteps = 0;

  while (queue.length > 0) {
    const chunkId = queue.shift();
    if (chunkId === undefined) {
      break;
    }
    onQueue.delete(chunkId);
    if (!chunks.has(chunkId)) {
      continue;
    }
    numSteps++;

    const dir = mergedChunks.has(chunkId) ? MergeDir.Both : initDir;
    const first = Math.random() < 0.5 ? MergeDir.Up : MergeDir.Down;
    const second = first === MergeDir.Up ? MergeDir.Down : MergeDir.Up;

    let result: number | null = null;
    if (dir === MergeDir.Both || dir === first) {
      result = mergeStep(first, chunkId, deps, chunks, txToChunk, cost);
    }
    if (result === null && (dir === MergeDir.Both || dir === second)) {
      result = mergeStep(second, chunkId, deps, chunks, txToChunk, cost);
    }

    if (result !== null) {
      if (!onQueue.has(result)) {
        onQueue.add(result);
        queue.push(result);
      }
      mergedChunks.add(result);
    }
  }

  cost.cost += 20 * chunks.size + 28 * numSteps;

  return nextChunkId;
}

function mergeUpwards(
  chunkId: number,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): void {
  let done = false;
  while (!done) {
    done = mergeStepUp(chunkId, deps, chunks, txToChunk, cost) === null;
  }
}

function pickMergeCandidateDown(
  chunkId: number,
  chunk: SFLChunk,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): number | null {
  let bestChunkId: number | null = null;
  let bestFee = 0;
  let bestWeight = 0;
  let bestTiebreak = 0;
  const visited = new Set<number>();
  for (const dep of deps) {
    if (!dep.active) {
      const parentChunk = txToChunk.get(dep.parent);
      const childChunkId = txToChunk.get(dep.child);
      if (parentChunk === chunkId && childChunkId !== chunkId && childChunkId !== undefined) {
        visited.add(childChunkId);
        const cChunk = chunks.get(childChunkId);
        if (cChunk && !higherFeerate(chunk.fee, chunk.weight, cChunk.fee, cChunk.weight)) {
          const tiebreak = Math.random();
          if (bestChunkId === null
            || higherFeerate(cChunk.fee, cChunk.weight, bestFee, bestWeight)
            || (!higherFeerate(bestFee, bestWeight, cChunk.fee, cChunk.weight) && tiebreak > bestTiebreak)) {
            bestChunkId = childChunkId;
            bestFee = cChunk.fee;
            bestWeight = cChunk.weight;
            bestTiebreak = tiebreak;
          }
        }
      }
    }
  }
  cost.cost += 8 * visited.size;
  return bestChunkId;
}

function pickRandomCrossChunkDep(
  topChunkId: number,
  bottomChunkId: number,
  deps: SFLDependency[],
  txToChunk: Map<ClusterTx, number>,
  chunks: Map<number, SFLChunk>,
  cost: SFLCost,
): SFLDependency | null {
  const topChunk = chunks.get(topChunkId);
  const candidates: SFLDependency[] = [];
  let scanSteps = 0;
  for (const d of deps) {
    if (!d.active) {
      const pChunk = txToChunk.get(d.parent);
      const cChunk = txToChunk.get(d.child);
      if (pChunk === topChunkId && cChunk === bottomChunkId) {
        candidates.push(d);
      }
      scanSteps++;
    }
  }
  cost.cost += 2 * (topChunk?.txs.size ?? 0);
  cost.cost += 3 * scanSteps + 5;
  if (candidates.length === 0) {
    return null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function mergeDownwards(
  chunkId: number,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): void {
  let done = false;
  while (!done) {
    done = mergeStepDown(chunkId, deps, chunks, txToChunk, cost) === null;
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
  maxCost: number,
  cost: SFLCost,
): number {
  const queue: number[] = [];
  const onQueue = new Set<number>();
  for (const [chunkId] of chunks) {
    queue.push(chunkId);
    const j = Math.floor(Math.random() * queue.length);
    if (j !== queue.length - 1) {
      [queue[queue.length - 1], queue[j]] = [queue[j], queue[queue.length - 1]];
    }
    onQueue.add(chunkId);
  }

  cost.cost += 13 * chunks.size;

  while (cost.cost < maxCost) {
    let chunkId: number | undefined;
    let numPopped = 0;
    while (queue.length > 0) {
      const candidate = queue.shift();
      if (candidate === undefined) {
        break;
      }
      numPopped++;
      onQueue.delete(candidate);
      if (chunks.has(candidate)) {
        chunkId = candidate;
        break;
      }
    }
    cost.cost += 1 * numPopped + 4;
    if (chunkId === undefined) {
      break;
    }

    const chunk = chunks.get(chunkId);
    if (!chunk) {
      break;
    }

    const split = pickDependencyToSplit(deps, chunk, chunkId, txToChunk, cost);
    if (split) {
      const result = splitAndMerge(
        split.dep, split.parentSide, chunkId, chunk,
        deps, chunks, txToChunk, nextChunkId, cost,
      );
      nextChunkId = result.nextChunkId;

      if (!onQueue.has(chunkId) && chunks.has(chunkId)) {
        onQueue.add(chunkId);
        queue.push(chunkId);
      }
      if (!onQueue.has(result.childChunkId) && chunks.has(result.childChunkId)) {
        onQueue.add(result.childChunkId);
        queue.push(result.childChunkId);
      }
    }
  }

  return nextChunkId;
}

function computeDepTopSet(
  dep: SFLDependency,
  chunk: SFLChunk,
  chunkId: number,
  deps: SFLDependency[],
  txToChunk: Map<ClusterTx, number>,
): { parentSide: Set<ClusterTx>; topFee: number; topWeight: number } | null {
  if (!dep.active
    || txToChunk.get(dep.parent) !== chunkId
    || txToChunk.get(dep.child) !== chunkId) {
    return null;
  }
  const adj = buildChunkAdjacency(deps, chunk.txs, dep);
  const parentSide = bfsReachable(adj, dep.parent);
  if (parentSide.has(dep.child)) {
    return null;
  }
  let topFee = 0;
  let topWeight = 0;
  for (const tx of parentSide) {
    topFee += tx.effectiveFee;
    topWeight += tx.weight;
  }
  return { parentSide, topFee, topWeight };
}

function pickDependencyToSplit(
  deps: SFLDependency[],
  chunk: SFLChunk,
  chunkId: number,
  txToChunk: Map<ClusterTx, number>,
  cost: SFLCost,
): { dep: SFLDependency; parentSide: Set<ClusterTx> } | null {
  let best: { dep: SFLDependency; parentSide: Set<ClusterTx> } | null = null;
  let bestTiebreak = 0;

  for (const dep of deps) {
    const split = computeDepTopSet(dep, chunk, chunkId, deps, txToChunk);
    if (split && split.topFee * chunk.weight > chunk.fee * split.topWeight) {
      const tiebreak = Math.random();
      if (tiebreak >= bestTiebreak) {
        bestTiebreak = tiebreak;
        best = { dep, parentSide: split.parentSide };
      }
    }
  }

  cost.cost += 8 * chunk.txs.size + 9;
  return best;
}

function splitAndMerge(
  dep: SFLDependency,
  parentSide: Set<ClusterTx>,
  parentChunkId: number,
  parentChunk: SFLChunk,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  nextChunkId: number,
  cost: SFLCost,
): { nextChunkId: number; childChunkId: number } {
  dep.active = false;

  const origChunkSize = parentChunk.txs.size;

  const childSide = new Set<ClusterTx>();
  for (const tx of parentChunk.txs) {
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

  const childChunkId = nextChunkId++;
  chunks.set(childChunkId, {
    id: childChunkId,
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
  parentChunk.txs = parentSide;
  parentChunk.fee = parentFee;
  parentChunk.weight = parentWeight;

  for (const tx of childSide) {
    txToChunk.set(tx, childChunkId);
  }

  for (const d of deps) {
    if (d.active && txToChunk.get(d.parent) !== txToChunk.get(d.child)) {
      d.active = false;
    }
  }

  cost.cost += 11 * (origChunkSize - 1) + 8;

  let needsSelfMerge = false;
  for (const d of deps) {
    if (!d.active && txToChunk.get(d.parent) === parentChunkId && txToChunk.get(d.child) === childChunkId) {
      needsSelfMerge = true;
      break;
    }
  }

  if (needsSelfMerge) {
    const selfDep = pickRandomCrossChunkDep(childChunkId, parentChunkId, deps, txToChunk, chunks, cost);
    if (selfDep) {
      selfDep.active = true;
      mergeChunks(childChunkId, parentChunkId, chunks, txToChunk);
      activateInternalDeps(childChunkId, deps, txToChunk, cost, chunks);
    }
  } else {
    mergeUpwards(parentChunkId, deps, chunks, txToChunk, cost);
    mergeDownwards(childChunkId, deps, chunks, txToChunk, cost);
  }

  return { nextChunkId, childChunkId };
}

interface MinimizeQueueEntry {
  chunkId: number;
  pivot: ClusterTx;
  movePivotDown: boolean;
  secondStage: boolean;
}

function minimizeSFL(
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  nextChunkId: number,
  maxCost: number,
  cost: SFLCost,
): number {
  const queue: MinimizeQueueEntry[] = [];

  for (const [chunkId, chunk] of chunks) {
    const pivot = pickRandomTx(chunk.txs);
    if (pivot) {
      queue.push({ chunkId, pivot, movePivotDown: Math.random() < 0.5, secondStage: false });
      const j = Math.floor(Math.random() * queue.length);
      if (j !== queue.length - 1) {
        [queue[queue.length - 1], queue[j]] = [queue[j], queue[queue.length - 1]];
      }
    }
  }

  cost.cost += 18 * chunks.size;

  while (queue.length > 0 && cost.cost < maxCost) {
    const entry = queue.shift();
    if (!entry) {
      break;
    }

    const chunk = chunks.get(entry.chunkId);
    if (chunk) {
      nextChunkId = minimizeChunkStep(
        chunk, entry,
        deps, chunks, txToChunk, nextChunkId, queue, cost,
      );
    }
  }

  return nextChunkId;
}

function minimizeChunkStep(
  chunk: SFLChunk,
  entry: MinimizeQueueEntry,
  deps: SFLDependency[],
  chunks: Map<number, SFLChunk>,
  txToChunk: Map<ClusterTx, number>,
  nextChunkId: number,
  queue: MinimizeQueueEntry[],
  cost: SFLCost,
): number {
  const { chunkId, pivot, movePivotDown, secondStage } = entry;

  let haveAny = false;
  let bestDep: SFLDependency | null = null;
  let bestParentSide: Set<ClusterTx> | null = null;
  let bestTiebreak = 0;

  for (const dep of deps) {
    const split = computeDepTopSet(dep, chunk, chunkId, deps, txToChunk);
    if (split && split.topFee * chunk.weight === chunk.fee * split.topWeight) {
      haveAny = true;
      if (movePivotDown !== split.parentSide.has(pivot)) {
        const tiebreak = Math.random();
        if (tiebreak > bestTiebreak) {
          bestTiebreak = tiebreak;
          bestDep = dep;
          bestParentSide = split.parentSide;
        }
      }
    }
  }

  cost.cost += 11 * chunk.txs.size + 11;

  if (!haveAny) {
    cost.cost += 7;
    return nextChunkId;
  }

  if (!bestDep || !bestParentSide) {
    if (!secondStage) {
      queue.push({ chunkId, pivot, movePivotDown: !movePivotDown, secondStage: true });
    }
    cost.cost += 7;
    return nextChunkId;
  }

  const result = splitAndMerge(
    bestDep, bestParentSide, chunkId, chunk,
    deps, chunks, txToChunk, nextChunkId, cost,
  );
  nextChunkId = result.nextChunkId;
  const childChunkId = result.childChunkId;

  cost.cost += 17 + 7;

  if (movePivotDown) {
    const parentPivot = pickRandomTx(chunks.get(chunkId)?.txs ?? new Set());
    if (parentPivot) {
      queue.push({ chunkId, pivot: parentPivot, movePivotDown: Math.random() < 0.5, secondStage: false });
    }
    queue.push({ chunkId: childChunkId, pivot, movePivotDown, secondStage });
  } else {
    queue.push({ chunkId, pivot, movePivotDown, secondStage });
    const childPivot = pickRandomTx(chunks.get(childChunkId)?.txs ?? new Set());
    if (childPivot) {
      queue.push({ chunkId: childChunkId, pivot: childPivot, movePivotDown: Math.random() < 0.5, secondStage: false });
    }
  }

  if (queue.length >= 2 && Math.random() < 0.5) {
    const last = queue.length - 1;
    [queue[last], queue[last - 1]] = [queue[last - 1], queue[last]];
  }

  return nextChunkId;
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
  costBudget: number,
  existingLinearization?: ClusterTx[],
): { linearization: ClusterTx[]; chunks: LinearizationChunk[] } {
  let linearization = spanningForestLinearize(txs, costBudget, existingLinearization);
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
