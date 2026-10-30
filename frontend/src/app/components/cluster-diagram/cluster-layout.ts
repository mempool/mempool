export function cellKey(col: number, row: number): string {
  return `${col}:${row}`;
}
export function cellCol(key: string): number {
  return parseInt(key, 10);
}
export function cellRow(key: string): number {
  return parseInt(key.substring(key.indexOf(':') + 1), 10);
}

export interface GridNode {
  index: number;
  col: number;
  row: number;
  chunkIndex: number;
}

export interface SlotInfo {
  slot: number;
  count: number;
}

export interface GridEdge {
  parent: number;
  child: number;
  waypoints: { col: number; row: number }[];
  exitSlot: number;
  exitCount: number;
  entrySlot: number;
  entryCount: number;
  verticalSlots: SlotInfo[];
  horizontalSlots: SlotInfo[];
}

export interface ChunkRegion {
  chunkIndex: number;
  cells: Set<string>;
  bridges: Set<string>;
}

export interface GridLayout {
  nodes: GridNode[];
  edges: GridEdge[];
  chunks: ChunkRegion[];
  cols: number;
  rows: number;
  rowLaneCounts: number[];
  colLaneCounts: number[];
}

interface TxInput {
  parents: number[];
}

interface ChunkInput {
  txs: number[];
}

export function computeGridLayout(txs: TxInput[], chunks: ChunkInput[]): GridLayout {
  const n = txs.length;
  if (n === 0) {
    return { nodes: [], edges: [], chunks: [], cols: 0, rows: 0, rowLaneCounts: [], colLaneCounts: [] };
  }

  const children: number[][] = txs.map(() => []);
  for (let i = 0; i < n; i++) {
    for (const p of txs[i].parents) {
      children[p].push(i);
    }
  }

  const txChunk = new Int32Array(n);
  for (let ci = 0; ci < chunks.length; ci++) {
    for (const ti of chunks[ci].txs) {
      txChunk[ti] = ci;
    }
  }

  const cols = assignColumns(txs, children, n);
  const maxCol = Math.max(...cols);

  const colNodes: number[][] = Array.from({ length: maxCol + 1 }, () => []);
  for (let i = 0; i < n; i++) {
    colNodes[cols[i]].push(i);
  }

  const totalRows = Math.max(...colNodes.map(cn => cn.length));
  const rows = assignRows(txs, children, txChunk, colNodes, n, maxCol, totalRows);
  const maxRow = Math.max(...rows);

  const nodes: GridNode[] = [];
  for (let i = 0; i < n; i++) {
    nodes.push({ index: i, col: cols[i], row: rows[i], chunkIndex: txChunk[i] });
  }

  const edges = routeEdges(txs, nodes, maxRow);
  optimizeCrossings(edges, nodes, maxRow);
  const rowLaneCounts = new Array(maxRow + 1).fill(0);
  assignSlots(edges, rowLaneCounts);

  const colLaneCounts = new Array(maxCol + 1).fill(0);
  for (const e of edges) {
    for (let si = 0; si < e.verticalSlots.length; si++) {
      const col = e.waypoints[si].col;
      colLaneCounts[col] = Math.max(colLaneCounts[col], e.verticalSlots[si].count);
    }
  }

  const chunkRegions = computeChunkRegions(nodes, chunks);

  return { nodes, edges, chunks: chunkRegions, cols: maxCol + 1, rows: maxRow + 1, rowLaneCounts, colLaneCounts };
}

function assignColumns(txs: TxInput[], children: number[][], n: number): Int32Array {
  const cols = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (txs[i].parents.length === 0) {
      cols[i] = 0;
    } else {
      let maxParentCol = 0;
      for (const p of txs[i].parents) {
        maxParentCol = Math.max(maxParentCol, cols[p]);
      }
      cols[i] = maxParentCol + 1;
    }
  }

  const maxCol = Math.max(...cols);
  for (let i = 0; i < n; i++) {
    if (children[i].length === 0) {
      cols[i] = maxCol;
    }
  }
  return cols;
}

function assignRows(
  txs: TxInput[], children: number[][], txChunk: Int32Array,
  colNodes: number[][], n: number, maxCol: number, totalRows: number,
): Int32Array {
  const rows = new Int32Array(n);
  const placed = new Uint8Array(n);
  const nodeCol = new Int32Array(n);
  for (let c = 0; c < colNodes.length; c++) {
    for (const i of colNodes[c]) { nodeCol[i] = c; }
  }

  const nearestDescendantCol = new Int32Array(n);
  nearestDescendantCol.fill(maxCol + 1);
  for (let i = n - 1; i >= 0; i--) {
    for (const ch of children[i]) {
      nearestDescendantCol[i] = Math.min(nearestDescendantCol[i], nodeCol[ch], nearestDescendantCol[ch]);
    }
  }

  for (let c = maxCol; c >= 0; c--) {
    const layer = colNodes[c];
    if (layer.length === 0) { continue; }

    const targets = layer.map(i => {
      if (children[i].length > 0) {
        let sum = 0;
        let count = 0;
        for (const ch of children[i]) {
          if (placed[ch]) {
            sum += rows[ch];
            count++;
          }
        }
        if (count > 0) { return sum / count; }
      }
      return (totalRows - 1) / 2;
    });

    const sorted = layer.map((nodeIdx, arrIdx) => ({
      nodeIdx, arrIdx, target: targets[arrIdx], chunk: txChunk[nodeIdx], nearestDescendantCol: nearestDescendantCol[nodeIdx],
    }));
    sorted.sort((a, b) => {
      const dt = a.target - b.target;
      if (Math.abs(dt) > 0.001) { return dt; }
      if (a.chunk !== b.chunk) { return a.chunk - b.chunk; }
      if (a.nearestDescendantCol !== b.nearestDescendantCol) {
        return a.nearestDescendantCol - b.nearestDescendantCol;
      }
      return a.nodeIdx - b.nodeIdx;
    });

    const slots = pickSlots(
      sorted.map(s => s.target),
      totalRows,
      hasDescendantColumnTie(sorted.map(s => s.nodeIdx), sorted.map(s => s.target), nearestDescendantCol, maxCol),
    );
    for (let k = 0; k < sorted.length; k++) {
      rows[sorted[k].nodeIdx] = slots[k];
      placed[sorted[k].nodeIdx] = 1;
    }
  }

  for (let pass = 0; pass < 4; pass++) {
    const forward = pass % 2 === 0;
    for (let c = forward ? 0 : maxCol; forward ? c <= maxCol : c >= 0; forward ? c++ : c--) {
      const layer = colNodes[c];
      if (layer.length === 0) { continue; }

      const targets = layer.map(i => {
        const neighbors = forward ? txs[i].parents : children[i];
        if (neighbors.length === 0) { return rows[i]; }
        let sum = 0;
        for (const nb of neighbors) { sum += rows[nb]; }
        return sum / neighbors.length;
      });

      const indexed = layer.map((_, idx) => idx);
      indexed.sort((a, b) => {
        const dt = targets[a] - targets[b];
        if (Math.abs(dt) > 0.001) { return dt; }
        if (nearestDescendantCol[layer[a]] !== nearestDescendantCol[layer[b]]) {
          return nearestDescendantCol[layer[a]] - nearestDescendantCol[layer[b]];
        }
        return layer[a] - layer[b];
      });

      const slots = pickSlots(
        indexed.map(i => targets[i]),
        totalRows,
        hasDescendantColumnTie(indexed.map(i => layer[i]), indexed.map(i => targets[i]), nearestDescendantCol, maxCol),
      );
      for (let k = 0; k < indexed.length; k++) {
        rows[layer[indexed[k]]] = slots[k];
      }
    }
  }

  compactRows(rows, n);
  for (let i = 0; i < n; i++) { rows[i] *= 2; }
  return rows;
}

function hasDescendantColumnTie(
  nodes: number[],
  targets: number[],
  nearestDescendantCol: Int32Array,
  maxCol: number,
): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (nearestDescendantCol[nodes[i]] > maxCol) { continue; }
    for (let j = 0; j < nodes.length; j++) {
      if (
        i !== j
        && nearestDescendantCol[nodes[i]] !== nearestDescendantCol[nodes[j]]
        && Math.abs(targets[i] - targets[j]) < 0.001
      ) {
        return true;
      }
    }
  }
  return false;
}

function pickSlots(targets: number[], totalRows: number, packFullLayer = false): number[] {
  const count = targets.length;
  if (count >= totalRows && !packFullLayer) {
    return targets.map((_, i) => i);
  }

  const used = new Set<number>();
  const result = new Array<number>(count);
  const order = targets.map((t, i) => ({ i, t })).sort((a, b) => a.t - b.t);

  for (const { i, t } of order) {
    let best = Math.round(t);
    best = Math.max(0, Math.min(totalRows - 1, best));
    if (used.has(best)) {
      let found = false;
      for (let d = 1; d < totalRows; d++) {
        if (best + d < totalRows && !used.has(best + d)) { best = best + d; found = true; break; }
        if (best - d >= 0 && !used.has(best - d)) { best = best - d; found = true; break; }
      }
      if (!found) { best = 0; }
    }
    used.add(best);
    result[i] = best;
  }

  return result;
}

function compactRows(rows: Int32Array, n: number): void {
  const usedRows = new Set<number>();
  for (let i = 0; i < n; i++) { usedRows.add(rows[i]); }
  const sorted = [...usedRows].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  sorted.forEach((r, idx) => remap.set(r, idx));
  for (let i = 0; i < n; i++) { rows[i] = remap.get(rows[i]) ?? 0; }
}

function routeEdges(txs: TxInput[], nodes: GridNode[], maxRow: number): GridEdge[] {
  const nodeAt = new Map<string, number>();
  for (const nd of nodes) {
    nodeAt.set(cellKey(nd.col, nd.row), nd.index);
  }

  const edges: GridEdge[] = [];
  for (let i = 0; i < txs.length; i++) {
    for (const p of txs[i].parents) {
      const pNode = nodes[p];
      const cNode = nodes[i];
      const waypoints = computeWaypoints(pNode, cNode, nodeAt, maxRow);
      edges.push({
        parent: p, child: i, waypoints,
        exitSlot: 0, exitCount: 1,
        entrySlot: 0, entryCount: 1,
        verticalSlots: waypoints.map(() => ({ slot: 0, count: 1 })).slice(0, -1),
        horizontalSlots: waypoints.length > 2
          ? waypoints.slice(1, -1).map(() => ({ slot: 0, count: 1 }))
          : [],
      });
    }
  }

  return edges;
}

function computeWaypoints(
  pNode: GridNode, cNode: GridNode,
  nodeAt: Map<string, number>, maxRow: number
): { col: number; row: number }[] {
  const waypoints: { col: number; row: number }[] = [{ col: pNode.col, row: pNode.row }];

  if (cNode.col - pNode.col <= 1) {
    waypoints.push({ col: cNode.col, row: cNode.row });
    return waypoints;
  }

  const lo = -1;
  const hi = maxRow + 1;
  for (let c = pNode.col + 1; c < cNode.col; c++) {
    const frac = (c - pNode.col) / (cNode.col - pNode.col);
    const idealRow = pNode.row + frac * (cNode.row - pNode.row);
    const targetRow = Math.max(lo, Math.min(hi, Math.round(idealRow)));

    waypoints.push({
      col: c,
      row: selectOpenWaypointRow(c, targetRow, idealRow, nodeAt, lo, hi),
    });
  }

  waypoints.push({ col: cNode.col, row: cNode.row });
  return waypoints;
}

function selectOpenWaypointRow(
  col: number,
  targetRow: number,
  idealRow: number,
  nodeAt: Map<string, number>,
  lo: number,
  hi: number,
): number {
  if (!nodeAt.has(cellKey(col, targetRow))) {
    return targetRow;
  }

  const preferDown = idealRow > targetRow;
  for (let dr = 1; dr <= hi - lo; dr++) {
    const first = preferDown ? targetRow + dr : targetRow - dr;
    const second = preferDown ? targetRow - dr : targetRow + dr;
    if (first >= lo && first <= hi && !nodeAt.has(cellKey(col, first))) {
      return first;
    }
    if (second >= lo && second <= hi && !nodeAt.has(cellKey(col, second))) {
      return second;
    }
  }

  return targetRow;
}

interface VSeg {
  edgeIdx: number;
  segIdx: number;
  fromRow: number;
  toRow: number;
  minRow: number;
  maxRow: number;
}

interface Seg {
  edgeIdx: number;
  type: 'exit' | 'h' | 'entry';
  hIdx: number;
  row: number;
  col: number;
  nextRow: number | null;
  prevRow: number | null;
}

type CellOrder = (Seg | Seg[])[];

interface LaneSeg {
  edgeIdx: number;
  col: number;
  type: 'exit' | 'entry' | 'h' | 'approach';
  hIdx: number;
  order: number;
}

interface SlotIndex {
  verticalGroups: Map<number, VSeg[]>;
  cellIndex: Map<string, Seg[]>;
}

function cellOrderFlatLen(ord: CellOrder): number {
  let n = 0;
  for (const item of ord) { n += Array.isArray(item) ? item.length : 1; }
  return n;
}

function cellOrderFindPos(ord: CellOrder, edgeIdx: number): { pos: number; tied: boolean } | null {
  let pos = 0;
  for (const item of ord) {
    if (Array.isArray(item)) {
      if (item.some(s => s.edgeIdx === edgeIdx)) { return { pos, tied: true }; }
      pos += item.length;
    } else {
      if (item.edgeIdx === edgeIdx) { return { pos, tied: false }; }
      pos++;
    }
  }
  return null;
}

function writeOrderToSlots(ord: CellOrder, edges: GridEdge[]): void {
  const count = cellOrderFlatLen(ord);
  let pos = 0;
  for (const item of ord) {
    const segs = Array.isArray(item) ? item : [item];
    for (const seg of segs) {
      if (seg.type === 'exit') {
        edges[seg.edgeIdx].exitSlot = pos;
        edges[seg.edgeIdx].exitCount = count;
      } else if (seg.type === 'entry') {
        edges[seg.edgeIdx].entrySlot = pos;
        edges[seg.edgeIdx].entryCount = count;
      } else {
        edges[seg.edgeIdx].horizontalSlots[seg.hIdx] = { slot: pos, count };
      }
      pos++;
    }
  }
}

function buildSlotIndex(edges: GridEdge[]): SlotIndex {
  const verticalGroups = new Map<number, VSeg[]>();
  const cellIndex = new Map<string, Seg[]>();

  for (let ei = 0; ei < edges.length; ei++) {
    const wp = edges[ei].waypoints;

    for (let i = 0; i < wp.length - 1; i++) {
      let vg = verticalGroups.get(wp[i].col);
      if (!vg) { vg = []; verticalGroups.set(wp[i].col, vg); }
      vg.push({
        edgeIdx: ei, segIdx: i, fromRow: wp[i].row, toRow: wp[i + 1].row,
        minRow: Math.min(wp[i].row, wp[i + 1].row),
        maxRow: Math.max(wp[i].row, wp[i + 1].row),
      });
    }

    const hPositions: { type: 'exit' | 'h' | 'entry'; hIdx: number; row: number; col: number }[] = [];
    hPositions.push({ type: 'exit', hIdx: -1, row: wp[0].row, col: wp[0].col });
    for (let j = 1; j < wp.length - 1; j++) {
      hPositions.push({ type: 'h', hIdx: j - 1, row: wp[j].row, col: wp[j].col });
    }
    hPositions.push({ type: 'entry', hIdx: -1, row: wp[wp.length - 1].row, col: wp[wp.length - 1].col });

    for (let k = 0; k < hPositions.length; k++) {
      const hp = hPositions[k];
      const nextRow = k < hPositions.length - 1 ? hPositions[k + 1].row : null;
      const prevRow = k > 0 ? hPositions[k - 1].row : null;
      const seg: Seg = { edgeIdx: ei, type: hp.type, hIdx: hp.hIdx, row: hp.row, col: hp.col, nextRow, prevRow };
      const key = cellKey(seg.col, seg.row);
      let arr = cellIndex.get(key);
      if (!arr) { arr = []; cellIndex.set(key, arr); }
      arr.push(seg);
    }
  }

  return { verticalGroups, cellIndex };
}

function initialHorizontalOrdering(cellIndex: Map<string, Seg[]>, edges: GridEdge[]): Map<string, CellOrder> {
  const cellOrderings = new Map<string, CellOrder>();

  for (const [key, segs] of cellIndex) {
    segs.sort((a, b) => {
      if (a.nextRow === null && b.nextRow === null) { return 0; }
      if (a.nextRow === null) { return 1; }
      if (b.nextRow === null) { return -1; }
      return a.nextRow - b.nextRow;
    });

    const ordering: CellOrder = [];
    let i = 0;
    while (i < segs.length) {
      let j = i + 1;
      while (j < segs.length) {
        const sameGroup = (segs[i].nextRow === null && segs[j].nextRow === null)
          || (segs[i].nextRow !== null && segs[j].nextRow !== null && segs[i].nextRow === segs[j].nextRow);
        if (!sameGroup) { break; }
        j++;
      }
      if (j - i === 1) {
        ordering.push(segs[i]);
      } else {
        ordering.push(segs.slice(i, j));
      }
      i = j;
    }

    cellOrderings.set(key, ordering);
    writeOrderToSlots(ordering, edges);
  }

  return cellOrderings;
}

function compareTiedSegs(
  a: Seg, b: Seg, row: number,
  hPos: Map<number, number>, vSlot: Map<number, number>,
  forward: boolean,
): number {
  const aH = hPos.get(a.edgeIdx);
  const bH = hPos.get(b.edgeIdx);
  if (aH !== undefined && bH !== undefined && aH !== bH) { return aH - bH; }

  const aGoesV = aH === undefined;
  const bGoesV = bH === undefined;
  const aNb = aGoesV ? (forward ? a.prevRow : a.nextRow) : null;
  const bNb = bGoesV ? (forward ? b.prevRow : b.nextRow) : null;
  const aDir = aNb !== null ? (aNb < row ? -1 : aNb > row ? 1 : 0) : 0;
  const bDir = bNb !== null ? (bNb < row ? -1 : bNb > row ? 1 : 0) : 0;
  if (aDir !== bDir) { return aDir - bDir; }

  if (aGoesV && bGoesV) {
    const aV = vSlot.get(a.edgeIdx);
    const bV = vSlot.get(b.edgeIdx);
    if (aV !== undefined && bV !== undefined && aV !== bV) {
      const travelDown = forward ? aDir < 0 : aDir > 0;
      if (travelDown) { return bV - aV; }
      const travelUp = forward ? aDir > 0 : aDir < 0;
      if (travelUp) { return aV - bV; }
    }
  }

  if (!aGoesV && bGoesV) { return -1; }
  if (aGoesV && !bGoesV) { return 1; }
  return 0;
}

function compareJoiners(
  a: VSeg, b: VSeg,
  cellOrderings: Map<string, CellOrder>, edges: GridEdge[],
): number {
  const aGroup = a.toRow > a.fromRow ? 0 : a.toRow === a.fromRow ? 1 : 2;
  const bGroup = b.toRow > b.fromRow ? 0 : b.toRow === b.fromRow ? 1 : 2;
  if (aGroup !== bGroup) { return aGroup - bGroup; }

  const aWp = edges[a.edgeIdx].waypoints;
  const aSrcOrd = cellOrderings.get(cellKey(aWp[a.segIdx].col, aWp[a.segIdx].row));
  const aPos = (aSrcOrd ? cellOrderFindPos(aSrcOrd, a.edgeIdx) : null)?.pos ?? 0;

  const bWp = edges[b.edgeIdx].waypoints;
  const bSrcOrd = cellOrderings.get(cellKey(bWp[b.segIdx].col, bWp[b.segIdx].row));
  const bPos = (bSrcOrd ? cellOrderFindPos(bSrcOrd, b.edgeIdx) : null)?.pos ?? 0;

  if (aGroup === 0) {
    if (a.toRow !== b.toRow) { return b.toRow - a.toRow; }
    const aDist = a.toRow - a.fromRow, bDist = b.toRow - b.fromRow;
    if (aDist !== bDist) { return aDist - bDist; }
    return bPos - aPos;
  } else if (aGroup === 2) {
    if (a.toRow !== b.toRow) { return a.toRow - b.toRow; }
    const aDist = a.fromRow - a.toRow, bDist = b.fromRow - b.toRow;
    if (aDist !== bDist) { return aDist - bDist; }
    return aPos - bPos;
  } else {
    return aPos - bPos;
  }
}

function compareContinuers(a: VSeg, b: VSeg, prevVSlot: Map<number, number>): number {
  const aV = prevVSlot.get(a.edgeIdx) ?? 0;
  const bV = prevVSlot.get(b.edgeIdx) ?? 0;
  return aV - bV;
}

function recordHPositions(
  ord: CellOrder, row: number,
  posMap: Map<number, Map<number, number>>,
): void {
  let pm = posMap.get(row);
  if (!pm) { pm = new Map(); posMap.set(row, pm); }
  let pos = 0;
  for (const item of ord) {
    if (Array.isArray(item)) {
      for (const seg of item) { pm.set(seg.edgeIdx, pos); }
      pos += item.length;
    } else {
      pm.set(item.edgeIdx, pos);
      pos++;
    }
  }
}

function sortAndRegroupTied(
  items: Seg[], row: number,
  hPos: Map<number, number>, vSlot: Map<number, number>,
  forward: boolean,
): CellOrder {
  const sorted = [...items];
  sorted.sort((a, b) => compareTiedSegs(a, b, row, hPos, vSlot, forward));
  const result: CellOrder = [];
  let k = 0;
  while (k < sorted.length) {
    let l = k + 1;
    while (l < sorted.length && compareTiedSegs(sorted[l - 1], sorted[l], row, hPos, vSlot, forward) === 0) { l++; }
    if (l - k === 1) { result.push(sorted[k]); }
    else { result.push(sorted.slice(k, l)); }
    k = l;
  }
  return result;
}

function getRowsAtCol(cellIndex: Map<string, Seg[]>, col: number): number[] {
  const rowSet = new Set<number>();
  for (const key of cellIndex.keys()) {
    if (cellCol(key) === col) { rowSet.add(cellRow(key)); }
  }
  return [...rowSet].sort((a, b) => a - b);
}

function resolveOrderingTies(
  cellIndex: Map<string, Seg[]>, cellOrderings: Map<string, CellOrder>,
  edges: GridEdge[], col: number,
  hPosMap: Map<number, Map<number, number>>, vSlot: Map<number, number>,
  forward: boolean,
): void {
  for (const row of getRowsAtCol(cellIndex, col)) {
    const key = cellKey(col, row);
    let ordering = cellOrderings.get(key);
    if (!ordering) { continue; }

    if (ordering.some(item => Array.isArray(item))) {
      const hPos = hPosMap.get(row) || new Map<number, number>();
      const newOrdering: CellOrder = [];
      for (const item of ordering) {
        if (!Array.isArray(item)) {
          newOrdering.push(item);
        } else {
          newOrdering.push(...sortAndRegroupTied(item, row, hPos, vSlot, forward));
        }
      }
      cellOrderings.set(key, newOrdering);
      writeOrderToSlots(newOrdering, edges);
      ordering = newOrdering;
    }

    recordHPositions(ordering, row, hPosMap);
  }
}

function propagateOrderingsLTR(
  cellIndex: Map<string, Seg[]>, cellOrderings: Map<string, CellOrder>,
  verticalGroups: Map<number, VSeg[]>, edges: GridEdge[],
): void {
  const allCols = new Set<number>();
  for (const [key] of cellIndex) { allCols.add(cellCol(key)); }
  for (const col of verticalGroups.keys()) { allCols.add(col); }
  const sortedCols = [...allCols].sort((a, b) => a - b);

  const prevHPos = new Map<number, Map<number, number>>();
  const prevVSlot = new Map<number, number>();

  for (const col of sortedCols) {
    resolveOrderingTies(cellIndex, cellOrderings, edges, col, prevHPos, prevVSlot, true);

    const vGroup = verticalGroups.get(col);
    if (vGroup && vGroup.length > 0) {
      const clusters = clusterOverlapping(vGroup);
      for (const cluster of clusters) {
        if (cluster.length <= 1) {
          edges[cluster[0].edgeIdx].verticalSlots[cluster[0].segIdx] = { slot: 0, count: 1 };
          prevVSlot.set(cluster[0].edgeIdx, 0);
          continue;
        }

        const joiners: VSeg[] = [];
        const continuers: VSeg[] = [];
        for (const vseg of cluster) {
          const wp = edges[vseg.edgeIdx].waypoints;
          if (vseg.segIdx > 0 && wp[vseg.segIdx - 1].col === col) { continuers.push(vseg); }
          else { joiners.push(vseg); }
        }

        joiners.sort((a, b) => compareJoiners(a, b, cellOrderings, edges));
        continuers.sort((a, b) => compareContinuers(a, b, prevVSlot));

        const ordered = [...joiners, ...continuers];
        const joinerCount = joiners.length;
        const totalCount = ordered.length;
        let slot = 0;
        for (let i = 0; i < ordered.length; i++) {
          if (i > 0) {
            const bothJoiners = i < joinerCount && i - 1 < joinerCount;
            const bothContinuers = i >= joinerCount && i - 1 >= joinerCount;
            const cmp = bothJoiners ? compareJoiners(ordered[i - 1], ordered[i], cellOrderings, edges)
              : bothContinuers ? compareContinuers(ordered[i - 1], ordered[i], prevVSlot)
              : 1;
            if (cmp !== 0) { slot = i; }
          }
          edges[ordered[i].edgeIdx].verticalSlots[ordered[i].segIdx] = { slot, count: totalCount };
          prevVSlot.set(ordered[i].edgeIdx, slot);
        }
      }
    }
  }
}

function getDestHPos(v: VSeg, edges: GridEdge[], cellOrderings: Map<string, CellOrder>): number {
  const wp = edges[v.edgeIdx].waypoints;
  const destOrd = cellOrderings.get(cellKey(wp[v.segIdx + 1].col, wp[v.segIdx + 1].row));
  if (!destOrd) { return 0; }
  return (cellOrderFindPos(destOrd, v.edgeIdx))?.pos ?? 0;
}

function propagateOrderingsRTL(
  cellIndex: Map<string, Seg[]>, cellOrderings: Map<string, CellOrder>,
  verticalGroups: Map<number, VSeg[]>, edges: GridEdge[],
): void {
  const allCols = new Set<number>();
  for (const [key] of cellIndex) { allCols.add(cellCol(key)); }
  for (const col of verticalGroups.keys()) { allCols.add(col); }
  const sortedCols = [...allCols].sort((a, b) => b - a);

  const nextHPos = new Map<number, Map<number, number>>();
  const nextVSlot = new Map<number, number>();

  for (const col of sortedCols) {
    const vGroup = verticalGroups.get(col);
    if (vGroup && vGroup.length > 0) {
      const clusters = clusterOverlapping(vGroup);
      for (const cluster of clusters) {
        if (cluster.length <= 1) {
          const v = cluster[0];
          nextVSlot.set(v.edgeIdx, edges[v.edgeIdx].verticalSlots[v.segIdx].slot);
          continue;
        }

        cluster.sort((a, b) =>
          edges[a.edgeIdx].verticalSlots[a.segIdx].slot - edges[b.edgeIdx].verticalSlots[b.segIdx].slot
        );

        const sorted: VSeg[] = [];
        let i = 0;
        while (i < cluster.length) {
          const s = edges[cluster[i].edgeIdx].verticalSlots[cluster[i].segIdx].slot;
          let j = i + 1;
          while (j < cluster.length && edges[cluster[j].edgeIdx].verticalSlots[cluster[j].segIdx].slot === s) { j++; }

          if (j - i === 1) {
            sorted.push(cluster[i]);
          } else {
            const tied = cluster.slice(i, j);
            tied.sort((a, b) => {
              const aG = a.toRow > a.fromRow ? 0 : a.toRow === a.fromRow ? 1 : 2;
              const bG = b.toRow > b.fromRow ? 0 : b.toRow === b.fromRow ? 1 : 2;
              if (aG !== bG) { return aG - bG; }
              const aH = getDestHPos(a, edges, cellOrderings);
              const bH = getDestHPos(b, edges, cellOrderings);
              if (aH === bH) { return 0; }
              if (aG === 0) { return bH - aH; }
              return aH - bH;
            });
            sorted.push(...tied);
          }
          i = j;
        }

        let vSlot = 0;
        for (let k = 0; k < sorted.length; k++) {
          if (k > 0) {
            const prev = sorted[k - 1], curr = sorted[k];
            const prevS = edges[prev.edgeIdx].verticalSlots[prev.segIdx].slot;
            const currS = edges[curr.edgeIdx].verticalSlots[curr.segIdx].slot;
            if (prevS !== currS) {
              vSlot = k;
            } else {
              const pG = prev.toRow > prev.fromRow ? 0 : prev.toRow === prev.fromRow ? 1 : 2;
              const cG = curr.toRow > curr.fromRow ? 0 : curr.toRow === curr.fromRow ? 1 : 2;
              if (pG !== cG || getDestHPos(prev, edges, cellOrderings) !== getDestHPos(curr, edges, cellOrderings)) { vSlot = k; }
            }
          }
          edges[sorted[k].edgeIdx].verticalSlots[sorted[k].segIdx] = { slot: vSlot, count: sorted.length };
          nextVSlot.set(sorted[k].edgeIdx, vSlot);
        }
      }
    }

    resolveOrderingTies(cellIndex, cellOrderings, edges, col, nextHPos, nextVSlot, false);
  }
}

function addLaneSeg(map: Map<number, LaneSeg[]>, row: number, seg: LaneSeg): void {
  let arr = map.get(row);
  if (!arr) { arr = []; map.set(row, arr); }
  arr.push(seg);
}

function assignHorizontalLanes(edges: GridEdge[], rowLaneCounts: number[]): void {
  const rowSegs = new Map<number, LaneSeg[]>();
  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei];
    const wp = e.waypoints;
    addLaneSeg(rowSegs, wp[0].row, { edgeIdx: ei, col: wp[0].col, type: 'exit', hIdx: -1, order: e.exitSlot });
    if (wp.length > 1 && wp[0].row !== wp[1].row && wp[0].col !== wp[1].col) {
      addLaneSeg(rowSegs, wp[0].row, { edgeIdx: ei, col: wp[1].col, type: 'approach', hIdx: -1, order: e.exitSlot });
    }
    addLaneSeg(rowSegs, wp[wp.length - 1].row, { edgeIdx: ei, col: wp[wp.length - 1].col, type: 'entry', hIdx: -1, order: e.entrySlot });
    if (wp.length > 1 && wp[wp.length - 1].row !== wp[wp.length - 2].row && wp[wp.length - 1].col !== wp[wp.length - 2].col) {
      addLaneSeg(rowSegs, wp[wp.length - 1].row, { edgeIdx: ei, col: wp[wp.length - 2].col, type: 'approach', hIdx: -1, order: e.entrySlot });
    }
    for (let j = 1; j < wp.length - 1; j++) {
      addLaneSeg(rowSegs, wp[j].row, { edgeIdx: ei, col: wp[j].col, type: 'h', hIdx: j - 1, order: e.horizontalSlots[j - 1].slot });
      if (wp[j].row !== wp[j - 1].row && wp[j].col !== wp[j - 1].col) {
        addLaneSeg(rowSegs, wp[j].row, { edgeIdx: ei, col: wp[j - 1].col, type: 'approach', hIdx: -1, order: e.horizontalSlots[j - 1].slot });
      }
      if (wp[j].row !== wp[j + 1].row && wp[j].col !== wp[j + 1].col) {
        addLaneSeg(rowSegs, wp[j].row, { edgeIdx: ei, col: wp[j + 1].col, type: 'approach', hIdx: -1, order: e.horizontalSlots[j - 1].slot });
      }
    }
  }

  for (const [row, segs] of rowSegs) {
    const edgeSegMap = new Map<number, LaneSeg[]>();
    for (const seg of segs) {
      let arr = edgeSegMap.get(seg.edgeIdx);
      if (!arr) { arr = []; edgeSegMap.set(seg.edgeIdx, arr); }
      arr.push(seg);
    }

    const spans: { edgeIdx: number; minCol: number; maxCol: number; colOrders: Map<number, number>; segments: LaneSeg[] }[] = [];
    for (const [edgeIdx, edgeSegments] of edgeSegMap) {
      edgeSegments.sort((a, b) => a.col - b.col);
      let start = 0;
      for (let i = 1; i <= edgeSegments.length; i++) {
        const prev = edgeSegments[i - 1];
        const curr = edgeSegments[i];
        const contiguous = curr && curr.col === prev.col + 1
          && !(prev.type === 'approach' && curr.type === 'approach');
        if (i === edgeSegments.length || !contiguous) {
          const spanSegs = edgeSegments.slice(start, i);
          const colOrders = new Map<number, number>();
          for (const s of spanSegs) { if (s.type !== 'approach') { colOrders.set(s.col, s.order); } }
          spans.push({ edgeIdx, minCol: spanSegs[0].col, maxCol: spanSegs[spanSegs.length - 1].col, colOrders, segments: spanSegs });
          start = i;
        }
      }
    }

    if (spans.length === 0) { continue; }

    const lanes = assignLanes(
      spans.map(s => ({ minPos: s.minCol, maxPos: s.maxCol })),
      (i, j) => {
        const a = spans[i], b = spans[j];
        for (let c = Math.max(a.minCol, b.minCol); c <= Math.min(a.maxCol, b.maxCol); c++) {
          const oa = a.colOrders.get(c), ob = b.colOrders.get(c);
          if (oa !== undefined && ob !== undefined) { return oa - ob; }
        }
        return 0;
      }
    );

    let minLane = Infinity, maxLane = -Infinity;
    for (const l of lanes) {
      if (l < minLane) { minLane = l; }
      if (l > maxLane) { maxLane = l; }
    }
    const count = maxLane - minLane + 1;
    if (row < rowLaneCounts.length) { rowLaneCounts[row] = count; }

    for (let si = 0; si < spans.length; si++) {
      const normLane = lanes[si];
      for (const seg of spans[si].segments) {
        if (seg.type === 'exit') {
          edges[seg.edgeIdx].exitSlot = normLane;
          edges[seg.edgeIdx].exitCount = count;
        } else if (seg.type === 'entry') {
          edges[seg.edgeIdx].entrySlot = normLane;
          edges[seg.edgeIdx].entryCount = count;
        } else if (seg.type === 'h') {
          edges[seg.edgeIdx].horizontalSlots[seg.hIdx] = { slot: normLane, count };
        }
      }
    }
  }
}

function assignVerticalLanes(edges: GridEdge[], verticalGroups: Map<number, VSeg[]>): void {
  for (const [, vSegs] of verticalGroups) {
    if (vSegs.length === 0) { continue; }

    const vLanes = assignLanes(
      vSegs.map(v => ({ minPos: v.minRow, maxPos: v.maxRow })),
      (i, j) => edges[vSegs[i].edgeIdx].verticalSlots[vSegs[i].segIdx].slot
              - edges[vSegs[j].edgeIdx].verticalSlots[vSegs[j].segIdx].slot
    );

    let vMinLane = Infinity, vMaxLane = -Infinity;
    for (const l of vLanes) {
      if (l < vMinLane) { vMinLane = l; }
      if (l > vMaxLane) { vMaxLane = l; }
    }
    const vCount = vMaxLane - vMinLane + 1;

    for (let i = 0; i < vSegs.length; i++) {
      edges[vSegs[i].edgeIdx].verticalSlots[vSegs[i].segIdx] = { slot: vLanes[i], count: vCount };
    }
  }
}

function assignSlots(edges: GridEdge[], rowLaneCounts: number[]): void {
  const { verticalGroups, cellIndex } = buildSlotIndex(edges);
  const cellOrderings = initialHorizontalOrdering(cellIndex, edges);
  propagateOrderingsLTR(cellIndex, cellOrderings, verticalGroups, edges);
  propagateOrderingsRTL(cellIndex, cellOrderings, verticalGroups, edges);
  assignHorizontalLanes(edges, rowLaneCounts);
  assignVerticalLanes(edges, verticalGroups);
}

function assignLanes(
  lines: { minPos: number; maxPos: number }[],
  compare: (i: number, j: number) => number,
): number[] {
  const n = lines.length;
  if (n === 0) { return []; }

  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const lo = Math.max(lines[i].minPos, lines[j].minPos);
      const hi = Math.min(lines[i].maxPos, lines[j].maxPos);
      if (lo >= hi) { continue; }
      const cmp = compare(i, j);
      if (cmp < 0 || (cmp === 0 && i < j)) {
        adj[i].push(j);
      } else {
        adj[j].push(i);
      }
    }
  }

  const inDeg = new Array(n).fill(0);
  for (let i = 0; i < n; i++) { for (const j of adj[i]) { inDeg[j]++; } }
  const queue: number[] = [];
  for (let i = 0; i < n; i++) { if (inDeg[i] === 0) { queue.push(i); } }
  const topo: number[] = [];
  const tmpDeg = [...inDeg];
  let qi = 0;
  while (qi < queue.length) {
    const u = queue[qi++];
    topo.push(u);
    for (const v of adj[u]) { if (--tmpDeg[v] === 0) { queue.push(v); } }
  }

  const minLane = new Array(n).fill(0);
  for (const u of topo) {
    for (const v of adj[u]) { minLane[v] = Math.max(minLane[v], minLane[u] + 1); }
  }
  const totalLanes = Math.max(...minLane) + 1;

  const distToSink = new Array(n).fill(0);
  for (let i = topo.length - 1; i >= 0; i--) {
    const u = topo[i];
    for (const v of adj[u]) { distToSink[u] = Math.max(distToSink[u], distToSink[v] + 1); }
  }

  const lane = new Array(n);
  for (let i = 0; i < n; i++) {
    lane[i] = Math.floor((minLane[i] + totalLanes - 1 - distToSink[i]) / 2);
  }
  separateOverlappingLanes(lines, lane, compare);
  return lane;
}

function separateOverlappingLanes(
  lines: { minPos: number; maxPos: number }[],
  lane: number[],
  compare: (i: number, j: number) => number,
): void {
  for (let pass = 0; pass < lines.length * lines.length; pass++) {
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const lo = Math.max(lines[i].minPos, lines[j].minPos);
        const hi = Math.min(lines[i].maxPos, lines[j].maxPos);
        if (lo >= hi || lane[i] !== lane[j]) { continue; }

        const cmp = compare(i, j);
        lane[cmp > 0 ? i : j]++;
        changed = true;
      }
    }

    if (!changed) { return; }
  }
}


function clusterOverlapping<T extends { minRow: number; maxRow: number }>(items: T[]): T[][] {
  const clusters: T[][] = [];
  const assigned = new Uint8Array(items.length);

  for (let i = 0; i < items.length; i++) {
    if (assigned[i]) { continue; }
    const cluster = [items[i]];
    assigned[i] = 1;

    let changed = true;
    while (changed) {
      changed = false;
      for (let j = 0; j < items.length; j++) {
        if (assigned[j]) { continue; }
        let overlaps = false;
        for (const member of cluster) {
          if (items[j].minRow <= member.maxRow && items[j].maxRow >= member.minRow) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) {
          cluster.push(items[j]);
          assigned[j] = 1;
          changed = true;
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function countEdgeCrossings(edges: GridEdge[]): Map<GridEdge, number> {
  const counts = new Map<GridEdge, number>();
  for (const e of edges) { counts.set(e, 0); }

  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (edgesCross(edges[i], edges[j])) {
        counts.set(edges[i], (counts.get(edges[i]) ?? 0) + 1);
        counts.set(edges[j], (counts.get(edges[j]) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function edgesCross(a: GridEdge, b: GridEdge): boolean {
  for (let i = 0; i < a.waypoints.length - 1; i++) {
    for (let j = 0; j < b.waypoints.length - 1; j++) {
      if (segmentsCross(a.waypoints[i], a.waypoints[i + 1], b.waypoints[j], b.waypoints[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

function segmentsCross(
  a1: { col: number; row: number }, a2: { col: number; row: number },
  b1: { col: number; row: number }, b2: { col: number; row: number }
): boolean {
  if (a1.col === a2.col && b1.col === b2.col) {
    if (a1.col !== b1.col) { return false; }
    const aMin = Math.min(a1.row, a2.row), aMax = Math.max(a1.row, a2.row);
    const bMin = Math.min(b1.row, b2.row), bMax = Math.max(b1.row, b2.row);
    return aMin < bMax && bMin < aMax;
  }

  if (a1.col === a2.col || b1.col === b2.col) { return false; }

  const aMinCol = Math.min(a1.col, a2.col), aMaxCol = Math.max(a1.col, a2.col);
  const bMinCol = Math.min(b1.col, b2.col), bMaxCol = Math.max(b1.col, b2.col);
  const overlapStart = Math.max(aMinCol, bMinCol);
  const overlapEnd = Math.min(aMaxCol, bMaxCol);
  if (overlapStart >= overlapEnd) { return false; }

  const aRowAtStart = a1.row + (a2.row - a1.row) * (overlapStart - a1.col) / (a2.col - a1.col);
  const aRowAtEnd = a1.row + (a2.row - a1.row) * (overlapEnd - a1.col) / (a2.col - a1.col);
  const bRowAtStart = b1.row + (b2.row - b1.row) * (overlapStart - b1.col) / (b2.col - b1.col);
  const bRowAtEnd = b1.row + (b2.row - b1.row) * (overlapEnd - b1.col) / (b2.col - b1.col);

  return (aRowAtStart - bRowAtStart) * (aRowAtEnd - bRowAtEnd) < 0;
}

function optimizeCrossings(edges: GridEdge[], nodes: GridNode[], maxRow: number): void {
  const nodeAt = new Map<string, number>();
  for (const nd of nodes) { nodeAt.set(cellKey(nd.col, nd.row), nd.index); }

  for (let iteration = 0; iteration < 5; iteration++) {
    const counts = countEdgeCrossings(edges);
    const crossingEdges = edges.filter(e => (counts.get(e) ?? 0) > 0);
    if (crossingEdges.length === 0) { break; }

    crossingEdges.sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    let improved = false;

    for (const edge of crossingEdges) {
      const pNode = nodes[edge.parent];
      const cNode = nodes[edge.child];
      if (cNode.col - pNode.col <= 1) { continue; }

      const currentCrossings = countSingleEdgeCrossings(edge, edges);
      if (currentCrossings === 0) { continue; }

      const originalWaypoints = edge.waypoints.map(w => ({ ...w }));
      let bestWaypoints = originalWaypoints;
      let bestCrossings = currentCrossings;

      const offsets = [1, -1, 2, -2];
      for (const offset of offsets) {
        const alt = computeAlternativeWaypoints(pNode, cNode, nodeAt, maxRow, offset);
        edge.waypoints = alt;
        const altCrossings = countSingleEdgeCrossings(edge, edges);
        if (altCrossings < bestCrossings) {
          bestWaypoints = alt;
          bestCrossings = altCrossings;
        }
      }

      edge.waypoints = bestCrossings < currentCrossings ? bestWaypoints : originalWaypoints;
      if (bestCrossings < currentCrossings) { improved = true; }
    }

    if (!improved) { break; }
  }
}

function computeAlternativeWaypoints(
  pNode: GridNode, cNode: GridNode,
  nodeAt: Map<string, number>,
  maxRow: number, offset: number
): { col: number; row: number }[] {
  const waypoints: { col: number; row: number }[] = [{ col: pNode.col, row: pNode.row }];

  const lo = -1;
  const hi = maxRow + 1;
  for (let c = pNode.col + 1; c < cNode.col; c++) {
    const frac = (c - pNode.col) / (cNode.col - pNode.col);
    const idealRow = pNode.row + frac * (cNode.row - pNode.row);
    const targetRow = Math.max(lo, Math.min(hi, Math.round(idealRow) + offset));

    waypoints.push({
      col: c,
      row: selectOpenWaypointRow(c, targetRow, idealRow, nodeAt, lo, hi),
    });
  }

  waypoints.push({ col: cNode.col, row: cNode.row });
  return waypoints;
}

function countSingleEdgeCrossings(edge: GridEdge, allEdges: GridEdge[]): number {
  let count = 0;
  for (const other of allEdges) {
    if (other !== edge && edgesCross(edge, other)) { count++; }
  }
  return count;
}

function computeChunkRegions(nodes: GridNode[], chunks: ChunkInput[]): ChunkRegion[] {
  const regions: ChunkRegion[] = [];

  for (let ci = 0; ci < chunks.length; ci++) {
    if (chunks[ci].txs.length <= 1) {
      const cells = new Set<string>();
      if (chunks[ci].txs.length === 1) {
        const nd = nodes[chunks[ci].txs[0]];
        cells.add(cellKey(nd.col, nd.row));
      }
      regions.push({ chunkIndex: ci, cells, bridges: new Set() });
      continue;
    }

    const memberSet = new Set(chunks[ci].txs);
    const memberNodes = chunks[ci].txs.map(ti => nodes[ti]);

    let minCol = Infinity, maxC = -Infinity, minRow = Infinity, maxR = -Infinity;
    for (const nd of memberNodes) {
      minCol = Math.min(minCol, nd.col);
      maxC = Math.max(maxC, nd.col);
      minRow = Math.min(minRow, nd.row);
      maxR = Math.max(maxR, nd.row);
    }

    const nodeAtCell = new Map<string, number>();
    for (const nd of nodes) {
      if (nd.col >= minCol && nd.col <= maxC && nd.row >= minRow && nd.row <= maxR) {
        nodeAtCell.set(cellKey(nd.col, nd.row), nd.index);
      }
    }

    const cells = new Set<string>();
    for (let c = minCol; c <= maxC; c++) {
      for (let r = minRow; r <= maxR; r++) {
        const key = cellKey(c, r);
        const occupant = nodeAtCell.get(key);
        if (occupant === undefined || memberSet.has(occupant)) {
          cells.add(key);
        }
      }
    }

    const blocked = new Set<string>();
    for (const [key, idx] of nodeAtCell) {
      if (!memberSet.has(idx)) { blocked.add(key); }
    }

    const bridges = new Set<string>();
    connectDisconnectedRegions(cells, bridges, blocked);
    trimTabs(cells, memberNodes);

    regions.push({ chunkIndex: ci, cells, bridges });
  }

  return regions;
}

function connectDisconnectedRegions(cells: Set<string>, bridges: Set<string>, blocked: Set<string>): void {
  const components = findConnectedComponents(cells);
  if (components.length <= 1) { return; }

  const mainComponent = components.reduce((a, b) => a.size > b.size ? a : b);
  for (const component of components) {
    if (component === mainComponent) { continue; }

    let bestDist = Infinity, bestFrom = '', bestTo = '';
    for (const from of component) {
      for (const to of mainComponent) {
        const fc = cellCol(from), fr = cellRow(from);
        const tc = cellCol(to), tr = cellRow(to);
        const dist = Math.abs(fc - tc) + Math.abs(fr - tr);
        if (dist < bestDist) { bestDist = dist; bestFrom = from; bestTo = to; }
      }
    }

    const prev = new Map<string, string>();
    const queue = [bestFrom];
    prev.set(bestFrom, '');
    let found = false;

    for (let qi = 0; qi < queue.length && !found; qi++) {
      const key = queue[qi];
      const c = cellCol(key), r = cellRow(key);
      for (const [nc, nr] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
        const nk = cellKey(nc, nr);
        if (prev.has(nk)) { continue; }
        if (blocked.has(nk)) { continue; }
        prev.set(nk, key);
        queue.push(nk);
        if (nk === bestTo) { found = true; break; }
      }
    }

    if (found) {
      let cur = bestTo;
      while (cur !== bestFrom) {
        const p = prev.get(cur);
        if (p === undefined) { break; }
        if (!cells.has(cur)) { cells.add(cur); }
        const cc = cellCol(cur), cr = cellRow(cur);
        const pc = cellCol(p), pr = cellRow(p);
        if (pc < cc) { bridges.add(`${pc}:${pr}:right`); }
        else if (pc > cc) { bridges.add(`${pc}:${pr}:left`); }
        else if (pr < cr) { bridges.add(`${pc}:${pr}:bottom`); }
        else { bridges.add(`${pc}:${pr}:top`); }
        cur = p;
      }
    }

    for (const cell of component) { mainComponent.add(cell); }
  }
}

function findConnectedComponents(cells: Set<string>): Set<string>[] {
  const visited = new Set<string>();
  const components: Set<string>[] = [];

  for (const cell of cells) {
    if (visited.has(cell)) { continue; }
    const component = new Set<string>();
    const queue = [cell];
    visited.add(cell);

    let qi = 0;
    while (qi < queue.length) {
      const current = queue[qi++];
      component.add(current);
      const c = cellCol(current), r = cellRow(current);

      for (const [nc, nr] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
        const key = cellKey(nc, nr);
        if (cells.has(key) && !visited.has(key)) {
          visited.add(key);
          queue.push(key);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function trimTabs(cells: Set<string>, memberNodes: GridNode[]): void {
  const memberCells = new Set(memberNodes.map(nd => cellKey(nd.col, nd.row)));

  for (let pass = 0; pass < 10; pass++) {
    let changed = false;

    for (const cell of [...cells]) {
      if (memberCells.has(cell)) { continue; }
      const c = cellCol(cell), r = cellRow(cell);
      let connectedSides = 0;
      for (const [nc, nr] of [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]]) {
        if (cells.has(cellKey(nc, nr))) { connectedSides++; }
      }
      if (connectedSides <= 1) {
        cells.delete(cell);
        changed = true;
      }
    }

    if (!changed) { break; }
  }
}
