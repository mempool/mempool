import { CanvasRenderingContext2D } from 'canvas';
import { Rect } from '../components';
import { IEsploraApi } from '../../api/esplora-api.interface';

interface Xput {
  type: 'input' | 'output' | 'fee';
  value?: number;
  index?: number;
  rest?: number;
}

interface LineParams {
  weight: number;
  thickness: number;
  offset: number;
  innerY: number;
  outerY: number;
}

const gradientColors = {
  default: ['#9339f4', '#105fb0'],
  liquid: ['#09a197', '#0f62af'],
  liquidtestnet: ['#d2d2d2', '#979797'],
  testnet: ['#4edf77', '#10a0af'],
  testnet4: ['#4edf77', '#10a0af'],
  signet: ['#d24fc8', '#a84fd2'],
};

export function renderTxBowtie(
  ctx: CanvasRenderingContext2D,
  tx: IEsploraApi.Transaction,
  bounds: Rect,
  theme: string
): void {
  const width = bounds.w;
  const height = bounds.h;
  const lineLimit = 250;
  const maxCombinedWeight = 100;
  const minWeight = 2;
  const maxStrands = 24;

  const midWidth = Math.min(10, Math.ceil(width / 100));
  const txWidth = width - 20;
  const combinedWeight = Math.min(maxCombinedWeight, Math.floor((txWidth - (2 * midWidth)) / 6));
  const zeroValueWidth = Math.max(20, Math.min((txWidth / 2) - midWidth - 110, 60));
  const zeroValueThickness = 20;

  const totalValue = calcTotalValue(tx);

  let voutWithFee: Xput[] = tx.vout.map((v, i) => ({
    type: v.scriptpubkey_type === 'fee' ? 'fee' : 'output',
    value: v.value,
    index: i,
  }));

  if (tx.fee) {
    voutWithFee.unshift({ type: 'fee', value: tx.fee });
  }

  let truncatedInputs: Xput[] = tx.vin.map((v, i) => ({
    type: 'input',
    value: v?.is_coinbase && !totalValue ? 0 : v?.prevout?.value,
    index: i,
  }));

  if (truncatedInputs.length > lineLimit) {
    const valueOfRest = truncatedInputs.slice(lineLimit).reduce((r, v) => r + (v.value || 0), 0) || 0;
    truncatedInputs = truncatedInputs.slice(0, lineLimit);
    truncatedInputs.push({ type: 'input', value: valueOfRest, rest: tx.vin.length - lineLimit });
  }
  if (voutWithFee.length > lineLimit) {
    const valueOfRest = voutWithFee.slice(lineLimit).reduce((r, v) => r + (v.value || 0), 0) || 0;
    voutWithFee = voutWithFee.slice(0, lineLimit);
    voutWithFee.push({ type: 'output', value: valueOfRest, rest: voutWithFee.length - lineLimit });
  }

  const inputLines = initLines(truncatedInputs, totalValue, combinedWeight, minWeight, maxStrands, zeroValueThickness, height);
  const outputLines = initLines(voutWithFee, totalValue, combinedWeight, minWeight, maxStrands, zeroValueThickness, height);

  ctx.save();
  ctx.translate(bounds.x, bounds.y);

  const outerColor = gradientColors[theme]?.[0] || gradientColors.default[0];
  const innerColor = gradientColors[theme]?.[1] || gradientColors.default[1];

  inputLines.forEach((line) => {
    if (line.zeroValue) {
      drawZeroValuePath(ctx, 'in', line.outerY, zeroValueWidth, zeroValueThickness, width, outerColor);
    } else {
      const connectorWidth = 10;
      const markerWidth = Math.max(line.thickness / 2, 8);
      const lineStart = connectorWidth + markerWidth;
      const lineEnd = width / 2 - midWidth;
      const inputGradient = ctx.createLinearGradient(lineStart, 0, lineEnd, 0);
      inputGradient.addColorStop(0, outerColor);
      inputGradient.addColorStop(1, innerColor);

      drawPath(ctx, 'in', line.outerY || 0, line.innerY || 0, line.thickness, line.offset || 0, line.pad || 0, width, midWidth, inputGradient);
      drawMarker(ctx, 'in', line.outerY || 0, line.thickness, width, outerColor);
    }
  });

  outputLines.forEach((line, index) => {
    if (line.zeroValue) {
      drawZeroValuePath(ctx, 'out', line.outerY, zeroValueWidth, zeroValueThickness, width, outerColor);
    } else {
      const connectorWidth = 10;
      const markerWidth = Math.max(line.thickness / 2, 8);
      const lineStart = width / 2 + midWidth;
      const lineEnd = width - connectorWidth - markerWidth;
      const outputGradient = ctx.createLinearGradient(lineStart, 0, lineEnd, 0);

      const isFee = voutWithFee[index]?.type === 'fee';
      outputGradient.addColorStop(0, innerColor);
      outputGradient.addColorStop(1, isFee ? '#181b2d' : outerColor);

      drawPath(ctx, 'out', line.outerY || 0, line.innerY || 0, line.thickness, line.offset || 0, line.pad || 0, width, midWidth, outputGradient);
      if (!isFee) {
        drawMarker(ctx, 'out', line.outerY || 0, line.thickness, width, outerColor);
      }
    }
  });

  ctx.strokeStyle = innerColor;
  ctx.lineWidth = combinedWeight + 0.5;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo((width / 2) - midWidth, (height / 2) + 0.25);
  ctx.lineTo((width / 2) + midWidth, (height / 2) + 0.25);
  ctx.stroke();

  ctx.restore();
}

function calcTotalValue(tx: IEsploraApi.Transaction): number {
  const totalOutput = tx.vout.reduce((acc, v) => (v.value || 0) + acc, 0);
  return tx.fee ? totalOutput + tx.fee : totalOutput;
}

function initLines(
  xputs: Xput[],
  total: number,
  combinedWeight: number,
  minWeight: number,
  maxVisibleStrands: number,
  zeroValueThickness: number,
  height: number
): Array<LineParams & { zeroValue?: boolean; pad?: number }> {
  if (!total) {
    const weights = xputs.map(() => combinedWeight / xputs.length);
    return linesFromWeights(xputs, weights, combinedWeight, minWeight, maxVisibleStrands, zeroValueThickness, height);
  } else {
    let unknownCount = 0;
    let unknownTotal = total;
    xputs.forEach(put => {
      if (put.value == null) {
        unknownCount++;
      } else {
        unknownTotal -= put.value;
      }
    });
    const unknownShare = unknownTotal / unknownCount;
    const weights = xputs.map((put) => combinedWeight * (put.value == null ? unknownShare : put.value) / total);
    return linesFromWeights(xputs, weights, combinedWeight, minWeight, maxVisibleStrands, zeroValueThickness, height);
  }
}

function linesFromWeights(
  xputs: Xput[],
  weights: number[],
  combinedWeight: number,
  minWeight: number,
  maxVisibleStrands: number,
  zeroValueThickness: number,
  height: number
): Array<LineParams & { zeroValue?: boolean; pad?: number }> {
  const lineParams: Array<LineParams & { zeroValue?: boolean; pad?: number }> = weights.map((w, i) => ({
    weight: w,
    thickness: xputs[i].value === 0 ? zeroValueThickness : Math.min(combinedWeight + 0.5, Math.max(minWeight - 1, w) + 1),
    offset: 0,
    innerY: 0,
    outerY: 0,
    zeroValue: xputs[i].value === 0,
  }));

  const visibleStrands = Math.min(maxVisibleStrands, xputs.length);
  const visibleWeight = lineParams.slice(0, visibleStrands).reduce((acc, v) => v.thickness + acc, 0);
  const gaps = visibleStrands - 1;

  const innerTop = (height / 2) - (combinedWeight / 2);
  const innerBottom = innerTop + combinedWeight + 0.5;
  let lastOuter = 0;
  let lastInner = innerTop;
  const spacing = Math.max(4, (height - visibleWeight) / gaps);

  let offset = 0;
  let minOffset = 0;
  let maxOffset = 0;
  let lastWeight = 0;
  let pad = 0;

  lineParams.forEach((line, i) => {
    if (xputs[i].value === 0) {
      line.outerY = lastOuter + (zeroValueThickness / 2);
      if (xputs.length === 1) {
        line.outerY = (height / 2);
      }
      lastOuter += zeroValueThickness + spacing;
      return;
    }

    line.outerY = lastOuter + (line.thickness / 2);
    line.innerY = Math.min(innerBottom - (line.thickness / 2), Math.max(innerTop + (line.thickness / 2), lastInner + (line.weight / 2)));

    if (xputs.length === 1) {
      line.outerY = (height / 2);
    }

    lastOuter += line.thickness + spacing;
    lastInner += line.weight;

    if (!xputs[i].rest) {
      const w = (maxVisibleStrands - Math.max(lastWeight, line.weight)) / 2;
      const y1 = line.outerY;
      const y2 = line.innerY;
      const t = (lastWeight + line.weight) / 2;

      const dx = 0.75 * w;
      const dy = 1.5 * (y2 - y1);
      const a = Math.atan2(dy, dx);

      if (Math.sin(a) !== 0) {
        offset += Math.max(Math.min(t * (1 - Math.cos(a)) / Math.sin(a), t), -t);
      }

      line.offset = offset;
      minOffset = Math.min(minOffset, offset);
      maxOffset = Math.max(maxOffset, offset);
      pad = Math.max(pad, line.thickness / 2);
      lastWeight = line.weight;
    }
  });

  lineParams.forEach((line) => {
    line.offset -= minOffset;
    line.pad = pad + (maxOffset - minOffset);
  });

  return lineParams;
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  side: 'in' | 'out',
  outer: number,
  inner: number,
  weight: number,
  offset: number,
  pad: number,
  width: number,
  midWidth: number,
  gradient: CanvasGradient
): void {
  const connectorWidth = 10;
  const start = (weight * 0.5) + connectorWidth;
  const curveStart = Math.max(start + 5, pad + connectorWidth - offset);
  const end = width / 2 - (midWidth * 0.9) + 1;
  const curveEnd = end - offset - 10;
  const midpoint = (curveStart + curveEnd) / 2;

  let adjustedOuter = outer;
  if (Math.round(outer) === Math.round(inner)) {
    adjustedOuter -= 1;
  }

  ctx.strokeStyle = gradient;
  ctx.lineWidth = weight;
  ctx.lineCap = 'butt';
  ctx.beginPath();

  if (side === 'in') {
    ctx.moveTo(start, adjustedOuter);
    ctx.lineTo(curveStart, adjustedOuter);
    ctx.bezierCurveTo(midpoint, adjustedOuter, midpoint, inner, curveEnd, inner);
    ctx.lineTo(end, inner);
  } else {
    ctx.moveTo(width - start, adjustedOuter);
    ctx.lineTo(width - curveStart, adjustedOuter);
    ctx.bezierCurveTo(width - midpoint, adjustedOuter, width - midpoint, inner, width - curveEnd, inner);
    ctx.lineTo(width - end, inner);
  }

  ctx.stroke();
}

function drawZeroValuePath(
  ctx: CanvasRenderingContext2D,
  side: 'in' | 'out',
  y: number,
  zeroValueWidth: number,
  zeroValueThickness: number,
  width: number,
  color: string
): void {
  const offset = zeroValueThickness / 2;
  const start = 15;

  ctx.strokeStyle = color;
  ctx.lineWidth = zeroValueThickness;
  ctx.lineCap = 'round';
  ctx.beginPath();

  if (side === 'in') {
    ctx.moveTo(start + offset, y);
    ctx.lineTo(start + zeroValueWidth + offset, y);
  } else {
    ctx.moveTo(width - start - offset, y);
    ctx.lineTo(width - start - zeroValueWidth - offset, y);
  }

  ctx.stroke();
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  side: 'in' | 'out',
  y: number,
  thickness: number,
  width: number,
  color: string
): void {
  const halfThickness = thickness / 2;
  const markerWidth = Math.max(halfThickness, 8);
  const connectorWidth = 10;
  const overlap = 1;

  ctx.fillStyle = color;

  if (side === 'in') {
    const x = connectorWidth + overlap;
    ctx.beginPath();
    ctx.moveTo(x, y - halfThickness);
    ctx.lineTo(x + markerWidth, y - halfThickness);
    ctx.lineTo(x + markerWidth, y + halfThickness);
    ctx.lineTo(x, y + halfThickness);
    ctx.lineTo(x, y + halfThickness);
    ctx.lineTo(x + markerWidth, y);
    ctx.lineTo(x, y - halfThickness);
    ctx.closePath();
    ctx.fill('evenodd');
  } else {
    const x = width - connectorWidth - overlap;
    ctx.beginPath();
    ctx.moveTo(x - markerWidth, y - halfThickness);
    ctx.lineTo(x, y);
    ctx.lineTo(x - markerWidth, y + halfThickness);
    ctx.closePath();
    ctx.fill();
  }
}
