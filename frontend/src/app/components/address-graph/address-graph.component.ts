import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { echarts, EChartsOption } from '../../graphs/echarts';
import { BehaviorSubject, Observable, Subscription, combineLatest, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AddressTxSummary, ChainStats } from '../../interfaces/electrs.interface';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { AmountShortenerPipe } from '../../shared/pipes/amount-shortener.pipe';
import { Router } from '@angular/router';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '../../services/state.service';
import { PriceService } from '../../services/price.service';
import { FiatCurrencyPipe } from '../../shared/pipes/fiat-currency.pipe';
import { FiatShortenerPipe } from '../../shared/pipes/fiat-shortener.pipe';

const periodSeconds = {
  '1d': (60 * 60 * 24),
  '3d': (60 * 60 * 24 * 3),
  '1w': (60 * 60 * 24 * 7),
  '1m': (60 * 60 * 24 * 30),
  '6m': (60 * 60 * 24 * 180),
  '1y': (60 * 60 * 24 * 365),
};

@Component({
  selector: 'app-address-graph',
  templateUrl: './address-graph.component.html',
  styleUrls: ['./address-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressGraphComponent implements OnChanges, OnDestroy {
  @Input() address: string;
  @Input() isPubkey: boolean = false;
  @Input() stats: ChainStats;
  @Input() addressSummary$: Observable<AddressTxSummary[]> | null;
  @Input() period: '1d' | '3d' | '1w' | '1m' | '6m' | '1y' | 'all' = 'all';
  @Input() height: number = 200;
  @Input() right: number | string = 10;
  @Input() left: number | string = 70;
  @Input() widget: boolean = false;

  data: any[] = [];
  fiatData: any[] = [];
  hoverData: any[] = [];
  showFiat = false;
  conversions: any;
  allowZoom: boolean = false;

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
    private electrsApiService: ElectrsApiService,
    private router: Router,
    private amountShortenerPipe: AmountShortenerPipe,
    private cd: ChangeDetectorRef,
    private relativeUrlPipe: RelativeUrlPipe,
    private priceService: PriceService,
    private fiatCurrencyPipe: FiatCurrencyPipe,
    private fiatShortenerPipe: FiatShortenerPipe,
    private zone: NgZone,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.isLoading = true;
    if (!this.address || !this.stats) {
      return;
    }
    if (changes.address || changes.isPubkey || changes.addressSummary$ || changes.stats) {
      if (this.subscription) {
        this.subscription.unsubscribe();
      }
      this.subscription = combineLatest([
        this.redraw$,
        (this.addressSummary$ || (this.isPubkey
          ? this.electrsApiService.getScriptHashSummary$((this.address.length === 66 ? '21' : '41') + this.address + 'ac')
          : this.electrsApiService.getAddressSummary$(this.address)).pipe(
          catchError(e => {
            this.error = `Failed to fetch address balance history: ${e?.status || ''} ${e?.statusText || 'unknown error'}`;
            return of(null);
          }),
        )),
        this.stateService.conversions$
      ]).pipe(
        switchMap(([redraw, addressSummary, conversions]) => {
          if (addressSummary) {
            return this.priceService.getPriceByBulk$(addressSummary.map(d => d.time), 'USD').pipe(
              tap((prices) => {
                if (prices.length !== addressSummary.length) {
                  addressSummary = addressSummary.map(item => ({ ...item, price: 0 }));
                } else {
                  addressSummary = addressSummary.map((item, index) => {
                    let price = 0;
                    if (prices[index].price) {
                      price = prices[index].price['USD'];
                    } else if (this.conversions && this.conversions['USD']) {
                      price = this.conversions['USD'];
                    }
                    return { ...item, price: price }
                  });
                }
              }),
              map(() => [redraw, addressSummary, conversions])
            )
          } else {
            return of([redraw, addressSummary, conversions]);
          }
        })
      ).subscribe(([redraw, addressSummary, conversions]) => {
        if (addressSummary) {
          this.error = null;
          this.conversions = conversions;
          this.allowZoom = addressSummary.length > 100 && !this.widget;
          this.prepareChartOptions(addressSummary);
        }
        this.isLoading = false;
        this.cd.markForCheck();
      });
    } else {
      // re-trigger subscription
      this.redraw$.next(true);
    }
  }

  prepareChartOptions(summary: AddressTxSummary[]) {
    if (!summary || !this.stats) {
      return;
    }
    
    let total = (this.stats.funded_txo_sum - this.stats.spent_txo_sum);
    const processData = summary.map(d => {
        const balance = total;
        const fiatBalance = total * d.price / 100_000_000;
        total -= d.value;
        d.fiatValue = d.value * d.price / 100_000_000;
        return {
            time: d.time * 1000,
            balance,
            fiatBalance,
            d
        };
    }).reverse();
    
    this.data = processData.map(({ time, balance, d }) => [time, balance, d]);
    this.fiatData = processData.map(({ time, fiatBalance, d }) => [time, fiatBalance, d]);

    if (this.period !== 'all') {
      const now = Date.now();
      const start = now - (periodSeconds[this.period] * 1000);
      this.data = this.data.filter(d => d[0] >= start);
      this.fiatData = this.fiatData.filter(d => d[0] >= start);
      this.data.push(
        {value: [now, this.stats.funded_txo_sum - this.stats.spent_txo_sum], symbol: 'none', tooltip: { show: false }}
      );
      this.fiatData.push(
        {value: [now, this.fiatData[this.fiatData.length - 1][1]], symbol: 'none', tooltip: { show: false }}
      );
    }

    const maxValue = this.data.reduce((acc, d) => Math.max(acc, Math.abs(d[1] ?? d.value[1])), 0);
    const minValue = this.data.reduce((acc, d) => Math.min(acc, Math.abs(d[1] ?? d.value[1])), maxValue);

    this.chartOptions = {
      color: [
        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#FDD835' },
          { offset: 1, color: '#FB8C00' },
        ]),
        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#4CAF50' },
          { offset: 1, color: '#1B5E20' },
        ]),
      ],
      animation: false,
      grid: {
        top: 20,
        bottom: this.allowZoom ? 65 : 20,
        right: this.right,
        left: this.left,
      },
      legend: {
        data: [
          {
            name: $localize`:@@7e69426bd97a606d8ae6026762858e6e7c86a1fd:Balance`,
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Fiat',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          }
        ],
        selected: {
          'Balance': !this.showFiat,
          'Fiat': this.showFiat
        },
        selectedMode: 'single',
        formatter: function (name) {
          return name === 'Fiat' ? 'USD' : 'BTC';
        }
      },
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
        formatter: function (data): string {
          if (!data?.length || !data[0]?.data?.[2]?.txid) {
            return '';
          }
          const header = data.length === 1
            ? `${data[0].data[2].txid.slice(0, 6)}...${data[0].data[2].txid.slice(-6)}`
            : `${data.length} transactions`;
          const date = new Date(data[0].data[0]).toLocaleTimeString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          if (this.showFiat) {
            const val = data.reduce((total, d) => total + d.data[2].fiatValue, 0);
            const color = val === 0 ? '' : (val > 0 ? 'var(--green)' : 'var(--red)');
            const symbol = val > 0 ? '+' : '';
            return `
              <div>
                <span><b>${header}</b></span>
                <div style="text-align: right;">
                  <span style="color: ${color}">${symbol} ${this.fiatCurrencyPipe.transform(val, null, 'USD')}</span><br>
                  <span>${this.fiatCurrencyPipe.transform(data[0].data[1], null, 'USD')}</span>
                </div>
                <span>${date}</span>
              </div>
            `;
          } else {
            const val = data.reduce((total, d) => total + d.data[2].value, 0);
            const color = val === 0 ? '' : (val > 0 ? 'var(--green)' : 'var(--red)');
            const symbol = val > 0 ? '+' : '';
            return `
              <div>
                <span><b>${header}</b></span>
                <div style="text-align: right;">
                  <span style="color: ${color}">${symbol} ${(val / 100_000_000).toFixed(8)} BTC</span><br>
                  <span>${(data[0].data[1] / 100_000_000).toFixed(8)} BTC</span>
                </div>
                <span>${date}</span>
              </div>
            `;
          }
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
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              let valSpan = maxValue - (this.period === 'all' ? 0 : minValue);
              if (valSpan > 100_000_000_000) {
                return `${this.amountShortenerPipe.transform(Math.round(val / 100_000_000), 0)} BTC`;
              }
              else if (valSpan > 1_000_000_000) {
                return `${this.amountShortenerPipe.transform(Math.round(val / 100_000_000), 2)} BTC`;
              } else if (valSpan > 100_000_000) {
                return `${(val / 100_000_000).toFixed(1)} BTC`;
              } else if (valSpan > 10_000_000) {
                return `${(val / 100_000_000).toFixed(2)} BTC`;
              } else if (valSpan > 1_000_000) {
                return `${(val / 100_000_000).toFixed(3)} BTC`;
              } else {
                return `${this.amountShortenerPipe.transform(val, 0)} sats`;
              }
            }
          },
          splitLine: {
            show: false,
          },
          min: this.period === 'all' ? 0 : 'dataMin'
        },
        {
          type: 'value',
          position: 'left',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: function(val) {
              return this.fiatShortenerPipe.transform(val, null, 'USD');
            }.bind(this)
          },
          splitLine: {
            show: false,
          },
          min: this.period === 'all' ? 0 : 'dataMin'
        },
      ],
      series: [
        {
          name: $localize`:@@7e69426bd97a606d8ae6026762858e6e7c86a1fd:Balance`,
          yAxisIndex: 0,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          data: this.data,
          areaStyle: {
            opacity: 0.5,
          },
          triggerLineEvent: true,
          type: 'line',
          smooth: false,
          step: 'end'
        }, 
        {
          name: 'Fiat',
          yAxisIndex: 1,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 8,
          data: this.fiatData,
          areaStyle: {
            opacity: 0.5,
          },
          triggerLineEvent: true,
          type: 'line',
          smooth: false,
          step: 'end'
        }
      ],
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
        left: this.left,
        right: this.right,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
        },
      }] : undefined
    };
  }

  onChartClick(e) {
    if (this.hoverData?.length && this.hoverData[0]?.[2]?.txid) {
      this.zone.run(() => { 
        const url = this.relativeUrlPipe.transform(`/tx/${this.hoverData[0][2].txid}`);
        if (e.event.event.shiftKey || e.event.event.ctrlKey || e.event.event.metaKey) {
          window.open(url);
        } else {
          this.router.navigate([url]);
        }
      });
    }
  }

  onTooltip(e) {
    this.hoverData = (e?.dataByCoordSys?.[0]?.dataByAxis?.[0]?.seriesDataIndices || []).map(indices => this.data[indices.dataIndex]);
  }

  onLegendSelectChanged(e) {
    this.showFiat = e.name === 'Fiat';
  }

  onChartInit(ec) {
    this.chartInstance = ec;
    this.chartInstance.on('showTip', this.onTooltip.bind(this));
    this.chartInstance.on('click', 'series', this.onChartClick.bind(this));
    this.chartInstance.on('legendselectchanged', this.onLegendSelectChanged.bind(this));
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
