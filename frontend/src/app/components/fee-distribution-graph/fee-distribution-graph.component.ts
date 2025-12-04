import { HostListener, OnChanges, OnDestroy } from '@angular/core';
import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { TransactionStripped } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { VbytesPipe } from '@app/shared/pipes/bytes-pipe/vbytes.pipe';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-fee-distribution-graph',
  templateUrl: './fee-distribution-graph.component.html',
  styleUrls: ['./fee-distribution-graph.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class FeeDistributionGraphComponent implements OnInit, OnChanges, OnDestroy {
  @Input() feeRange: number[];
  @Input() vsize: number;
  @Input() transactions: TransactionStripped[];
  @Input() height: number | string = 210;
  @Input() top: number | string = 20;
  @Input() right: number | string = 22;
  @Input() left: number | string = 30;
  @Input() numSamples: number = 200;
  @Input() numLabels: number = 10;

  simple: boolean = false;
  data: number[][];
  maxValue: number = 0;
  minValue: number = 0;
  labelInterval: number = 50;
  smallScreen: boolean = window.innerWidth < 450;

  rateUnitSub: Subscription;
  weightMode: boolean = false;
  mempoolVsizeFeesOptions: any;
  mempoolVsizeFeesInitOptions = {
    renderer: 'svg'
  };

  constructor(
    public stateService: StateService,
    private vbytesPipe: VbytesPipe,
  ) { }

  ngOnInit() {
    this.rateUnitSub = this.stateService.rateUnits$.subscribe(rateUnits => {
      this.weightMode = rateUnits === 'wu';
      if (this.data) {
        this.mountChart();
      }
    });
  }

  ngOnChanges(): void {
    this.simple = !!this.feeRange?.length;
    this.prepareChart();
    this.mountChart();
  }

  prepareChart(): void {
    if (this.simple) {
      this.data = this.feeRange.map((rate, index) => [index * 10, rate]);
      this.minValue = this.data.length ? this.data.reduce((min, val) => Math.min(min, val[1]), Infinity) : 0;
      this.maxValue = this.data.length ? this.data.reduce((max, val) => Math.max(max, val[1]), 0) : 0;
      this.labelInterval = 1;
      return;
    }
    this.data = [];
    if (!this.transactions?.length) {
      return;
    }
    const samples = [];
    const txs = this.transactions.map(tx => { return { vsize: tx.vsize, rate: tx.rate ?? (tx.fee / tx.vsize) }; }).sort((a, b) => { return b.rate - a.rate; });
    this.maxValue = txs.length ? txs.reduce((max, tx) => Math.max(max, tx.rate), 0) : 0;
    this.minValue = txs.length ? txs.reduce((min, tx) => Math.min(min, tx.rate), Infinity) : 0;
    const maxBlockVSize = this.stateService.env.BLOCK_WEIGHT_UNITS / 4;
    const sampleInterval = maxBlockVSize / this.numSamples;
    let cumVSize = 0;
    let sampleIndex = 0;
    let nextSample = 0;
    let txIndex = 0;
    this.labelInterval = this.numSamples / this.numLabels;
    while (nextSample <= maxBlockVSize) {
      if (txIndex >= txs.length) {
        samples.push([(1 - (sampleIndex / this.numSamples)) * 100, 0.000001]);
        nextSample += sampleInterval;
        sampleIndex++;
        continue;
      }

      while (txs[txIndex] && nextSample < cumVSize + txs[txIndex].vsize) {
        samples.push([(1 - (sampleIndex / this.numSamples)) * 100, txs[txIndex].rate ?? 0.000001]);
        nextSample += sampleInterval;
        sampleIndex++;
      }
      cumVSize += txs[txIndex].vsize;
      txIndex++;
    }
    this.data = samples.reverse();
  }

  mountChart(): void {
    this.mempoolVsizeFeesOptions = {
      grid: {
        height: '210',
        right: this.smallScreen ? '10' : '20',
        top: '22',
        left: this.smallScreen ? '10' : '40',
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        name: '% Weight',
        nameLocation: 'middle',
        nameGap: 0,
        nameTextStyle: {
          verticalAlign: 'top',
          padding: [30, 0, 0, 0],
        },
        axisLabel: {
          interval: (index: number): boolean => { return index && (index % this.labelInterval === 0); },
          formatter: (value: number): string => { return Number(value).toFixed(0); },
        },
        axisTick: {
          interval: (index:number): boolean => { return (index % this.labelInterval === 0); },
        },
      },
      yAxis: {
        type: 'log',
        min: this.minValue >= 1 ? 1 : 0.1,
        max: this.maxValue,
        // name: 'Effective Fee Rate s/vb',
        // nameLocation: 'middle',
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        },
        axisLabel: {
          show: !this.smallScreen,
          formatter: (value: number): string => {
            const unitValue = this.weightMode ? value / 4 : value;
            const selectedPowerOfTen = selectPowerOfTen(unitValue);
            const scaledValue = unitValue / selectedPowerOfTen.divider;
            let newVal = '';
            switch (true) {
              case scaledValue >= 100:
                return Math.round(scaledValue).toString();
              case scaledValue >= 10:
                return scaledValue.toFixed(1);
              default:
                return scaledValue.toFixed(2);
            }
            return `${newVal}${selectedPowerOfTen.unit}`;
          },
        },
        axisTick: {
          show: !this.smallScreen,
        }
      },
      series: [{
        data: this.data,
        type: 'line',
        label: {
          show: true,
          position: 'top',
          color: '#ffffff',
          textShadowBlur: 0,
          fontSize: this.smallScreen ? 10 : 12,
          formatter: (label: { data: number[] }): string => {
            const value = label.data[1];
            const unitValue = this.weightMode ? value / 4 : value;
            const selectedPowerOfTen = selectPowerOfTen(unitValue);
            const scaledValue = unitValue / selectedPowerOfTen.divider;
            const newVal = scaledValue >= 100 ? Math.round(scaledValue) : scaledValue.toPrecision(3);
            return `${newVal}${selectedPowerOfTen.unit}`;
          }
        },
        showAllSymbol: false,
        smooth: true,
        lineStyle: {
          color: '#D81B60',
          width: 1,
        },
        itemStyle: {
          color: '#b71c1c',
          borderWidth: 10,
          borderMiterLimit: 10,
          opacity: 1,
        },
        areaStyle: {
          color: '#D81B60',
          opacity: 1,
        }
      }]
    };
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    const isSmallScreen = window.innerWidth < 450;
    if (this.smallScreen !== isSmallScreen) {
      this.smallScreen = isSmallScreen;
      this.prepareChart();
      this.mountChart();
    }
  }

  ngOnDestroy(): void {
    this.rateUnitSub.unsubscribe();
  }
}
