import { Component, OnInit, Input, OnChanges } from '@angular/core';
import { Transaction } from '../../interfaces/electrs.interface';

interface SvgLine {
  path: string;
  style: string;
  class?: string;
}

interface Xput {
  type: 'input' | 'output' | 'fee';
  value?: number;
}

const lineLimit = 250;

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
  @Input() combinedWeight = 100;
  @Input() minWeight = 2; //
  @Input() maxStrands = 24; // number of inputs/outputs to keep fully on-screen.

  inputs: SvgLine[];
  outputs: SvgLine[];
  middle: SvgLine;
  midWidth: number;
  isLiquid: boolean = false;

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
    this.isLiquid = (this.network === 'liquid' || this.network === 'liquidtestnet');
    this.gradient = this.gradientColors[this.network];
    this.midWidth = Math.min(50, Math.ceil(this.width / 20));
    this.initGraph();
  }

  ngOnChanges(): void {
    this.isLiquid = (this.network === 'liquid' || this.network === 'liquidtestnet');
    this.gradient = this.gradientColors[this.network];
    this.initGraph();
  }

  initGraph(): void {
    const totalValue = this.calcTotalValue(this.tx);
    let voutWithFee = this.tx.vout.map(v => { return { type: v.scriptpubkey_type === 'fee' ? 'fee' : 'output', value: v?.value } as Xput; });

    if (this.tx.fee && !this.isLiquid) {
      voutWithFee.unshift({ type: 'fee', value: this.tx.fee });
    }

    let truncatedInputs = this.tx.vin.map(v => { return {type: 'input', value: v?.prevout?.value } as Xput; });

    if (truncatedInputs.length > lineLimit) {
      const valueOfRest = truncatedInputs.slice(lineLimit).reduce((r, v) => {
        return r + (v.value || 0);
      }, 0);
      truncatedInputs = truncatedInputs.slice(0, lineLimit);
      truncatedInputs.push({ type: 'input', value: valueOfRest });
    }
    if (voutWithFee.length > lineLimit) {
      const valueOfRest = voutWithFee.slice(lineLimit).reduce((r, v) => {
        return r + (v.value || 0);
      }, 0);
      voutWithFee = voutWithFee.slice(0, lineLimit);
      voutWithFee.push({ type: 'output', value: valueOfRest });
    }

    this.inputs = this.initLines('in', truncatedInputs, totalValue, this.maxStrands);
    this.outputs = this.initLines('out', voutWithFee, totalValue, this.maxStrands);

    this.middle = {
      path: `M ${(this.width / 2) - this.midWidth} ${(this.height / 2) + 0.5} L ${(this.width / 2) + this.midWidth} ${(this.height / 2) + 0.5}`,
      style: `stroke-width: ${this.combinedWeight + 0.5}; stroke: ${this.gradient[1]}`
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
      const weights = xputs.map((put): number => this.combinedWeight / xputs.length);
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
      const weights = xputs.map((put): number => this.combinedWeight * (put.value == null ? unknownShare : put.value as number) / total);
      return this.linesFromWeights(side, xputs, weights, maxVisibleStrands);
    }
  }

  linesFromWeights(side: 'in' | 'out', xputs: Xput[], weights: number[], maxVisibleStrands: number) {
    const lines = [];
    // actual displayed line thicknesses
    const minWeights = weights.map((w) => Math.max(this.minWeight - 1, w) + 1);
    const visibleStrands = Math.min(maxVisibleStrands, xputs.length);
    const visibleWeight = minWeights.slice(0, visibleStrands).reduce((acc, v) => v + acc, 0);
    const gaps = visibleStrands - 1;

    const innerTop = (this.height / 2) - (this.combinedWeight / 2);
    const innerBottom = innerTop + this.combinedWeight;
    // tracks the visual bottom of the endpoints of the previous line
    let lastOuter = 0;
    let lastInner = innerTop;
    // gap between strands
    const spacing = (this.height - visibleWeight) / gaps;

    for (let i = 0; i < xputs.length; i++) {
      const weight = weights[i];
      const minWeight = minWeights[i];
      // set the vertical position of the (center of the) outer side of the line
      let outer = lastOuter + (minWeight / 2);
      const inner = Math.min(innerBottom + (minWeight / 2), Math.max(innerTop + (minWeight / 2), lastInner + (weight / 2)));

      // special case to center single input/outputs
      if (xputs.length === 1) {
        outer = (this.height / 2);
      }

      lastOuter += minWeight + spacing;
      lastInner += weight;
      lines.push({
        path: this.makePath(side, outer, inner, minWeight),
        style: this.makeStyle(minWeight, xputs[i].type),
        class: xputs[i].type
      });
    }

    return lines;
  }

  makePath(side: 'in' | 'out', outer: number, inner: number, weight: number): string {
    const start = side === 'in' ? (weight * 0.5) : this.width - (weight * 0.5);
    const center =  this.width / 2 + (side === 'in' ? -(this.midWidth * 0.9) : (this.midWidth * 0.9) );
    const midpoint = (start + center) / 2;
    // correct for svg horizontal gradient bug
    if (Math.round(outer) === Math.round(inner)) {
      outer -= 1;
    }
    return `M ${start} ${outer} C ${midpoint} ${outer}, ${midpoint} ${inner}, ${center} ${inner}`;
  }

  makeStyle(minWeight, type): string {
    if (type === 'fee') {
      return `stroke-width: ${minWeight}; stroke: url(#fee-gradient)`;
    } else {
      return `stroke-width: ${minWeight}`;
    }
  }
}
