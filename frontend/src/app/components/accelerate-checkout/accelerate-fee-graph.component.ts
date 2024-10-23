import { Component, Input, Output, OnChanges, EventEmitter, HostListener, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Transaction } from '@interfaces/electrs.interface';
import { AccelerationEstimate, RateOption } from '@components/accelerate-checkout/accelerate-checkout.component';

interface GraphBar {
  rate: number;
  style?: Record<string,string>;
  class: 'tx' | 'target' | 'max';
  label: string;
  active?: boolean;
  rateIndex?: number;
  fee?: number;
  height?: number;
}

@Component({
  selector: 'app-accelerate-fee-graph',
  templateUrl: './accelerate-fee-graph.component.html',
  styleUrls: ['./accelerate-fee-graph.component.scss'],
})
export class AccelerateFeeGraphComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @Input() tx: Transaction;
  @Input() estimate: AccelerationEstimate;
  @Input() showEstimate = false;
  @Input() maxRateOptions: RateOption[] = [];
  @Input() maxRateIndex: number = 0;
  @Output() setUserBid = new EventEmitter<{ fee: number, index: number }>();

  @ViewChild('feeGraph')
  container: ElementRef<HTMLDivElement>;
  height: number;
  observer: ResizeObserver;
  stopResizeLoop = false;

  bars: GraphBar[] = [];
  tooltipPosition = { x: 0, y: 0 };

  constructor(
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.initGraph();
  }

  ngAfterViewInit(): void {
    if (ResizeObserver) {
      this.observer = new ResizeObserver(entries => {
        for (const entry of entries) {
          this.height = entry.contentRect.height;
          this.initGraph();
        }
      });
      this.observer.observe(this.container.nativeElement);
    } else {
      this.startResizeFallbackLoop();
    }
  }

  ngOnChanges(): void {
    this.initGraph();
  }

  initGraph(): void {
    if (!this.tx || !this.estimate) {
      return;
    }
    const hasNextBlockRate = (this.estimate.nextBlockFee > this.estimate.txSummary.effectiveFee);
    const numBars = hasNextBlockRate ? 4 : 3;
    const maxRate = Math.max(...this.maxRateOptions.map(option => option.rate));
    const baseRate = this.estimate.txSummary.effectiveFee / this.estimate.txSummary.effectiveVsize;
    let baseHeight = Math.max(this.height - (numBars * 30), this.height * (baseRate / maxRate));
    const bars: GraphBar[] = [];
    let lastHeight = 0;
    if (hasNextBlockRate) {
      lastHeight = Math.max(lastHeight + 30, (this.height * ((this.estimate.targetFeeRate - baseRate) / maxRate)));
      bars.push({
        rate: this.estimate.targetFeeRate,
        height: lastHeight,
        class: 'target',
        label: $localize`:@@bdf0e930eb22431140a2eaeacd809cc5f8ebd38c:Next Block`.toLowerCase(),
        fee: this.estimate.nextBlockFee - this.estimate.txSummary.effectiveFee
      });
    }
    this.maxRateOptions.forEach((option, index) => {
      lastHeight = Math.max(lastHeight + 30, (this.height * ((option.rate - baseRate) / maxRate)));
      bars.push({
        rate: option.rate,
        height: lastHeight,
        class: 'max',
        label: this.showEstimate ? $localize`maximum` : $localize`accelerated`,
        active: option.index === this.maxRateIndex,
        rateIndex: option.index,
        fee: option.fee,
      })
    })

    bars.reverse();

    baseHeight = this.height - lastHeight;

    for (const bar of bars) {
      bar.style = this.getStyle(bar.height, baseHeight);
    }

    bars.push({
      rate: baseRate,
      style: this.getStyle(baseHeight, 0),
      height: baseHeight,
      class: 'tx',
      label: '',
      fee: this.estimate.txSummary.effectiveFee,
    });

    this.bars = bars;
    this.cd.detectChanges();
  }

  getStyle(height: number, base: number): Record<string,string> {
    return {
      height: `${height}px`,
      bottom: base ? `${base}px` : '0',
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

  startResizeFallbackLoop(): void {
    if (this.stopResizeLoop) {
      return;
    }
    requestAnimationFrame(() => {
      this.height = this.container?.nativeElement?.clientHeight || 0;
      this.initGraph();
      this.startResizeFallbackLoop();
    });
  }

  ngOnDestroy(): void {
    this.stopResizeLoop = true;
    this.observer.disconnect();
  }
}
