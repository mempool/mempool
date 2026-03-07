import { GridLayout, GridNode, GridEdge, ChunkRegion, cellKey, cellCol, cellRow } from './cluster-layout';

export interface RenderedNode {
  index: number;
  tx: { txid: string; fee: number; weight: number };
  x: number;
  y: number;
  rectX: number;
  rectY: number;
  color: string;
  chunkIndex: number;
  feerate: number;
  inactive: boolean;
  isCurrent: boolean;
  hovered: boolean;
  related: boolean;
}

export interface RenderedEdge {
  parentIndex: number;
  childIndex: number;
  path: string;
  gradientId: string;
  markerId: string;
  parentColor: string;
  childColor: string;
  parentInactive: boolean;
  childInactive: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  highlighted: boolean;
}

export interface RenderedChunkOutline {
  chunkIndex: number;
  path: string;
  feerate: number;
  labelX: number;
  labelY: number;
}

export interface RenderParams {
  containerWidth: number;
  activeChunkIndex: number;
  currentTxid: string;
  txFees: number[];
  txWeights: number[];
  txids: string[];
  chunkFeerates: number[];
  getColor: (feerate: number) => string;
}

interface RenderResult {
  nodes: RenderedNode[];
  edges: RenderedEdge[];
  chunkOutlines: RenderedChunkOutline[];
  svgWidth: number;
  svgHeight: number;
}

interface GridGeometry {
  colLeftX: number[];
  rowTopY: number[];
  rowHeights: number[];
  gutterWidths: number[];
  cellW: number;
  totalCols: number;
  totalRows: number;
}

export const NODE_W = 64;
export const NODE_H = 30;
const MIN_CELL_W = 80;
const MAX_CELL_W = 120;
const CELL_PAD_Y = 16;
const MARGIN_X = 20;
const MARGIN_Y = 30;
const LANE_SPACING = 6;
const MIN_GUTTER_W = 3 * LANE_SPACING;
const MIN_GUTTER_H = 3 * LANE_SPACING;
const OUTLINE_PAD = 6;

export function renderLayout(layout: GridLayout, params: RenderParams): RenderResult {
  if (layout.nodes.length === 0) {
    return { nodes: [], edges: [], chunkOutlines: [], svgWidth: 0, svgHeight: 0 };
  }

  const cellH = NODE_H + CELL_PAD_Y;

  const rowHeights: number[] = [];
  for (let r = 0; r < layout.rows; r++) {
    const laneCount = (layout.rowLaneCounts && layout.rowLaneCounts[r]) || 0;
    if (r % 2 === 0) {
      rowHeights.push(Math.max(cellH, (laneCount + 1) * LANE_SPACING));
    } else {
      rowHeights.push(Math.max(MIN_GUTTER_H, (laneCount + 1) * LANE_SPACING));
    }
  }

  const rowTopY: number[] = [MARGIN_Y];
  for (let r = 1; r < layout.rows; r++) {
    rowTopY.push(rowTopY[r - 1] + rowHeights[r - 1]);
  }

  const gutterWidths: number[] = [];
  for (let c = 0; c < layout.cols - 1; c++) {
    const laneCount = (layout.colLaneCounts && layout.colLaneCounts[c]) || 0;
    gutterWidths.push(Math.max(MIN_GUTTER_W, (laneCount + 1) * LANE_SPACING));
  }
  const totalGutterW = gutterWidths.reduce((a, b) => a + b, 0);

  const fixedWidth = MARGIN_X * 2 + totalGutterW;
  const cellW = layout.cols > 0
    ? Math.max(MIN_CELL_W, Math.min(MAX_CELL_W, (params.containerWidth - fixedWidth) / layout.cols))
    : MIN_CELL_W;

  const colLeftX: number[] = [MARGIN_X];
  for (let c = 1; c < layout.cols; c++) {
    colLeftX.push(colLeftX[c - 1] + cellW + gutterWidths[c - 1]);
  }

  const geo: GridGeometry = {
    colLeftX, rowTopY, rowHeights, gutterWidths, cellW,
    totalCols: layout.cols, totalRows: layout.rows,
  };

  const nodes = renderNodes(layout.nodes, params, geo);
  const edges = renderEdges(layout.edges, nodes, geo);
  const chunkOutlines = renderChunkOutlines(layout.chunks, params, geo);

  const svgWidth = MARGIN_X * 2 + layout.cols * cellW + totalGutterW;
  const svgHeight = rowTopY[layout.rows - 1] + rowHeights[layout.rows - 1] + MARGIN_Y;

  return { nodes, edges, chunkOutlines, svgWidth, svgHeight };
}

function geoCellX(geo: GridGeometry, col: number): number {
  return geo.colLeftX[col] + geo.cellW / 2;
}

function geoCellY(geo: GridGeometry, row: number): number {
  if (row < 0 || row >= geo.totalRows) { return MARGIN_Y; }
  return geo.rowTopY[row] + geo.rowHeights[row] / 2;
}

function geoGutterCenterX(geo: GridGeometry, col: number): number {
  return geo.colLeftX[col] + geo.cellW + geo.gutterWidths[col] / 2;
}

function geoCellLeft(geo: GridGeometry, col: number): number {
  return geo.colLeftX[col];
}

function geoCellTop(geo: GridGeometry, row: number): number {
  if (row < 0 || row >= geo.totalRows) { return MARGIN_Y; }
  return geo.rowTopY[row];
}

function geoCellRight(geo: GridGeometry, col: number): number {
  return geo.colLeftX[col] + geo.cellW;
}

function geoCellBottom(geo: GridGeometry, row: number): number {
  if (row < 0 || row >= geo.totalRows) { return MARGIN_Y; }
  return geo.rowTopY[row] + geo.rowHeights[row];
}

function borderX(geo: GridGeometry, b: number): number {
  if (b <= 0) { return geoCellLeft(geo, 0) - OUTLINE_PAD; }
  if (b >= geo.totalCols) { return geoCellRight(geo, geo.totalCols - 1) + OUTLINE_PAD; }
  return (geoCellRight(geo, b - 1) + geoCellLeft(geo, b)) / 2;
}

function borderY(geo: GridGeometry, b: number): number {
  if (b <= 0) { return geoCellTop(geo, 0) - OUTLINE_PAD; }
  if (b >= geo.totalRows) { return geoCellBottom(geo, geo.totalRows - 1) + OUTLINE_PAD; }
  return (geoCellBottom(geo, b - 1) + geoCellTop(geo, b)) / 2;
}

function renderNodes(gridNodes: GridNode[], params: RenderParams, geo: GridGeometry): RenderedNode[] {
  return gridNodes.map(gn => {
    const x = geoCellX(geo, gn.col);
    const y = geoCellY(geo, gn.row);
    const feerate = params.txFees[gn.index] / (params.txWeights[gn.index] / 4);
    const color = params.getColor(feerate);
    const inactive = gn.chunkIndex !== params.activeChunkIndex;

    return {
      index: gn.index,
      tx: {
        txid: params.txids[gn.index],
        fee: params.txFees[gn.index],
        weight: params.txWeights[gn.index],
      },
      x, y,
      rectX: x - NODE_W / 2,
      rectY: y - NODE_H / 2,
      color,
      chunkIndex: gn.chunkIndex,
      feerate,
      inactive,
      isCurrent: params.txids[gn.index] === params.currentTxid,
      hovered: false,
      related: false,
    };
  });
}

interface FanInfo {
  nodeEdgeOffset: number;
  fanDist: number;
}

function computeFanInfos(
  gridEdges: GridEdge[],
  side: 'exit' | 'entry',
): (FanInfo | undefined)[] {
  const nodeHalfH = NODE_H / 2;
  const nodeKey = side === 'exit' ? 'parent' : 'child';

  const groups = new Map<number, number[]>();
  for (let i = 0; i < gridEdges.length; i++) {
    const nodeIdx = gridEdges[i][nodeKey];
    let group = groups.get(nodeIdx);
    if (!group) { group = []; groups.set(nodeIdx, group); }
    group.push(i);
  }

  const fanInfos: (FanInfo | undefined)[] = new Array(gridEdges.length);

  for (const [, edgeIndices] of groups) {
    edgeIndices.sort((a, b) => {
      const sa = side === 'exit' ? gridEdges[a].exitSlot : gridEdges[a].entrySlot;
      const sb = side === 'exit' ? gridEdges[b].exitSlot : gridEdges[b].entrySlot;
      return sa - sb;
    });

    let anyNeedsFan = false;
    for (const ei of edgeIndices) {
      const slot = side === 'exit' ? gridEdges[ei].exitSlot : gridEdges[ei].entrySlot;
      const count = side === 'exit' ? gridEdges[ei].exitCount : gridEdges[ei].entryCount;
      if (Math.abs(slotToOffset(slot, count)) > nodeHalfH) {
        anyNeedsFan = true;
        break;
      }
    }

    if (!anyNeedsFan) { continue; }

    const nodeCount = edgeIndices.length;
    const edgeSpacing = (NODE_H - 2) / Math.max(1, nodeCount - 1);

    let maxDy = 0;
    const nodeEdgeOffsets: number[] = [];
    for (let k = 0; k < edgeIndices.length; k++) {
      const slot = side === 'exit' ? gridEdges[edgeIndices[k]].exitSlot : gridEdges[edgeIndices[k]].entrySlot;
      const count = side === 'exit' ? gridEdges[edgeIndices[k]].exitCount : gridEdges[edgeIndices[k]].entryCount;
      const laneOffset = slotToOffset(slot, count);
      const nodeEdgeOffset = (k - (nodeCount - 1) / 2) * edgeSpacing;
      nodeEdgeOffsets.push(nodeEdgeOffset);
      maxDy = Math.max(maxDy, Math.abs(laneOffset - nodeEdgeOffset));
    }

    const fanDist = Math.min(20, Math.max(10, maxDy * 1.5));

    for (let k = 0; k < edgeIndices.length; k++) {
      fanInfos[edgeIndices[k]] = { nodeEdgeOffset: nodeEdgeOffsets[k], fanDist };
    }
  }

  return fanInfos;
}

function renderEdges(
  gridEdges: GridEdge[], renderedNodes: RenderedNode[], geo: GridGeometry,
): RenderedEdge[] {
  const exitFanInfos = computeFanInfos(gridEdges, 'exit');
  const entryFanInfos = computeFanInfos(gridEdges, 'entry');

  return gridEdges.map((ge, idx) => {
    const pNode = renderedNodes[ge.parent];
    const cNode = renderedNodes[ge.child];

    const points = waypointsToPixels(ge, geo, exitFanInfos[idx], entryFanInfos[idx]);
    const path = buildEdgePath(points);

    const first = points[0];
    const last = points[points.length - 1];

    return {
      parentIndex: ge.parent,
      childIndex: ge.child,
      path,
      gradientId: `edge-grad-${idx}`,
      markerId: `edge-arrow-${idx}`,
      parentColor: pNode.color,
      childColor: cNode.color,
      parentInactive: pNode.inactive,
      childInactive: cNode.inactive,
      x1: first.x, y1: first.y,
      x2: last.x, y2: last.y,
      highlighted: false,
    };
  });
}

interface PathPoint {
  x: number;
  y: number;
  sigmoid?: boolean;
}

function waypointsToPixels(
  edge: GridEdge, geo: GridGeometry,
  exitFan?: FanInfo, entryFan?: FanInfo,
): PathPoint[] {
  const wp = edge.waypoints;
  if (wp.length < 2) { return []; }

  const exitOffset = slotToOffset(edge.exitSlot, edge.exitCount);
  const entryOffset = slotToOffset(edge.entrySlot, edge.entryCount);
  const points: PathPoint[] = [];

  const startNodeX = geoCellX(geo, wp[0].col) + NODE_W / 2;
  const cy0 = geoCellY(geo, wp[0].row);

  if (exitFan) {
    points.push({ x: startNodeX, y: cy0 + exitFan.nodeEdgeOffset });
    points.push({ x: startNodeX + exitFan.fanDist, y: cy0 + exitOffset, sigmoid: true });
  } else {
    points.push({ x: startNodeX, y: cy0 + exitOffset });
  }

  let curY = cy0 + exitOffset;
  for (let i = 0; i < wp.length - 1; i++) {
    const vInfo = edge.verticalSlots[i];
    const gx = geoGutterCenterX(geo, wp[i].col) + slotToOffset(vInfo.slot, vInfo.count);
    const isLast = i === wp.length - 2;

    let nextY: number;
    if (isLast) {
      nextY = geoCellY(geo, wp[i + 1].row) + entryOffset;
    } else {
      const hInfo = edge.horizontalSlots[i];
      nextY = geoCellY(geo, wp[i + 1].row) + slotToOffset(hInfo.slot, hInfo.count);
    }

    if (points[points.length - 1].x !== gx) {
      points.push({ x: gx, y: curY });
    }

    if (curY !== nextY) {
      points.push({ x: gx, y: nextY });
      curY = nextY;
    }

    if (!isLast) {
      const nextVInfo = edge.verticalSlots[i + 1];
      const nextGx = geoGutterCenterX(geo, wp[i + 1].col) + slotToOffset(nextVInfo.slot, nextVInfo.count);
      points.push({ x: nextGx, y: curY });
    }
  }

  const endNodeX = geoCellX(geo, wp[wp.length - 1].col) - NODE_W / 2;
  const cyLast = geoCellY(geo, wp[wp.length - 1].row);

  if (entryFan) {
    points.push({ x: endNodeX - entryFan.fanDist, y: curY });
    points.push({ x: endNodeX, y: cyLast + entryFan.nodeEdgeOffset, sigmoid: true });
  } else {
    points.push({ x: endNodeX, y: curY });
  }

  return points;
}

function slotToOffset(slot: number, count: number): number {
  if (count <= 1) { return 0; }
  return (slot - (count - 1) / 2) * LANE_SPACING;
}

function buildEdgePath(points: PathPoint[]): string {
  if (points.length === 0) { return ''; }
  const parts = [`M ${points[0].x} ${points[0].y}`];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    if (curr.sigmoid) {
      const mx = (prev.x + curr.x) / 2;
      parts.push(`C ${mx} ${prev.y} ${mx} ${curr.y} ${curr.x} ${curr.y}`);
      continue;
    }

    if (next && next.sigmoid) {
      parts.push(`L ${curr.x} ${curr.y}`);
    } else if (next && isCorner(prev, curr, next)) {
      const segLen1 = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
      const segLen2 = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y);
      const r = Math.min(5, segLen1 / 2, segLen2 / 2);

      const dx1 = Math.sign(curr.x - prev.x);
      const dy1 = Math.sign(curr.y - prev.y);
      const dx2 = Math.sign(next.x - curr.x);
      const dy2 = Math.sign(next.y - curr.y);

      parts.push(`L ${curr.x - dx1 * r} ${curr.y - dy1 * r}`);
      parts.push(`Q ${curr.x} ${curr.y} ${curr.x + dx2 * r} ${curr.y + dy2 * r}`);
    } else {
      parts.push(`L ${curr.x} ${curr.y}`);
    }
  }

  return parts.join(' ');
}

function isCorner(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): boolean {
  const dx1 = Math.sign(b.x - a.x);
  const dy1 = Math.sign(b.y - a.y);
  const dx2 = Math.sign(c.x - b.x);
  const dy2 = Math.sign(c.y - b.y);
  return dx1 !== dx2 || dy1 !== dy2;
}

function renderChunkOutlines(
  chunks: ChunkRegion[], params: RenderParams, geo: GridGeometry,
): RenderedChunkOutline[] {
  return chunks.filter(ch => ch.cells.size > 1).map(ch => {
    const segments = collectBoundarySegments(ch, geo);
    const loops = connectSegments(segments);
    const path = loops.map(loop => loopToPath(loop, 4)).join(' ');

    let labelX = Infinity, labelY = Infinity;
    for (const cell of ch.cells) {
      const c = cellCol(cell), r = cellRow(cell);
      const cx = (geoCellLeft(geo, c) + geoCellRight(geo, c)) / 2;
      const ty = borderY(geo, r);
      if (ty < labelY || (ty === labelY && cx < labelX)) {
        labelX = cx;
        labelY = ty - 4;
      }
    }

    return {
      chunkIndex: ch.chunkIndex,
      path,
      feerate: params.chunkFeerates[ch.chunkIndex],
      labelX,
      labelY,
    };
  });
}

interface Segment {
  x1: number; y1: number;
  x2: number; y2: number;
}

function collectBoundarySegments(chunk: ChunkRegion, geo: GridGeometry): Segment[] {
  const segments: Segment[] = [];

  for (const cell of chunk.cells) {
    const c = cellCol(cell), r = cellRow(cell);
    const left = borderX(geo, c);
    const right = borderX(geo, c + 1);
    const top = borderY(geo, r);
    const bottom = borderY(geo, r + 1);

    const hasAbove = chunk.cells.has(cellKey(c, r - 1));
    const hasBelow = chunk.cells.has(cellKey(c, r + 1));
    const hasLeft = chunk.cells.has(cellKey(c - 1, r));
    const hasRight = chunk.cells.has(cellKey(c + 1, r));

    if (!hasAbove) { segments.push({ x1: left, y1: top, x2: right, y2: top }); }
    if (!hasBelow) { segments.push({ x1: right, y1: bottom, x2: left, y2: bottom }); }
    if (!hasLeft) { segments.push({ x1: left, y1: bottom, x2: left, y2: top }); }
    if (!hasRight) { segments.push({ x1: right, y1: top, x2: right, y2: bottom }); }
  }

  return segments;
}

function endpointKey(x: number, y: number): string {
  return `${Math.round(x)}:${Math.round(y)}`;
}

function connectSegments(segments: Segment[]): { x: number; y: number }[][] {
  if (segments.length === 0) { return []; }

  const endpointMap = new Map<string, number[]>();
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const k1 = endpointKey(s.x1, s.y1);
    const k2 = endpointKey(s.x2, s.y2);
    let arr1 = endpointMap.get(k1);
    if (!arr1) { arr1 = []; endpointMap.set(k1, arr1); }
    arr1.push(i);
    let arr2 = endpointMap.get(k2);
    if (!arr2) { arr2 = []; endpointMap.set(k2, arr2); }
    arr2.push(i);
  }

  const loops: { x: number; y: number }[][] = [];
  const used = new Uint8Array(segments.length);

  for (let start = 0; start < segments.length; start++) {
    if (used[start]) { continue; }
    used[start] = 1;

    const loop: { x: number; y: number }[] = [
      { x: segments[start].x1, y: segments[start].y1 },
      { x: segments[start].x2, y: segments[start].y2 },
    ];

    for (let safety = 0; safety < segments.length * 2; safety++) {
      const tail = loop[loop.length - 1];
      const head = loop[0];
      const eps = 0.5;

      if (loop.length > 2 && Math.abs(tail.x - head.x) < eps && Math.abs(tail.y - head.y) < eps) {
        loop.pop();
        break;
      }

      const candidates = endpointMap.get(endpointKey(tail.x, tail.y));
      let found = false;
      if (candidates) {
        for (const i of candidates) {
          if (used[i]) { continue; }
          const s = segments[i];
          if (Math.abs(s.x1 - tail.x) < eps && Math.abs(s.y1 - tail.y) < eps) {
            used[i] = 1;
            loop.push({ x: s.x2, y: s.y2 });
            found = true;
            break;
          }
          if (Math.abs(s.x2 - tail.x) < eps && Math.abs(s.y2 - tail.y) < eps) {
            used[i] = 1;
            loop.push({ x: s.x1, y: s.y1 });
            found = true;
            break;
          }
        }
      }

      if (!found) { break; }
    }

    if (loop.length >= 3) {
      loops.push(filterCollinear(loop));
    }
  }

  return loops;
}

function filterCollinear(points: { x: number; y: number }[]): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const dx1 = Math.sign(curr.x - prev.x);
    const dy1 = Math.sign(curr.y - prev.y);
    const dx2 = Math.sign(next.x - curr.x);
    const dy2 = Math.sign(next.y - curr.y);

    if (dx1 !== dx2 || dy1 !== dy2) {
      result.push(curr);
    }
  }

  return result.length >= 3 ? result : points;
}

function loopToPath(points: { x: number; y: number }[], radius: number): string {
  const n = points.length;
  if (n < 3) { return ''; }

  const parts: string[] = [];
  const firstCorner = computeCornerEntry(points, 0, radius);
  parts.push(`M ${firstCorner.x} ${firstCorner.y}`);

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const exit = computeCornerExit(points, i, radius);
    const entry = computeCornerEntry(points, next, radius);

    if (i > 0 || !pointsEqual(firstCorner, exit)) {
      parts.push(`L ${exit.x} ${exit.y}`);
    }

    const curr = points[next];
    parts.push(`Q ${curr.x} ${curr.y} ${entry.x} ${entry.y}`);
  }

  parts.push('Z');
  return parts.join(' ');
}

function computeCornerEntry(
  points: { x: number; y: number }[], idx: number, radius: number,
): { x: number; y: number } {
  const n = points.length;
  const prev = points[(idx - 1 + n) % n];
  const curr = points[idx];
  const dist = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
  const r = Math.min(radius, dist / 2);
  const dx = Math.sign(curr.x - prev.x);
  const dy = Math.sign(curr.y - prev.y);
  return { x: curr.x - dx * r, y: curr.y - dy * r };
}

function computeCornerExit(
  points: { x: number; y: number }[], idx: number, radius: number,
): { x: number; y: number } {
  const n = points.length;
  const curr = points[idx];
  const next = points[(idx + 1) % n];
  const dist = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y);
  const r = Math.min(radius, dist / 2);
  const dx = Math.sign(next.x - curr.x);
  const dy = Math.sign(next.y - curr.y);
  return { x: curr.x + dx * r, y: curr.y + dy * r };
}

function pointsEqual(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}
