import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { BehaviorSubject, Observable, Subscription, combineLatest, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AddressTxSummary, ChainStats } from '@interfaces/electrs.interface';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { Router } from '@angular/router';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { PriceService } from '@app/services/price.service';
import { FiatCurrencyPipe } from '@app/shared/pipes/fiat-currency.pipe';

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
      z-index: 99;
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
  @Input() defaultFiat: boolean = false;
  @Input() showLegend: boolean = true;
  @Input() showYAxis: boolean = true;

  adjustedLeft: number;
  adjustedRight: number;
  data: any[] = [];
  fiatData: any[] = [];
  hoverData: any[] = [];
  conversions: any;
  allowZoom: boolean = false;

  selected = { [$localize`:@@7e69426bd97a606d8ae6026762858e6e7c86a1fd:Balance`]: true, 'Fiat': false };

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
    private zone: NgZone,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.isLoading = true;
    if (!this.addressSummary$ && (!this.address || !this.stats)) {
      return;
    }
    if (changes.defaultFiat) {
      this.selected['Fiat'] = !!this.defaultFiat;
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
          this.conversions = conversions;
          if (addressSummary) {
            let extendedSummary = this.extendSummary(addressSummary);
            return this.priceService.getPriceByBulk$(extendedSummary.map(d => d.time), 'USD').pipe(
              tap((prices) => {
                if (prices.length !== extendedSummary.length) {
                  extendedSummary = extendedSummary.map(item => ({ ...item, price: 0 }));
                } else {
                  extendedSummary = extendedSummary.map((item, index) => {
                    let price = 0;
                    if (prices[index].price) {
                      price = prices[index].price['USD'];
                    } else if (this.conversions && this.conversions['USD']) {
                      price = this.conversions['USD'];
                    }
                    return { ...item, price: price };
                  });
                }
              }),
              map(() => [redraw, extendedSummary, conversions])
            )
          } else {
            return of([redraw, addressSummary, conversions]);
          }
        })
      ).subscribe(([redraw, addressSummary, conversions]) => {
        if (addressSummary) {
          this.error = null;
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
    if (!summary) {
      return;
    }

    const total = this.stats ? (this.stats.funded_txo_sum - this.stats.spent_txo_sum) : summary.reduce((acc, tx) => acc + tx.value, 0);
    let runningTotal = total;
    const processData = summary.map(d => {
        const balance = runningTotal;
        const fiatBalance = runningTotal * d.price / 100_000_000;
        runningTotal -= d.value;
        return {
            time: d.time * 1000,
            balance,
            fiatBalance,
            d
        };
    }).reverse();

    this.data = processData.filter(({ d }) => d.txid !== undefined).map(({ time, balance, d }) => [time, balance, d]);
    this.fiatData = processData.map(({ time, fiatBalance, balance, d }) => [time, fiatBalance, d, balance]);

    const now = Date.now();
    if (this.period !== 'all') {
      const start = now - (periodSeconds[this.period] * 1000);
      this.data = this.data.filter(d => d[0] >= start);
      const startFiat = this.data[0]?.[0] ?? start; // Make sure USD data starts at the same time as BTC data
      this.fiatData = this.fiatData.filter(d => d[0] >= startFiat);
    }
    this.data.push(
      {value: [now, total], symbol: 'none', tooltip: { show: false }}
    );

    const maxValue = this.data.reduce((acc, d) => Math.max(acc, Math.abs(d[1] ?? d.value[1])), 0);
    const minValue = this.data.reduce((acc, d) => Math.min(acc, Math.abs(d[1] ?? d.value[1])), maxValue);

    this.adjustedRight = this.selected['Fiat'] ? +this.right + 40 : +this.right;
    this.adjustedLeft = this.selected[$localize`:@@7e69426bd97a606d8ae6026762858e6e7c86a1fd:Balance`] ? +this.left : +this.left - 40;

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
        right: this.adjustedRight,
        left: this.adjustedLeft,
      },
      legend: (this.showLegend && !this.stateService.isAnyTestnet()) ? {
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
        selected: this.selected,
        formatter: function (name) {
          return name === 'Fiat' ? 'USD' : 'BTC';
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
          const btcData = data.filter(d => d.seriesName !== 'Fiat');
          const fiatData = data.filter(d => d.seriesName === 'Fiat');
          data = btcData.length ? btcData : fiatData;
          if ((!btcData.length || !btcData[0]?.data?.[2]?.txid) && !fiatData.length) {
            return '';
          }
          let tooltip = '<div>';

          const hasTx = data[0].data[2].txid;
          const date = new Date(data[0].data[0]).toLocaleTimeString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          tooltip += `<div>
            <div style="text-align: right;">
            <div><b>${date}</b></div>`;

          if (hasTx) {
            const header = data.length === 1
            ? `${data[0].data[2].txid.slice(0, 6)}...${data[0].data[2].txid.slice(-6)}`
            : `${data.length} transactions`;
            tooltip += `<div><b>${header}</b></div>`;
          }

          const formatBTC = (val, decimal) => (val / 100_000_000).toFixed(decimal);
          const formatFiat = (val) => this.fiatCurrencyPipe.transform(val, null, 'USD');

          const btcVal = btcData.reduce((total, d) => total + d.data[2].value, 0);
          const fiatVal = fiatData.reduce((total, d) => total + d.data[2].value * d.data[2].price / 100_000_000, 0);
          const btcColor = btcVal === 0 ? '' : (btcVal > 0 ? 'var(--green)' : 'var(--red)');
          const fiatColor = fiatVal === 0 ? '' : (fiatVal > 0 ? 'var(--green)' : 'var(--red)');
          const btcSymbol = btcVal > 0 ? '+' : '';
          const fiatSymbol = fiatVal > 0 ? '+' : '';

          if (btcData.length && fiatData.length) {
            tooltip += `<div style="display: flex; justify-content: space-between; color: ${btcColor}">
              <span style="text-align: left; margin-right: 10px;">${btcSymbol} ${formatBTC(btcVal, 4)} BTC</span>
              <span style="text-align: right;">${fiatSymbol} ${formatFiat(fiatVal)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="text-align: left; margin-right: 10px;">${formatBTC(btcData[0].data[1], 4)} BTC</span>
              <span style="text-align: right;">${formatFiat(fiatData[0].data[1])}</span>
            </div>`;
          } else if (btcData.length) {
            tooltip += `<span style="color: ${btcColor}">${btcSymbol} ${formatBTC(btcVal, 8)} BTC</span><br>
              <span>${formatBTC(data[0].data[1], 8)} BTC</span>`;
          } else {
            if (this.selected[$localize`:@@7e69426bd97a606d8ae6026762858e6e7c86a1fd:Balance`]) {
              tooltip += `<div style="display: flex; justify-content: space-between;">
                <span style="text-align: left; margin-right: 10px;">${formatBTC(data[0].data[3], 4)} BTC</span>
                <span style="text-align: right;">${formatFiat(data[0].data[1])}</span>
              </div>`;
            } else {
              tooltip += `${hasTx ? `<span style="color: ${fiatColor}">${fiatSymbol} ${formatFiat(fiatVal)}</span><br>` : ''}
              <span>${formatFiat(data[0].data[1])}</span>`;
            }
          }

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
                if (maxValue > 100_000_000_000) {
                  return `${this.amountShortenerPipe.transform(Math.round(val / 100_000_000), 3, undefined, true)} BTC`;
                }
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
        },
        {
          type: 'value',
          axisLabel: {
            show: this.showYAxis,
            color: 'rgb(110, 112, 121)',
            formatter: function(val) {
              return `$${this.amountShortenerPipe.transform(val, 3, undefined, true, true)}`;
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
        }, !this.stateService.isAnyTestnet() ?
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
        } : undefined
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
    this.selected = e.selected;
    this.adjustedRight = this.selected['Fiat'] ? +this.right + 40 : +this.right;
    this.adjustedLeft = this.selected[$localize`:@@7e69426bd97a606d8ae6026762858e6e7c86a1fd:Balance`] ? +this.left : +this.left - 40;

    this.chartOptions = {
      grid: {
        right: this.adjustedRight,
        left: this.adjustedLeft,
      },
      legend: {
        selected: this.selected,
      },
      dataZoom: this.allowZoom ? [{
        left: this.adjustedLeft,
        right: this.adjustedRight,
      }, {
        left: this.adjustedLeft,
        right: this.adjustedRight,
      }] : undefined
    };

    if (this.chartInstance) {
      this.chartInstance.setOption(this.chartOptions);
    }
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

  extendSummary(summary) {
    const extendedSummary = summary.slice();

    // Add a point at today's date to make the graph end at the current time
    extendedSummary.unshift({ time: Date.now() / 1000, value: 0 });

    let maxTime = Date.now() / 1000;

    const oneHour = 60 * 60;
    // Fill gaps longer than interval
    for (let i = 0; i < extendedSummary.length - 1; i++) {
      if (extendedSummary[i].time > maxTime) {
        extendedSummary[i].time = maxTime - 30;
      }
      maxTime = extendedSummary[i].time;
      const hours = Math.floor((extendedSummary[i].time - extendedSummary[i + 1].time) / oneHour);
      if (hours > 1) {
        for (let j = 1; j < hours; j++) {
          const newTime = extendedSummary[i].time - oneHour * j;
          extendedSummary.splice(i + j, 0, { time: newTime, value: 0 });
        }
        i += hours - 1;
      }
    }

    return extendedSummary;
  }
}
