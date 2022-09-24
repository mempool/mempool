import { Component, OnInit, Input, OnChanges, HostListener } from '@angular/core';
import { Transaction } from '../../interfaces/electrs.interface';

interface SvgLine {
  path: string;
  style: string;
  class?: string;
}

interface Xput {
  type: 'input' | 'output' | 'fee';
  value?: number;
  index?: number;
  address?: string;
  rest?: number;
  coinbase?: boolean;
  pegin?: boolean;
  pegout?: string;
  confidential?: boolean;
}

@Component({
  selector: 'tx-bowtie-graph',
  templateUrl: './tx-bowtie-graph.component.html',
  styleUrls: ['./tx-bowtie-graph.component.scss'],
})
export class TxBowtieGraphComponent implements OnInit, OnChanges {
  @Input() tx: Transaction;
  @Input() network: string;
  @Input() width = 1200;
  @Input() height = 600;
  @Input() lineLimit = 250;
  @Input() maxCombinedWeight = 100;
  @Input() minWeight = 2; //
  @Input() maxStrands = 24; // number of inputs/outputs to keep fully on-screen.
  @Input() tooltip = false;

  inputData: Xput[];
  outputData: Xput[];
  inputs: SvgLine[];
  outputs: SvgLine[];
  middle: SvgLine;
  midWidth: number;
  combinedWeight: number;
  isLiquid: boolean = false;
  hoverLine: Xput | void = null;
  tooltipPosition = { x: 0, y: 0 };

  gradientColors = {
    '': ['#9339f4', '#105fb0'],
    bisq: ['#9339f4', '#105fb0'],
    // liquid: ['#116761', '#183550'],
    liquid: ['#09a197', '#0f62af'],
    // 'liquidtestnet': ['#494a4a', '#272e46'],
    'liquidtestnet': ['#d2d2d2', '#979797'],
    // testnet: ['#1d486f', '#183550'],
    testnet: ['#4edf77', '#10a0af'],
    // signet: ['#6f1d5d', '#471850'],
    signet: ['#d24fc8', '#a84fd2'],
  };

  gradient: string[] = ['#105fb0', '#105fb0'];

  ngOnInit(): void {
    this.initGraph();
  }

  ngOnChanges(): void {
    this.initGraph();
  }

  initGraph(): void {
    this.isLiquid = (this.network === 'liquid' || this.network === 'liquidtestnet');
    this.gradient = this.gradientColors[this.network];
    this.midWidth = Math.min(10, Math.ceil(this.width / 100));
    this.combinedWeight = Math.min(this.maxCombinedWeight, Math.floor((this.width - (2 * this.midWidth)) / 6));

    const totalValue = this.calcTotalValue(this.tx);
    let voutWithFee = this.tx.vout.map(v => {
      return {
        type: v.scriptpubkey_type === 'fee' ? 'fee' : 'output',
        value: v?.value,
        address: v?.scriptpubkey_address || v?.scriptpubkey_type?.toUpperCase(),
        pegout: v?.pegout?.scriptpubkey_address,
        confidential: (this.isLiquid && v?.value === undefined),
      } as Xput;
    });

    if (this.tx.fee && !this.isLiquid) {
      voutWithFee.unshift({ type: 'fee', value: this.tx.fee });
    }
    const outputCount = voutWithFee.length;

    let truncatedInputs = this.tx.vin.map(v => {
      return {
        type: 'input',
        value: v?.prevout?.value,
        address: v?.prevout?.scriptpubkey_address || v?.prevout?.scriptpubkey_type?.toUpperCase(),
        coinbase: v?.is_coinbase,
        pegin: v?.is_pegin,
        confidential: (this.isLiquid && v?.prevout?.value === undefined),
      } as Xput;
    });

    if (truncatedInputs.length > this.lineLimit) {
      const valueOfRest = truncatedInputs.slice(this.lineLimit).reduce((r, v) => {
        return r + (v.value || 0);
      }, 0);
      truncatedInputs = truncatedInputs.slice(0, this.lineLimit);
      truncatedInputs.push({ type: 'input', value: valueOfRest, rest: this.tx.vin.length - this.lineLimit });
    }
    if (voutWithFee.length > this.lineLimit) {
      const valueOfRest = voutWithFee.slice(this.lineLimit).reduce((r, v) => {
        return r + (v.value || 0);
      }, 0);
      voutWithFee = voutWithFee.slice(0, this.lineLimit);
      voutWithFee.push({ type: 'output', value: valueOfRest, rest: outputCount - this.lineLimit });
    }

    this.inputData = truncatedInputs;
    this.outputData = voutWithFee;

    this.inputs = this.initLines('in', truncatedInputs, totalValue, this.maxStrands);
    this.outputs = this.initLines('out', voutWithFee, totalValue, this.maxStrands);

    this.middle = {
      path: `M ${(this.width / 2) - this.midWidth} ${(this.height / 2) + 0.5} L ${(this.width / 2) + this.midWidth} ${(this.height / 2) + 0.5}`,
      style: `stroke-width: ${this.combinedWeight + 1}; stroke: ${this.gradient[1]}`
    };
  }

  calcTotalValue(tx: Transaction): number {
    const totalOutput = this.tx.vout.reduce((acc, v) => (v.value == null ? 0 : v.value) + acc, 0);
    // simple sum of outputs + fee for bitcoin
    if (!this.isLiquid) {
      return this.tx.fee ? totalOutput + this.tx.fee : totalOutput;
    } else {
      const totalInput = this.tx.vin.reduce((acc, v) => (v?.prevout?.value == null ? 0 : v.prevout.value) + acc, 0);
      const confidentialInputCount = this.tx.vin.reduce((acc, v) => acc + (v?.prevout?.value == null ? 1 : 0), 0);
      const confidentialOutputCount = this.tx.vout.reduce((acc, v) => acc + (v.value == null ? 1 : 0), 0);

      // if there are unknowns on both sides, the total is indeterminate, so we'll just fudge it
      if (confidentialInputCount && confidentialOutputCount) {
        const knownInputCount = (tx.vin.length - confidentialInputCount) || 1;
        const knownOutputCount = (tx.vout.length - confidentialOutputCount) || 1;
        // assume confidential inputs/outputs have the same average value as the known ones
        const adjustedTotalInput = totalInput + ((totalInput / knownInputCount) * confidentialInputCount);
        const adjustedTotalOutput = totalOutput + ((totalOutput / knownOutputCount) * confidentialOutputCount);
        return Math.max(adjustedTotalInput, adjustedTotalOutput);
      } else {
        // otherwise knowing the actual total of one side suffices
        return Math.max(totalInput, totalOutput);
      }
    }
  }

  initLines(side: 'in' | 'out', xputs: Xput[], total: number, maxVisibleStrands: number): SvgLine[] {
    if (!total) {
      const weights = xputs.map((put) => this.combinedWeight / xputs.length);
      return this.linesFromWeights(side, xputs, weights, maxVisibleStrands);
    } else {
      let unknownCount = 0;
      let unknownTotal = total;
      xputs.forEach(put => {
        if (put.value == null) {
          unknownCount++;
        } else {
          unknownTotal -= put.value as number;
        }
      });
      const unknownShare = unknownTotal / unknownCount;
      // conceptual weights
      const weights = xputs.map((put) => this.combinedWeight * (put.value == null ? unknownShare : put.value as number) / total);
      return this.linesFromWeights(side, xputs, weights, maxVisibleStrands);
    }
  }

  linesFromWeights(side: 'in' | 'out', xputs: Xput[], weights: number[], maxVisibleStrands: number): SvgLine[] {
    const lineParams = weights.map((w) => {
      return {
        weight: w,
        thickness: Math.max(this.minWeight - 1, w) + 1,
        offset: 0,
        innerY: 0,
        outerY: 0,
      };
    });
    const visibleStrands = Math.min(maxVisibleStrands, xputs.length);
    const visibleWeight = lineParams.slice(0, visibleStrands).reduce((acc, v) => v.thickness + acc, 0);
    const gaps = visibleStrands - 1;

    // bounds of the middle segment
    const innerTop = (this.height / 2) - (this.combinedWeight / 2);
    const innerBottom = innerTop + this.combinedWeight;
    // tracks the visual bottom of the endpoints of the previous line
    let lastOuter = 0;
    let lastInner = innerTop;
    // gap between strands
    const spacing = (this.height - visibleWeight) / gaps;

    // curve adjustments to prevent overlaps
    let offset = 0;
    let minOffset = 0;
    let maxOffset = 0;
    let lastWeight = 0;
    let pad = 0;
    lineParams.forEach((line, i) => {
      // set the vertical position of the (center of the) outer side of the line
      line.outerY = lastOuter + (line.thickness / 2);
      line.innerY = Math.min(innerBottom + (line.thickness / 2), Math.max(innerTop + (line.thickness / 2), lastInner + (line.weight / 2)));

      // special case to center single input/outputs
      if (xputs.length === 1) {
        line.outerY = (this.height / 2);
      }

      lastOuter += line.thickness + spacing;
      lastInner += line.weight;

      // calculate conservative lower bound of the amount of horizontal offset
      // required to prevent this line overlapping its neighbor

      if (this.tooltip || !xputs[i].rest) {
        const w = (this.width - Math.max(lastWeight, line.weight)) / 2; // approximate horizontal width of the curved section of the line
        const y1 = line.outerY;
        const y2 = line.innerY;
        const t = (lastWeight + line.weight) / 2; // distance between center of this line and center of previous line

        // slope of the inflection point of the bezier curve
        const dx = 0.75 * w;
        const dy = 1.5 * (y2 - y1);
        const a = Math.atan2(dy, dx);

        // parallel curves should be separated by >=t at the inflection point to prevent overlap
        // vertical offset is always = t, contributing tCos(a)
        // horizontal offset h will contribute hSin(a)
        // tCos(a) + hSin(a) >= t
        // h >= t(1 - cos(a)) / sin(a)
        if (Math.sin(a) !== 0) {
          // (absolute value clamped to t for sanity)
          offset += Math.max(Math.min(t * (1 - Math.cos(a)) / Math.sin(a), t), -t);
        }

        line.offset = offset;
        minOffset = Math.min(minOffset, offset);
        maxOffset = Math.max(maxOffset, offset);
        pad = Math.max(pad, line.thickness / 2);
        lastWeight = line.weight;
      } else {
        // skip the offsets for consolidated lines in unfurls, since these *should* overlap a little
      }
    });

    // normalize offsets
    lineParams.forEach((line) => {
      line.offset -= minOffset;
    });
    maxOffset -= minOffset;

    return lineParams.map((line, i) => {
      return {
        path: this.makePath(side, line.outerY, line.innerY, line.thickness, line.offset, pad + maxOffset),
        style: this.makeStyle(line.thickness, xputs[i].type),
        class: xputs[i].type
      };
    });
  }

  makePath(side: 'in' | 'out', outer: number, inner: number, weight: number, offset: number, pad: number): string {
    const start = (weight * 0.5);
    const curveStart = Math.max(start + 1, pad - offset);
    const end =  this.width / 2 - (this.midWidth * 0.9) + 1;
    const curveEnd = end - offset - 10;
    const midpoint = (curveStart + curveEnd) / 2;

    // correct for svg horizontal gradient bug
    if (Math.round(outer) === Math.round(inner)) {
      outer -= 1;
    }

    if (side === 'in') {
      return `M ${start} ${outer} L ${curveStart} ${outer} C ${midpoint} ${outer}, ${midpoint} ${inner}, ${curveEnd} ${inner} L ${end} ${inner}`;
    } else { // mirrored in y-axis for the right hand side
      return `M ${this.width - start} ${outer} L ${this.width - curveStart} ${outer} C ${this.width - midpoint} ${outer}, ${this.width - midpoint} ${inner}, ${this.width - curveEnd} ${inner} L ${this.width - end} ${inner}`;
    }
  }

  makeStyle(minWeight, type): string {
    if (type === 'fee') {
      return `stroke-width: ${minWeight}`;
    } else {
      return `stroke-width: ${minWeight}`;
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event) {
    this.tooltipPosition = { x: event.offsetX, y: event.offsetY };
  }

  onHover(event, side, index): void {
    if (side === 'input') {
      this.hoverLine = {
        ...this.inputData[index],
        index
      };
    } else {
      this.hoverLine = {
        ...this.outputData[index],
        index
      };
    }
  }

  onBlur(event, side, index): void {
    this.hoverLine = null;
  }
}
