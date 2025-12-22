import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit, AfterViewInit, HostListener, ChangeDetectorRef } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { ActivatedRoute } from '@angular/router';
import { FiatShortenerPipe } from '@app/shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from '@app/shared/pipes/fiat-currency.pipe';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-price-chart',
  templateUrl: './price-chart.component.html',
  styleUrls: ['./price-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceChartComponent implements OnInit, AfterViewInit {
  @Input() widget = false;
  @Input() height: number = 300;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;
  @Input() timespan: string = '';
  @Input() currency: string = 'USD';

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  chartInstance: any = undefined;
  currentTimespan = '';

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private route: ActivatedRoute,
    private fiatShortenerPipe: FiatShortenerPipe,
    private fiatCurrencyPipe: FiatCurrencyPipe,
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    // Use input timespan if provided, otherwise use defaults
    if (this.timespan) {
      this.miningWindowPreference = this.timespan;
    } else if (this.widget) {
      this.miningWindowPreference = '1y';
    } else {
      this.seoService.setTitle($localize`:@@price-chart.title:Bitcoin Price`);
      this.seoService.setDescription($localize`:@@price-chart.description:See the Bitcoin price in USD visualized over time.`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          this.isLoading = true;
          if (!this.widget) {
            this.storageService.setValue('miningWindowPreference', timespan);
          }
          this.currentTimespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockFees$(timespan)
            .pipe(
              tap((response) => {
                this.prepareChartOptions({
                  priceData: response.body.filter(val => val[this.currency] > 0).map(val => [val.timestamp * 1000, val[this.currency], val.avgHeight]),
                });
                this.isLoading = false;
              }),
              map((response) => {
                const priceData = response.body.filter(val => val[this.currency] > 0);
                const latestPrice = priceData.length > 0 ? priceData[priceData.length - 1][this.currency] : null;
                const firstPrice = priceData.length > 0 ? priceData[0][this.currency] : null;
                const percentChange = (latestPrice && firstPrice) ? ((latestPrice - firstPrice) / firstPrice) * 100 : 0;

                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                  latestPrice: latestPrice,
                  percentChange: percentChange,
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.priceData.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      color: [
        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#C0CA33' },
          { offset: 1, color: '#1B5E20' },
        ]),
      ],
      animation: false,
      grid: {
        height: (this.widget && this.height) ? this.height - 30 : undefined,
        top: this.widget ? 20 : 30,
        bottom: this.widget ? 30 : 80,
        right: this.right,
        left: this.left,
      },
      tooltip: {
        show: !this.isMobile() || !this.widget,
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (data) {
          if (data.length <= 0) {
            return '';
          }
          let tooltip = `<b style="color: white; margin-left: 2px">
            ${formatterXAxis(this.locale, this.currentTimespan, parseInt(data[0].axisValue, 10))}</b><br>`;

          for (const tick of data) {
            tooltip += `${tick.marker} ${tick.seriesName}: ${this.fiatCurrencyPipe.transform(tick.data[1], null, this.currency)}<br>`;
          }

          tooltip += `<small>* On average around block ${data[0].data[2]}</small>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: data.priceData.length === 0 ? undefined :
      {
        type: 'time',
        splitNumber: (this.isMobile() || this.widget) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      // legend: data.priceData.length === 0 ? undefined : {
      //   data: [
      //     {
      //       name: 'BTC Price (' + this.currency + ')',
      //       inactiveColor: 'rgb(110, 112, 121)',
      //       textStyle: {
      //         color: 'white',
      //       },
      //       icon: 'roundRect',
      //     },
      //   ],
      // },
      yAxis: data.priceData.length === 0 ? undefined : [
        {
          type: 'value',
          min: 'dataMin',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: function(val) {
              return this.fiatShortenerPipe.transform(val, null, this.currency);
            }.bind(this)
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            }
          },
        },
      ],
      series: data.priceData.length === 0 ? undefined : [
        {
          // legendHoverLink: false,
          zlevel: 0,
          yAxisIndex: 0,
          name: 'BTC Price (' + this.currency + ')',
          data: data.priceData,
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: {
            width: 2,
            opacity: 1,
          }
        },
      ],
      dataZoom: (this.widget || data.priceData.length === 0) ? undefined : [{
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
        left: 20,
        right: 15,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
          areaStyle: {
            opacity: 0,
          }
        },
      }],
    };
  }

  onChartInit(ec) {
    this.chartInstance = ec;
    // Resize chart after initialization to ensure correct dimensions
    setTimeout(() => {
      if (this.chartInstance) {
        this.chartInstance.resize();
      }
    }, 0);
  }

  ngAfterViewInit(): void {
    // Resize chart after view initialization to handle initial screen size
    setTimeout(() => {
      if (this.chartInstance) {
        this.chartInstance.resize();
        this.cd.markForCheck();
      }
    }, 100);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (this.chartInstance) {
      this.chartInstance.resize();
      this.cd.markForCheck();
    }
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  onSaveChart() {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `btc-price-${this.currentTimespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}