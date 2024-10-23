import { Component, OnInit, Input, OnChanges, HostListener, Inject, LOCALE_ID } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Outspend, Transaction, Vin, Vout } from '@interfaces/electrs.interface';
import { Router } from '@angular/router';
import { ReplaySubject, merge, Subscription, of } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { AssetsService } from '@app/services/assets.service';
import { environment } from '@environments/environment';
import { ElectrsApiService } from '@app/services/electrs-api.service';

interface SvgLine {
  path: string;
  style: string;
  class?: string;
  connectorPath?: string;
  markerPath?: string;
  zeroValue?: boolean;
}

interface Xput {
  type: 'input' | 'output' | 'fee';
  value?: number;
  displayValue?: number;
  index?: number;
  txid?: string;
  vin?: number;
  vout?: number;
  address?: string;
  rest?: number;
  coinbase?: boolean;
  pegin?: boolean;
  pegout?: string;
  confidential?: boolean;
  timestamp?: number;
  blockHeight?: number;
  asset?: string;
}

@Component({
  selector: 'tx-bowtie-graph',
  templateUrl: './tx-bowtie-graph.component.html',
  styleUrls: ['./tx-bowtie-graph.component.scss'],
})
export class TxBowtieGraphComponent implements OnInit, OnChanges {
  @Input() tx: Transaction;
  @Input() network: string;
  @Input() cached: boolean = false;
  @Input() width = 1200;
  @Input() height = 600;
  @Input() lineLimit = 250;
  @Input() maxCombinedWeight = 100;
  @Input() minWeight = 2; //
  @Input() maxStrands = 24; // number of inputs/outputs to keep fully on-screen.
  @Input() tooltip = false;
  @Input() connectors = false;
  @Input() inputIndex: number;
  @Input() outputIndex: number;

  dir: 'rtl' | 'ltr' = 'ltr';

  inputData: Xput[];
  outputData: Xput[];
  inputs: SvgLine[];
  outputs: SvgLine[];
  middle: SvgLine;
  midWidth: number;
  txWidth: number;
  connectorWidth: number;
  combinedWeight: number;
  isLiquid: boolean = false;
  hoverLine: Xput | void = null;
  hoverConnector: boolean = false;
  tooltipPosition = { x: 0, y: 0 };
  outspends: Outspend[] = [];
  zeroValueWidth = 60;
  zeroValueThickness = 20;
  hasLine: boolean;
  assetsMinimal: any;
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;

  outspendsSubscription: Subscription;
  refreshOutspends$: ReplaySubject<string> = new ReplaySubject();

  gradientColors = {
    '': ['var(--mainnet-alt)', 'var(--primary)', 'color-mix(in srgb, var(--mainnet-alt) 1%, transparent)'],
    // liquid: ['#116761', '#183550'],
    liquid: ['#09a197', '#0f62af', '#09a19700'],
    // 'liquidtestnet': ['#494a4a', '#272e46'],
    'liquidtestnet': ['#d2d2d2', '#979797', '#d2d2d200'],
    // testnet: ['#1d486f', '#183550'],
    testnet: ['#4edf77', '#10a0af', '#4edf7700'],
    testnet4: ['#4edf77', '#10a0af', '#4edf7700'],
    // signet: ['#6f1d5d', '#471850'],
    signet: ['#d24fc8', '#a84fd2', '#d24fc800'],
  };

  gradient: string[] = ['var(--primary)', 'var(--primary)'];

  constructor(
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    public stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private assetsService: AssetsService,
    @Inject(LOCALE_ID) private locale: string,
  ) {
    if (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he')) {
      this.dir = 'rtl';
    }
  }

  ngOnInit(): void {
    this.initGraph();

    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      this.assetsService.getAssetsMinimalJson$.subscribe((assets) => {
        this.assetsMinimal = assets;
      });
    }

    this.outspendsSubscription = merge(
      this.refreshOutspends$
        .pipe(
          switchMap((txid) => {
            if (!this.cached) {
              return this.electrsApiService.cachedRequest(this.electrsApiService.getOutspendsBatched$, 250, [txid]);
            } else {
              return of(null);
            }
          }),
          tap((outspends: Outspend[][]) => {
            if (!this.tx || !outspends || !outspends.length) {
              return;
            }
            this.outspends = outspends[0];
          }),
        ),
      this.stateService.utxoSpent$
        .pipe(
          tap((utxoSpent) => {
            for (const i in utxoSpent) {
              this.outspends[i] = {
                spent: true,
                txid: utxoSpent[i].txid,
                vin: utxoSpent[i].vin,
              };
            }
          }),
        ),
    ).subscribe(() => {});
  }

  ngOnChanges(): void {
    this.initGraph();
    if (!this.cached) {
      this.refreshOutspends$.next(this.tx.txid);
    }
  }

  initGraph(): void {
    this.isLiquid = (this.network === 'liquid' || this.network === 'liquidtestnet');
    this.gradient = this.gradientColors[this.network];
    this.midWidth = Math.min(10, Math.ceil(this.width / 100));
    this.txWidth = this.connectors ? Math.max(this.width - 200, this.width * 0.8) : this.width - 20;
    this.combinedWeight = Math.min(this.maxCombinedWeight, Math.floor((this.txWidth - (2 * this.midWidth)) / 6));
    this.connectorWidth = (this.width - this.txWidth) / 2;
    this.zeroValueWidth = Math.max(20, Math.min((this.txWidth / 2) - this.midWidth - 110, 60));

    const totalValue = this.calcTotalValue(this.tx);
    let voutWithFee = this.tx.vout.map((v, i) => {
      return {
        type: v.scriptpubkey_type === 'fee' ? 'fee' : 'output',
        value: this.getOutputValue(v),
        displayValue: v?.value,
        address: v?.scriptpubkey_address || v?.scriptpubkey_type?.toUpperCase(),
        index: i,
        pegout: v?.pegout?.scriptpubkey_address,
        confidential: (this.isLiquid && v?.value === undefined),
        timestamp: this.tx.status.block_time,
        blockHeight: this.tx.status.block_height,
        asset: v?.asset,
      } as Xput;
    });

    if (this.tx.fee && !this.isLiquid) {
      voutWithFee.unshift({ type: 'fee', value: this.tx.fee });
    }
    const outputCount = voutWithFee.length;

    let truncatedInputs = this.tx.vin.map((v, i) => {
      return {
        type: 'input',
        value: (v?.is_coinbase && !totalValue ? 0 : this.getInputValue(v)),
        displayValue: v?.prevout?.value,
        txid: v.txid,
        vout: v.vout,
        address: v?.prevout?.scriptpubkey_address || v?.prevout?.scriptpubkey_type?.toUpperCase(),
        index: i,
        coinbase: v?.is_coinbase,
        pegin: v?.is_pegin,
        confidential: (this.isLiquid && v?.prevout?.value === undefined),
        timestamp: this.tx.status.block_time,
        blockHeight: this.tx.status.block_height,
        asset: v?.prevout?.asset,
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
      path: `M ${(this.width / 2) - this.midWidth} ${(this.height / 2) + 0.25} L ${(this.width / 2) + this.midWidth} ${(this.height / 2) + 0.25}`,
      style: `stroke-width: ${this.combinedWeight + 0.5}; stroke: ${this.gradient[1]}`
    };

    this.hasLine = this.inputs.reduce((line, put) => line || !put.zeroValue, false)
      && this.outputs.reduce((line, put) => line || !put.zeroValue, false);
  }

  calcTotalValue(tx: Transaction): number {
    let totalOutput = this.tx.vout.reduce((acc, v) => (this.getOutputValue(v) || 0) + acc, 0);
    // simple sum of outputs + fee for bitcoin
    if (!this.isLiquid) {
      return this.tx.fee ? totalOutput + this.tx.fee : totalOutput;
    } else {
      const totalInput = this.tx.vin.reduce((acc, v) => (this.getInputValue(v) || 0) + acc, 0);
      const confidentialInputCount = this.tx.vin.reduce((acc, v) => acc + (this.isUnknownInputValue(v) ? 1 : 0), 0);
      const confidentialOutputCount = this.tx.vout.reduce((acc, v) => acc + (this.isUnknownOutputValue(v) ? 1 : 0), 0);

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
    const lineParams = weights.map((w, i) => {
      return {
        weight: w,
        thickness: xputs[i].value === 0 ? this.zeroValueThickness : Math.min(this.combinedWeight + 0.5, Math.max(this.minWeight - 1, w) + 1),
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
    const innerBottom = innerTop + this.combinedWeight + 0.5;
    // tracks the visual bottom of the endpoints of the previous line
    let lastOuter = 0;
    let lastInner = innerTop;
    // gap between strands
    const spacing = Math.max(4, (this.height - visibleWeight) / gaps);

    // curve adjustments to prevent overlaps
    let offset = 0;
    let minOffset = 0;
    let maxOffset = 0;
    let lastWeight = 0;
    let pad = 0;
    lineParams.forEach((line, i) => {
      if (xputs[i].value === 0) {
        line.outerY = lastOuter + (this.zeroValueThickness / 2);
        if (xputs.length === 1) {
          line.outerY = (this.height / 2);
        }
        lastOuter += this.zeroValueThickness + spacing;
        return;
      }

      // set the vertical position of the (center of the) outer side of the line
      line.outerY = lastOuter + (line.thickness / 2);
      line.innerY = Math.min(innerBottom - (line.thickness / 2), Math.max(innerTop + (line.thickness / 2), lastInner + (line.weight / 2)));

      // special case to center single input/outputs
      if (xputs.length === 1) {
        line.outerY = (this.height / 2);
      }

      lastOuter += line.thickness + spacing;
      lastInner += line.weight;

      // calculate conservative lower bound of the amount of horizontal offset
      // required to prevent this line overlapping its neighbor

      if (this.tooltip || !xputs[i].rest) {
        const w = (this.txWidth - Math.max(lastWeight, line.weight) - (this.connectorWidth * 2)) / 2; // approximate horizontal width of the curved section of the line
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
      if (xputs[i].value === 0) {
        return {
          path: this.makeZeroValuePath(side, line.outerY),
          style: this.makeStyle(this.zeroValueThickness, xputs[i].type),
          class: xputs[i].type,
          zeroValue: true,
        };
      } else {
        return {
          path: this.makePath(side, line.outerY, line.innerY, line.thickness, line.offset, pad + maxOffset),
          style: this.makeStyle(line.thickness, xputs[i].type),
          class: xputs[i].type,
          connectorPath: this.connectors ? this.makeConnectorPath(side, line.outerY, line.innerY, line.thickness): null,
          markerPath: this.makeMarkerPath(side, line.outerY, line.innerY, line.thickness),
        };
      }
    });
  }

  makePath(side: 'in' | 'out', outer: number, inner: number, weight: number, offset: number, pad: number): string {
    const start = (weight * 0.5) + this.connectorWidth;
    const curveStart = Math.max(start + 5, pad + this.connectorWidth - offset);
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

  makeZeroValuePath(side: 'in' | 'out', y: number): string {
    const offset = this.zeroValueThickness / 2;
    const start = (this.connectorWidth / 2) + 10;
    if (side === 'in') {
      return `M ${start + offset} ${y} L ${start + this.zeroValueWidth + offset} ${y}`;
    } else { // mirrored in y-axis for the right hand side
      return `M ${this.width - start - offset} ${y} L ${this.width - start - this.zeroValueWidth - offset} ${y}`;
    }
  }

  makeConnectorPath(side: 'in' | 'out', y: number, inner, weight: number): string {
    const halfWidth = weight * 0.5;
    const offset = 10; //Math.max(2, halfWidth * 0.2);
    const lineEnd = this.connectorWidth;

    // align with for svg horizontal gradient bug correction
    if (Math.round(y) === Math.round(inner)) {
      y -= 1;
    }

    if (side === 'in') {
      return `M ${lineEnd - offset} ${y - halfWidth} L ${halfWidth + lineEnd - offset} ${y} L ${lineEnd - offset} ${y + halfWidth} L -${10} ${ y + halfWidth} L -${10} ${y - halfWidth}`;
    } else {
      return `M ${this.width - halfWidth - lineEnd + offset} ${y - halfWidth} L ${this.width - lineEnd + offset} ${y} L ${this.width - halfWidth - lineEnd + offset} ${y + halfWidth} L ${this.width + 10} ${ y + halfWidth} L ${this.width + 10} ${y - halfWidth}`;
    }
  }

  makeMarkerPath(side: 'in' | 'out', y: number, inner, weight: number): string {
    const halfWidth = weight * 0.5;
    const offset = 10; //Math.max(2, halfWidth * 0.2);
    const lineEnd = this.connectorWidth;

    // align with for svg horizontal gradient bug correction
    if (Math.round(y) === Math.round(inner)) {
      y -= 1;
    }

    if (side === 'in') {
      return `M ${lineEnd - offset} ${y - halfWidth} L ${halfWidth + lineEnd - offset} ${y} L ${lineEnd - offset} ${y + halfWidth} L ${weight + lineEnd} ${ y + halfWidth} L ${weight + lineEnd} ${y - halfWidth}`;
    } else {
      return `M ${this.width - halfWidth - lineEnd + offset} ${y - halfWidth} L ${this.width - lineEnd + offset} ${y} L ${this.width - halfWidth - lineEnd + offset} ${y + halfWidth} L ${this.width - halfWidth - lineEnd} ${ y + halfWidth} L ${this.width - halfWidth - lineEnd} ${y - halfWidth}`;
    }
  }

  makeStyle(minWeight, type): string {
    if (type === 'fee') {
      return `stroke-width: ${minWeight}`;
    } else {
      return `stroke-width: ${minWeight}`;
    }
  }

  getOutputValue(v: Vout): number | void {
    if (!v) {
      return null;
    } else if (this.isLiquid && v.asset !== this.nativeAssetId) {
      return null;
    } else {
      return v.value;
    }
  }

  getInputValue(v: Vin): number | void {
    if (!v?.prevout) {
      return null;
    } else if (this.isLiquid && v.prevout.asset !== this.nativeAssetId) {
      return null;
    } else {
      return v.prevout.value;
    }
  }

  isUnknownInputValue(v: Vin): boolean {
    return v?.prevout?.value == null || this.isLiquid && v?.prevout?.asset !== this.nativeAssetId;
  }

  isUnknownOutputValue(v: Vout): boolean {
    return v?.value == null || this.isLiquid && v?.asset !== this.nativeAssetId;
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event) {
    if (this.dir === 'rtl') {
      this.tooltipPosition = { x: this.width - event.offsetX, y: event.offsetY };
    } else {
     this.tooltipPosition = { x: event.offsetX, y: event.offsetY };
    }
  }

  onHover(event, side, index): void {
    if (side.startsWith('input')) {
      this.hoverLine = {
        ...this.inputData[index],
        index
      };
      this.hoverConnector = (side === 'input-connector');

    } else {
      this.hoverLine = {
        ...this.outputData[index],
        ...this.outspends[this.outputData[index].index]
      };
      this.hoverConnector = (side === 'output-connector');
    }
  }

  onBlur(event, side, index): void {
    this.hoverLine = null;
    this.hoverConnector = false;
  }

  onClick(event, side, index): void {
    if (side.startsWith('input')) {
      const input = this.tx.vin[index];
      if (side === 'input-connector' && input && !input.is_coinbase && !input.is_pegin && input.txid && input.vout != null) {
        this.router.navigate([this.relativeUrlPipe.transform('/tx'), input.txid], {
          queryParamsHandling: 'merge',
          fragment: (new URLSearchParams({
            flow: '',
            vout: input.vout.toString(),
          })).toString(),
        });
      } else if (index != null) {
        this.router.navigate([this.relativeUrlPipe.transform('/tx'), this.tx.txid], {
          queryParamsHandling: 'merge',
          fragment: (new URLSearchParams({
            flow: '',
            vin: index.toString(),
          })).toString(),
        });
      }
    } else {
      const output = this.tx.vout[index];
      const outspend = this.outspends[index];
      if (side === 'output-connector' && output && outspend && outspend.spent && outspend.txid) {
        this.router.navigate([this.relativeUrlPipe.transform('/tx'), outspend.txid], {
          queryParamsHandling: 'merge',
          fragment: (new URLSearchParams({
            flow: '',
            vin: outspend.vin.toString(),
          })).toString(),
        });
      } else if (index != null) {
        this.router.navigate([this.relativeUrlPipe.transform('/tx'), this.tx.txid], {
          queryParamsHandling: 'merge',
          fragment: (new URLSearchParams({
            flow: '',
            vout: index.toString(),
          })).toString(),
        });
      }
    }
  }
}
