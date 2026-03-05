import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
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
import { ActivatedRoute, Router } from '@angular/router';
import { FiatShortenerPipe } from '@app/shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from '@app/shared/pipes/fiat-currency.pipe';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-block-fees-graph',
  templateUrl: './block-fees-graph.component.html',
  styleUrls: ['./block-fees-graph.component.scss'],
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
export class BlockFeesGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  logScale = false;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;
  scaleForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  currency: string;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private route: ActivatedRoute,
    private router: Router,
    private fiatShortenerPipe: FiatShortenerPipe,
    private fiatCurrencyPipe: FiatCurrencyPipe,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
    this.scaleForm = this.formBuilder.group({scaleFunction: 'linear'});
    this.currency = 'USD';
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@6c453b11fd7bd159ae30bc381f367bc736d86909:Block Fees`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.block-fees:See the average mining fees earned per Bitcoin block visualized in BTC and USD over time.`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (!fragment) {
          return;
        }

        let timeVal = null;
        let scaleVal = null;

        if (fragment.includes('=')) {
          const params = new URLSearchParams(fragment);
          timeVal = params.get('time');
          scaleVal = params.get('scale');
        } else {
          if (['1m', '3m', '6m', '1y', '2y', '3y', 'all'].includes(fragment)) {
            timeVal = fragment;
          }
          if (['linear', 'log'].includes(fragment)) {
            scaleVal = fragment;
          }
        }
        
        if (timeVal && ['1m', '3m', '6m', '1y', '2y', '3y', 'all'].includes(timeVal)) {
          this.radioGroupForm.controls.dateSpan.setValue(timeVal, { emitEvent: false });
        }

        if (scaleVal && ['linear', 'log'].includes(scaleVal)) {
          this.scaleForm.controls.scaleFunction.setValue(scaleVal, { emitEvent: false });
          this.onScaleChange();
        }
      });

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          this.isLoading = true;
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.isLoading = true;

          this.updateUrlFragment();
          return this.apiService.getHistoricalBlockFees$(timespan)
            .pipe(
              tap((response) => {
                const clampSats = (val: number) => this.logScale ? Math.max(val, 1) : val;
                this.prepareChartOptions({
                  blockFees: response.body.map(val => [val.timestamp * 1000, clampSats(val.avgFees) / 100000000, val.avgHeight, val.avgFees / 100000000]),
                  blockFeesFiat: response.body.filter(val => val[this.currency] > 0).map(val => [val.timestamp * 1000, clampSats(val.avgFees) / 100000000 * val[this.currency], val.avgHeight, val.avgFees / 100000000 * val[this.currency]]),
                });
                this.isLoading = false;
              }),
              map((response) => {
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.blockFees.length === 0) {
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
          { offset: 0, color: '#FDD835' },
          { offset: 1, color: '#FB8C00' },
        ]),
        new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#C0CA33' },
          { offset: 1, color: '#1B5E20' },
        ]),
      ],
      animation: false,
      grid: {
        top: 30,
        bottom: 80,
        right: this.right,
        left: this.left,
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
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (data) {
          if (data.length <= 0) {
            return '';
          }
          let tooltip = `<b style="color: white; margin-left: 2px">
            ${formatterXAxis(this.locale, this.timespan, parseInt(data[0].axisValue, 10))}</b><br>`;

          for (const tick of data) {
            if (tick.seriesIndex === 0) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[3], this.locale, '1.3-3')} BTC<br>`;
            } else if (tick.seriesIndex === 1) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${this.fiatCurrencyPipe.transform(tick.data[3], null, this.currency) }<br>`;
            }
          }

          tooltip += `<small>* On average around block ${data[0].data[2]}</small>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: data.blockFees.length === 0 ? undefined :
      {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: data.blockFees.length === 0 ? undefined : {
        data: [
          {
            name: 'Fees BTC',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Fees ' + this.currency,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
      },
      yAxis: data.blockFees.length === 0 ? undefined : [
        {
          type: this.logScale ? 'log' : 'value',
          min: this.logScale ? 0.001 : undefined,
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val} BTC`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            }
          },
        },
        {
          type: this.logScale ? 'log' : 'value',
          min: this.logScale ? 0.01 : undefined,
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: function(val) {
              return this.fiatShortenerPipe.transform(val, null, this.currency);
            }.bind(this)
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: data.blockFees.length === 0 ? undefined : [
        {
          legendHoverLink: false,
          zlevel: 0,
          yAxisIndex: 0,
          name: 'Fees BTC',
          data: data.blockFees,
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: {
            width: 1,
            opacity: 1,
          }
        },
        {
          legendHoverLink: false,
          zlevel: 1,
          yAxisIndex: 1,
          name: 'Fees ' + this.currency,
          data: data.blockFeesFiat,
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: {
            width: 2,
            opacity: 1,
          }
        },
      ],
      dataZoom: data.blockFees.length === 0 ? undefined : [{
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
    }), `block-fees-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  updateUrlFragment() {
    const time = this.radioGroupForm.controls.dateSpan.value;
    const scale = this.scaleForm.controls.scaleFunction.value;
    const newFragment = `time=${time}&scale=${scale}`;

    if (this.route.snapshot.fragment !== newFragment) {
      this.router.navigate([], {
        relativeTo: this.route,
        fragment: newFragment,
        replaceUrl: true
      })
    }
  }

  onScaleChange() {
    this.logScale = this.scaleForm.get('scaleFunction')?.value === 'log';
    this.updateUrlFragment();

    if (!this.chartInstance || !this.chartOptions.yAxis) {
      return;
    }

    const yAxes = this.chartOptions.yAxis as any[];

    yAxes[0].type = this.logScale ? 'log' : 'value';
    yAxes[0].min = this.logScale ? 0.001 : undefined;

    yAxes[1].type = this.logScale ? 'log' : 'value';
    yAxes[1].min = this.logScale ? 0.01 : undefined;

    (this.chartOptions.series as any[]).forEach((seriesItem, index) => {
      seriesItem.data.forEach(point => {
        if (index === 0) {
          point [1] = this.logScale ? Math.max(point[3], 0.001) : point[3];
        } else if (index === 1) {
          point [1] = this.logScale ? Math.max(point[3], 0.01) : point[3];
        }
      });
    })

    this.chartInstance.setOption({
      yAxis: yAxes,
      series: this.chartOptions.series
    });
  }
}
