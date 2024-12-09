import { Component, Inject, Input, LOCALE_ID, OnInit, HostBinding, OnChanges, SimpleChanges } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { Observable, combineLatest, fromEvent } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { download } from '@app/shared/graphs.utils';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { isMobile } from '@app/shared/common.utils';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-lightning-statistics-chart',
  templateUrl: './lightning-statistics-chart.component.html',
  styleUrls: ['./lightning-statistics-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
})
export class LightningStatisticsChartComponent implements OnInit, OnChanges {
  @Input() height: number = 150;
  @Input() right: number | string = 45;
  @Input() left: number | string = 45;
  @Input() widget = false;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };
  chartData: any;

  @HostBinding('attr.dir') dir = 'ltr';

  capacityObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private lightningApiService: LightningApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private amountShortenerPipe: AmountShortenerPipe,
  ) {
  }

  ngOnInit(): void {
    let firstRun = true;

    if (this.widget) {
      this.miningWindowPreference = '3y';
    } else {
      this.seoService.setTitle($localize`:@@ea8db27e6db64f8b940711948c001a1100e5fe9f:Lightning Network Capacity`);
      this.seoService.setDescription($localize`:@@meta.description.lightning.stats-chart:See the capacity of the Lightning network visualized over time in terms of the number of open channels and total bitcoin capacity.`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('all');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.capacityObservable$ = this.radioGroupForm.get('dateSpan').valueChanges.pipe(
      startWith(this.miningWindowPreference),
      switchMap((timespan) => {
        this.timespan = timespan;
        if (!this.widget && !firstRun) {
          this.storageService.setValue('lightningWindowPreference', timespan);
        }
        firstRun = false;
        this.miningWindowPreference = timespan;
        this.isLoading = true;
        return this.lightningApiService.cachedRequest(this.lightningApiService.listStatistics$, 250, timespan)
          .pipe(
            tap((response:any) => {
              const data = response.body;
              this.chartData = {
                channel_count: data.map(val => [val.added * 1000, val.channel_count]),
                capacity: data.map(val => [val.added * 1000, val.total_capacity]),
              };
              this.prepareChartOptions(this.chartData);
              this.isLoading = false;
            }),
            map((response) => {
              return {
                days: parseInt(response.headers.get('x-total-count'), 10),
              };
            }),
          );
      }),
      share(),
    );
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.height && this.chartData) {
      this.prepareChartOptions(this.chartData);
    }
  }

  prepareChartOptions(data): void {
    let title: object;
    if (!this.widget && data.channel_count.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`Indexing in progress`,
        left: 'center',
        top: 'center'
      };
    } else if (this.widget && data.channel_count.length > 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 11
        },
        text: $localize`:@@ea8db27e6db64f8b940711948c001a1100e5fe9f:Lightning Network Capacity`,
        left: 'center',
        top: 0,
        zlevel: 10,
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      color: [
        '#FFB300',
        new echarts.graphic.LinearGradient(0, 0.75, 0, 1, [
          { offset: 0, color: '#D81B60' },
          { offset: 1, color: '#D81B60AA' },
        ]),
      ],
      grid: {
        height: this.widget ? ((this.height || 120) - 60) : undefined,
        top: this.widget ? 20 : 40,
        bottom: this.widget ? 0 : 70,
        right: (isMobile() && this.widget) ? 35 : this.right,
        left: (isMobile() && this.widget) ? 40 :this.left,
      },
      tooltip: {
        show: !isMobile(),
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
        formatter: (ticks): string => {
          let sizeString = '';
          let weightString = '';

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) { // Channels
              sizeString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 1) { // Capacity
              weightString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1] / 100000000, this.locale, '1.0-0')} BTC`;
            }
          }

          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          const tooltip = `
            <b style="color: white; margin-left: 18px">${date}</b><br>
            <span>${sizeString}</span><br>
            <span>${weightString}</span>
          `;

          return tooltip;
        }
      },
      xAxis: data.channel_count.length === 0 ? undefined : {
        type: 'time',
        splitNumber: (isMobile() || this.widget) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: this.widget || data.channel_count.length === 0 ? undefined : {
        padding: 10,
        data: [
          {
            name: $localize`:@@807cf11e6ac1cde912496f764c176bdfdd6b7e19:Channels`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`:@@ce9dfdc6dccb28dc75a78c704e09dc18fb02dcfa:Capacity`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: JSON.parse(this.storageService.getValue('sizes_ln_legend'))  ?? {
          'Channels': true,
          'Capacity': true,
        }
      },
      yAxis: data.channel_count.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val: number): string => {
              if (this.widget) {
                return `${this.amountShortenerPipe.transform(val, 0)}`;
              } else {
                return `${formatNumber(Math.round(val), this.locale, '1.0-0')}`;
              }
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            }
          },
          minInterval: this.widget ? 20000 : undefined,
        },
        {
          min: 0,
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val: number): string => {
              if (this.widget) {
                return `${this.amountShortenerPipe.transform(Math.round(val / 100000000), 0)}`;
              } else {
                return `${formatNumber(Math.round(val / 100000000), this.locale, '1.0-0')}`;
              }
            }
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: data.channel_count.length === 0 ? [] : [
        {
          zlevel: 1,
          name: $localize`:@@807cf11e6ac1cde912496f764c176bdfdd6b7e19:Channels`,
          showSymbol: false,
          symbol: 'none',
          data: data.channel_count,
          type: 'line',
          lineStyle: {
            width: 2,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              type: 'solid',
              color: 'var(--transparent-fg)',
              opacity: 1,
              width: 1,
            },
          },
          smooth: false,
        },
        {
          zlevel: 0,
          yAxisIndex: 1,
          name: $localize`:@@ce9dfdc6dccb28dc75a78c704e09dc18fb02dcfa:Capacity`,
          showSymbol: false,
          symbol: 'none',
          stack: 'Total',
          data: data.capacity,
          areaStyle: {
            opacity: 0.5,
          },
          type: 'line',
          smooth: false,
        }
      ],
      dataZoom: this.widget ? null : [{
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

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('sizes_ln_legend', JSON.stringify(e.selected));
    });
  }

  onSaveChart(): void {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
    }), `lightning-network-capacity-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
