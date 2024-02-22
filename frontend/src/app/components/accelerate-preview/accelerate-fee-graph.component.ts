import { Component, OnInit, Input, Output, OnChanges, EventEmitter, HostListener, Inject, LOCALE_ID } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Outspend, Transaction, Vin, Vout } from '../../interfaces/electrs.interface';
import { Router } from '@angular/router';
import { ReplaySubject, merge, Subscription, of } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { AccelerationEstimate, RateOption } from './accelerate-preview.component';

interface GraphBar {
  rate: number;
  style: any;
  class: 'tx' | 'target' | 'max';
  label: string;
  active?: boolean;
  rateIndex?: number;
  fee?: number;
}

@Component({
  selector: 'app-accelerate-fee-graph',
  templateUrl: './accelerate-fee-graph.component.html',
  styleUrls: ['./accelerate-fee-graph.component.scss'],
})
export class AccelerateFeeGraphComponent implements OnInit, OnChanges {
  @Input() tx: Transaction;
  @Input() estimate: AccelerationEstimate;
  @Input() maxRateOptions: RateOption[] = [];
  @Input() maxRateIndex: number = 0;
  @Output() setUserBid = new EventEmitter<{ fee: number, index: number }>();

  bars: GraphBar[] = [];
  tooltipPosition = { x: 0, y: 0 };

  ngOnInit(): void {
    this.initGraph();
  }

  ngOnChanges(): void {
    this.initGraph();
  }

  initGraph(): void {
    if (!this.tx || !this.estimate) {
      return;
    }
    const maxRate = Math.max(...this.maxRateOptions.map(option => option.rate));
    const baseRate = this.estimate.txSummary.effectiveFee / this.estimate.txSummary.effectiveVsize;
    const baseHeight = baseRate / maxRate;
    const bars: GraphBar[] = this.maxRateOptions.slice().reverse().map(option => {
      return {
        rate: option.rate,
        style: this.getStyle(option.rate, maxRate, baseHeight),
        class: 'max',
        label: 'maximum',
        active: option.index === this.maxRateIndex,
        rateIndex: option.index,
        fee: option.fee,
      }
    });
    if (this.estimate.nextBlockFee > this.estimate.txSummary.effectiveFee) {
      bars.push({
        rate: this.estimate.targetFeeRate,
        style: this.getStyle(this.estimate.targetFeeRate, maxRate, baseHeight),
        class: 'target',
        label: 'next block',
        fee: this.estimate.nextBlockFee - this.estimate.txSummary.effectiveFee
      });
    }
    bars.push({
      rate: baseRate,
      style: this.getStyle(baseRate, maxRate, 0),
      class: 'tx',
      label: '',
      fee: this.estimate.txSummary.effectiveFee,
    });
    this.bars = bars;
  }

  getStyle(rate, maxRate, base) {
    const top = (rate / maxRate);
    return {
      height: `${(top - base) * 100}%`,
      bottom: base ? `${base * 100}%` : '0',
    }
  }

  onClick(event, bar): void {
    if (bar.rateIndex != null) {
      this.setUserBid.emit({ fee: bar.fee, index: bar.rateIndex });
    }
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(event) {
    this.tooltipPosition = { x: event.offsetX, y: event.offsetY };
  }
}
