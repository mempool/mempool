import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis } from '@app/shared/graphs.utils';
import { MiningService } from '@app/services/mining.service';
import { StorageService } from '@app/services/storage.service';
import { ActivatedRoute } from '@angular/router';
import { FiatShortenerPipe } from '@app/shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from '@app/shared/pipes/fiat-currency.pipe';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-block-rewards-graph',
  templateUrl: './block-rewards-graph.component.html',
  styleUrls: ['./block-rewards-graph.component.scss'],
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
export class BlockRewardsGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

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
    private miningService: MiningService,
    private storageService: StorageService,
    public stateService: StateService,
    private route: ActivatedRoute,
    private fiatShortenerPipe: FiatShortenerPipe,
    private fiatCurrencyPipe: FiatCurrencyPipe,
  ) {
    this.currency = 'USD';
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@8ba8fe810458280a83df7fdf4c614dfc1a826445:Block Rewards`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.block-rewards:See Bitcoin block rewards in BTC and USD visualized over time. Block rewards are the total funds miners earn from the block subsidy and fees.`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('3m');
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
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockRewards$(timespan)
            .pipe(
              tap((response) => {
                this.prepareChartOptions({
                  blockRewards: response.body.map(val => [val.timestamp * 1000, val.avgRewards / 100000000, val.avgHeight]),
                  blockRewardsFiat: response.body.filter(val => val[this.currency] > 0).map(val => [val.timestamp * 1000, val.avgRewards / 100000000 * val[this.currency], val.avgHeight]),
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
    if (data.blockRewards.length === 0) {
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

    const scaleFactor = 0.1;

    this.chartOptions = {
      title: title,
      animation: false,
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
      grid: {
        top: 20,
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
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.3-3')} BTC<br>`;
            } else if (tick.seriesIndex === 1) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${this.fiatCurrencyPipe.transform(tick.data[1], null, this.currency)}<br>`;
            }
          }

          tooltip += `<small>* On average around block ${data[0].data[2]}</small>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: data.blockRewards.length === 0 ? undefined :
      {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: data.blockRewards.length === 0 ? undefined : {
        data: [
          {
            name: 'Rewards BTC',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Rewards ' + this.currency,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
      },
      yAxis: data.blockRewards.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val} BTC`;
            }
          },
          min: (value) => {
            return Math.round(value.min * (1.0 - scaleFactor) * 10) / 10;
          },
          max: (value) => {
            return Math.round(value.max * (1.0 + scaleFactor) * 10) / 10;
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
          min: (value) => {
            return Math.round(value.min * (1.0 - scaleFactor) * 10) / 10;
          },
          max: (value) => {
            return Math.round(value.max * (1.0 + scaleFactor) * 10) / 10;
          },
          type: 'value',
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
      series: data.blockRewards.length === 0 ? undefined : [
        {
          legendHoverLink: false,
          zlevel: 0,
          yAxisIndex: 0,
          name: 'Rewards BTC',
          data: data.blockRewards,
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
        },
        {
          legendHoverLink: false,
          zlevel: 1,
          yAxisIndex: 1,
          name: 'Rewards ' + this.currency,
          data: data.blockRewardsFiat,
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: {
            width: 2,
            opacity: 0.75,
          },
          areaStyle: {
            opacity: 0.05,
          }
        },
      ],
      dataZoom: data.blockRewards.length === 0 ? undefined : [{
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
    }), `block-rewards-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
