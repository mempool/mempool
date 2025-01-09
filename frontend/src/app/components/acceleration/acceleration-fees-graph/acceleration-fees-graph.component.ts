import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable, Subject, Subscription, combineLatest, fromEvent, merge, share } from 'rxjs';
import { startWith, switchMap, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Acceleration } from '@interfaces/node-api.interface';
import { ServicesApiServices } from '@app/services/services-api.service';
import { StateService } from '@app/services/state.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-acceleration-fees-graph',
  templateUrl: './acceleration-fees-graph.component.html',
  styleUrls: ['./acceleration-fees-graph.component.scss'],
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
export class AccelerationFeesGraphComponent implements OnInit, OnChanges, OnDestroy {
  @Input() widget: boolean = false;
  @Input() height: number = 300;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;
  @Input() period: '24h' | '3d' | '1w' | '1m' | 'all' = '1w';
  @Input() accelerations$: Observable<Acceleration[]>;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  aggregatedHistory$: Observable<any>;
  statsSubscription: Subscription;
  aggregatedHistorySubscription: Subscription;
  fragmentSubscription: Subscription;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  periodSubject$: Subject<'24h' | '3d' | '1w' | '1m' | 'all'> = new Subject();
  chartInstance: any = undefined;
  daysAvailable: number = 0;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private servicesApiService: ServicesApiServices,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    private router: Router,
    private zone: NgZone,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1w' });
    this.radioGroupForm.controls.dateSpan.setValue('1w');
  }

  ngOnInit(): void {
    if (this.widget) {
      this.miningWindowPreference = this.period;
    } else {
      this.seoService.setTitle($localize`:@@bcf34abc2d9ed8f45a2f65dd464c46694e9a181e:Acceleration Fees`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('1w');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.fragmentSubscription = this.route.fragment.subscribe((fragment) => {
      if (['24h', '3d', '1w', '1m', '3m', 'all'].indexOf(fragment) > -1) {
        this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
      }
    });
    this.aggregatedHistory$ = combineLatest([
      merge(
        this.radioGroupForm.get('dateSpan').valueChanges.pipe(
          startWith(this.radioGroupForm.controls.dateSpan.value),
        ),
        this.periodSubject$
      ).pipe(
        switchMap((timespan) => {
          if (!this.widget) {
            this.storageService.setValue('miningWindowPreference', timespan);
          }
          this.isLoading = true;
          this.timespan = timespan;
          return this.servicesApiService.getAggregatedAccelerationHistory$({timeframe: this.timespan});
        })
      ),
      fromEvent(window, 'resize').pipe(startWith(null)),
    ]).pipe(
      tap(([response]) => {
        const history: Acceleration[] = response.body;
        this.daysAvailable = (new Date().getTime() / 1000 - response.headers.get('x-oldest-accel')) / (24 * 3600);
        this.isLoading = false;
        this.prepareChartOptions(history);
        this.cd.markForCheck();
      }),
      share(),
    );

    this.aggregatedHistorySubscription = this.aggregatedHistory$.subscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.period) {
      this.periodSubject$.next(this.period);
    }
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`No accelerated transaction for this timeframe`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      color: [
        '#8F5FF6',
        '#6b6b6b',
      ],
      animation: false,
      grid: {
        height: (this.widget && this.height) ? this.height - 30 : undefined,
        top: this.widget ? 20 : 40,
        bottom: this.widget ? 30 : 80,
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
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks) => {
          let tooltip = `<b style="color: white; margin-left: 2px">${formatterXAxis(this.locale, this.timespan, parseInt(ticks[0].axisValue, 10))}</b><br>`;

          if (ticks[0].data[1] > 10_000_000) {
            tooltip += `${ticks[0].marker} ${ticks[0].seriesName}: ${formatNumber(ticks[0].data[1] / 100_000_000, this.locale, '1.0-8')} BTC<br>`;
          } else {
            tooltip += `${ticks[0].marker} ${ticks[0].seriesName}: ${formatNumber(ticks[0].data[1], this.locale, '1.0-0')} sats<br>`;
          }

          if (['24h', '3d'].includes(this.timespan)) {
            tooltip += `<small>` + $localize`At block: ${ticks[0].data[2]}` + `</small>`;
          } else {
            tooltip += `<small>` + $localize`Around block: ${ticks[0].data[2]}` + `</small>`;
          }

          return tooltip;
        }
      },
      xAxis: data.length === 0 ? undefined :
      {
        name: this.widget ? undefined : formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'time',
        boundaryGap: [0, 0],
        axisLine: { onZero: true },
        axisLabel: {
          formatter: (val): string => formatterXAxisTimeCategory(this.locale, this.timespan, val),
          align: 'center',
          fontSize: 11,
          lineHeight: 12,
          hideOverlap: true,
          padding: [0, 5],
        },
      },
      legend: {
        data: [
          {
            name: 'Total bid boost',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: {
          'Total bid boost': true,
        },
        show: !this.widget,
      },
      yAxis: data.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              if (val >= 100_000) {
                return `${(val / 100_000_000).toFixed(3)} BTC`;
              } else {
                return `${val} sats`;
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
        },
        {
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: function(val) {
              return `${val}`;
            }.bind(this)
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: data.length === 0 ? undefined : [
        {
          legendHoverLink: false,
          zlevel: 1,
          name: 'Total bid boost',
          data: data.map(h =>  {
            return [h.timestamp * 1000, h.sumBidBoost, h.avgHeight]
          }),
          stack: 'Total',
          type: 'bar',
          barWidth: '90%',
          large: true,
          barMinHeight: 3,
        },
      ],
      dataZoom: (this.widget || data.length === 0 )? undefined : [{
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

    this.chartInstance.on('click', (e) => {
      this.zone.run(() => {
        if (['24h', '3d'].includes(this.timespan)) {
          const url = new RelativeUrlPipe(this.stateService).transform(`/block/${e.data[2]}`);
          if (e.event.event.shiftKey || e.event.event.ctrlKey || e.event.event.metaKey) {
            window.open(url);
          } else {
            this.router.navigate([url]);
          }
        }
      });
    });
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
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `acceleration-fees-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  ngOnDestroy(): void {
    this.aggregatedHistorySubscription?.unsubscribe();
    this.fragmentSubscription?.unsubscribe();
    this.statsSubscription?.unsubscribe();
  }
}
