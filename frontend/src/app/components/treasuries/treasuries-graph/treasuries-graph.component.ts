import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { BehaviorSubject, Observable, Subscription, combineLatest } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AddressTxSummary } from '@interfaces/electrs.interface';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { StateService } from '@app/services/state.service';
import { SeriesOption } from 'echarts';
import { WalletStats } from '@app/shared/wallet-stats';
import { originalChartColors as chartColors } from '@app/app.constants';
import { Treasury } from '@interfaces/node-api.interface';


// export const treasuriesPalette = [
//   '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
// ];

const periodSeconds = {
  '1d': (60 * 60 * 24),
  '3d': (60 * 60 * 24 * 3),
  '1w': (60 * 60 * 24 * 7),
  '1m': (60 * 60 * 24 * 30),
  '6m': (60 * 60 * 24 * 180),
  '1y': (60 * 60 * 24 * 365),
};

@Component({
  selector: 'app-treasuries-graph',
  templateUrl: './treasuries-graph.component.html',
  styleUrls: ['./treasuries-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreasuriesGraphComponent implements OnInit, OnChanges, OnDestroy {
  @Input() walletStats: Record<string, WalletStats>;
  @Input() walletSummaries$: Observable<Record<string, AddressTxSummary[]>>;
  @Input() selectedWallets: Record<string, boolean> = {};
  @Input() treasuries: Treasury[] = [];
  @Input() height: number = 400;
  @Input() right: number | string = 10;
  @Input() left: number | string = 70;
  @Input() showLegend: boolean = true;
  @Input() showYAxis: boolean = true;
  @Input() widget: boolean = false;
  @Input() allowZoom: boolean = false;
  @Input() period: '1d' | '3d' | '1w' | '1m' | '6m' | '1y' | 'all' = 'all';

  adjustedLeft: number = 70;
  adjustedRight: number = 10;
  walletData: Record<string, any[]> = {};
  seriesNameToLabel: Record<string, string> = {};
  hoverData: any[] = [];

  subscription: Subscription;
  redraw$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  error: any;
  isLoading = true;
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    public stateService: StateService,
    private amountShortenerPipe: AmountShortenerPipe,
    private cd: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.isLoading = true;
    this.setupSubscription();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.adjustedRight = +this.right;
    this.adjustedLeft = +this.left;

    if (changes.walletSummaries$ || changes.selectedWallets || changes.period) {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      this.setupSubscription();
    } else {
      // re-trigger subscription
      this.redraw$.next(true);
    }
  }

  setupSubscription(): void {
    this.subscription = combineLatest([
      this.redraw$,
      this.walletSummaries$
    ]).pipe(
      tap(([_, walletSummaries]) => {
        if (walletSummaries) {
          this.error = null;
          this.processWalletData(walletSummaries);
          this.prepareChartOptions();
        }
        this.isLoading = false;
        this.cd.markForCheck();
      })
    ).subscribe();
  }

  processWalletData(walletSummaries: Record<string, AddressTxSummary[]>): void {
    this.walletData = {};

    this.treasuries.forEach(treasury => {
      if (!walletSummaries[treasury.wallet] || !walletSummaries[treasury.wallet].length) return;

      const total = this.walletStats[treasury.wallet] ? this.walletStats[treasury.wallet].balance : walletSummaries[treasury.wallet].reduce((acc, tx) => acc + tx.value, 0);

      let runningTotal = total;
      const processedData = walletSummaries[treasury.wallet].map(tx => {
        const balance = runningTotal;
        runningTotal -= tx.value;
        return {
          time: tx.time * 1000,
          balance,
          tx
        };
      }).reverse();

      this.walletData[treasury.wallet] = processedData
        .filter(({ tx }) => tx.txid !== undefined)
        .map(({ time, balance, tx }) => [time, balance, tx]);

      if (this.period !== 'all') {
        const now = Date.now();
        const start = now - (periodSeconds[this.period] * 1000);

        const fullData = [...this.walletData[treasury.wallet]];

        this.walletData[treasury.wallet] = this.walletData[treasury.wallet].filter(d => d[0] >= start);

        if (this.walletData[treasury.wallet].length === 0 || this.walletData[treasury.wallet][0][0] > start) {
          // Find the most recent balance at or before the period start
          let startBalance = 0;
          for (let i = fullData.length - 1; i >= 0; i--) {
            if (fullData[i][0] <= start) {
              startBalance = fullData[i][1];
              break;
            }
          }

          // Add a data point at the period start with the correct historical balance
          this.walletData[treasury.wallet].unshift([start, startBalance, { placeholder: true }]);
        }
      }

      // Add current point
      this.walletData[treasury.wallet].push([Date.now(), total, { current: true }]);
    });
  }

  prepareChartOptions(): void {
    // Prepare legend data

    this.seriesNameToLabel = {};
    for (const treasury of this.treasuries) {
      this.seriesNameToLabel[treasury.wallet] = treasury.name || treasury.enterprise || treasury.wallet;
    }

    const legendData = this.treasuries.map(treasury => ({
      name: treasury.wallet,
      inactiveColor: 'var(--grey)',
      textStyle: {
        color: 'white',
      },
      icon: 'roundRect',
    }));

    // Calculate min and max values across all wallets
    let maxValue = 0;
    let minValue = Number.MAX_SAFE_INTEGER;

    this.treasuries.forEach(treasury => {
      const data = this.walletData[treasury.wallet];
      if (data) {
        data.forEach(point => {
          const value = point[1] || (point.value && point.value[1]) || 0;
          maxValue = Math.max(maxValue, Math.abs(value));
          minValue = Math.min(minValue, Math.abs(value));
        });
      }
    });

    if (minValue === Number.MAX_SAFE_INTEGER) {
      minValue = 0;
    }

    // Prepare series data
    const series: SeriesOption[] = this.treasuries.map((treasury, index) => ({
      name: treasury.wallet,
      yAxisIndex: 0,
      showSymbol: false,
      symbol: 'circle',
      symbolSize: 8,
      data: this.walletData[treasury.wallet] || [],
      areaStyle: undefined,
      triggerLineEvent: true,
      type: 'line',
      smooth: false,
      step: 'end'
    }));

    this.chartOptions = {
      color: chartColors,
      animation: false,
      grid: {
        top: 20,
        bottom: this.allowZoom ? 65 : 20,
        right: this.adjustedRight,
        left: this.adjustedLeft,
      },
      legend: this.showLegend ? {
        data: legendData,
        selected: this.selectedWallets,
        formatter: (name) => {
          return this.seriesNameToLabel[name];
        }
      } : undefined,
      tooltip: {
        show: !this.isMobile(),
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (data) {
          if (!data.length) {
            return '';
          }

          // Get the current x-axis timestamp from the hovered point
          const tooltipTime = data[0].data[0];

          let tooltip = '<div>';
          const date = new Date(tooltipTime).toLocaleTimeString(this.locale, { 
            year: 'numeric', month: 'short', day: 'numeric' 
          });

          tooltip += `<div><b style="color: white; margin-left: 2px">${date}</b><br>`;

          // Get all active wallet IDs from the selected wallets
          const activeTreasuries: { treasury: Treasury, index: number }[] = this.treasuries
            .map((treasury, index) => ({ treasury, index }))
            .filter(({ treasury }) => this.selectedWallets[treasury.wallet] && this.walletData[treasury.wallet]);

          // For each active wallet, find and display the most recent balance
          activeTreasuries.forEach(({ treasury, index }) => {
            const walletPoints = this.walletData[treasury.wallet];
            if (!walletPoints || !walletPoints.length) {
              return;
            }

            // Find the most recent data point at or before the tooltip time
            let mostRecentPoint: any = null;
            for (let i = 0; i < walletPoints.length; i++) {
              const point: any = walletPoints[i];
              const pointTime = Array.isArray(point) ? point[0] :
                (point && typeof point === 'object' && 'value' in point ? point.value[0] : null);

              if (pointTime && pointTime <= tooltipTime) {
                mostRecentPoint = point;
              }

              // Stop once we pass the tooltip time
              if (pointTime && pointTime > tooltipTime) {
                break;
              }
            }

            if (mostRecentPoint) {
              // Extract balance from the point
              const balance = Array.isArray(mostRecentPoint) ? mostRecentPoint[1] : 
                (mostRecentPoint && typeof mostRecentPoint === 'object' && 'value' in mostRecentPoint ? mostRecentPoint.value[1] : null);

              if (balance !== null && !isNaN(balance)) {
                const markerColor = chartColors[index % chartColors.length];

                const marker = `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${markerColor};"></span>`;

                tooltip += `<div style="display: flex; justify-content: space-between;">
                  <span style="text-align: left; margin-right: 10px;">${marker} ${treasury.name || treasury.enterprise || treasury.wallet}:</span>
                  <span style="text-align: right;">${this.formatBTC(balance)}</span>
                </div>`;
              }
            }
          });

          tooltip += `</div></div>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      yAxis: [
        {
          type: 'value',
          position: 'left',
          axisLabel: {
            show: this.showYAxis,
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              let valSpan = maxValue - (this.period === 'all' ? 0 : minValue);
              if (valSpan > 100_000_000_000) {
                return `${this.amountShortenerPipe.transform(Math.round(val / 100_000_000), 0, undefined, true)} BTC`;
              }
              else if (valSpan > 1_000_000_000) {
                return `${this.amountShortenerPipe.transform(Math.round(val / 100_000_000), 2, undefined, true)} BTC`;
              } else if (valSpan > 100_000_000) {
                return `${(val / 100_000_000).toFixed(1)} BTC`;
              } else if (valSpan > 10_000_000) {
                return `${(val / 100_000_000).toFixed(2)} BTC`;
              } else if (valSpan > 1_000_000) {
                return `${(val / 100_000_000).toFixed(3)} BTC`;
              } else {
                return `${this.amountShortenerPipe.transform(val, 0, undefined, true)} sats`;
              }
            }
          },
          splitLine: {
            show: false,
          },
          min: this.period === 'all' ? 0 : 'dataMin'
        }
      ],
      series: series,
      dataZoom: this.allowZoom ? [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 5,
        moveOnMouseMove: false,
      }, {
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        left: this.adjustedLeft,
        right: this.adjustedRight,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
        },
      }] : undefined
    };
  }

  formatBTC(val: number): string {
    return `${(val / 100_000_000).toFixed(4)} BTC`;
  }

  onChartInit(ec) {
    this.chartInstance = ec;
    this.chartInstance.on('legendselectchanged', this.onLegendSelectChanged.bind(this));
  }

  onLegendSelectChanged(e) {
    this.selectedWallets = e.selected;

    this.chartOptions = {
      legend: {
        selected: this.selectedWallets,
      }
    };

    if (this.chartInstance) {
      this.chartInstance.setOption(this.chartOptions);
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}