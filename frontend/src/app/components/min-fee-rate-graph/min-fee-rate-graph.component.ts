import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnDestroy, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { EMPTY, Observable, Subject } from 'rxjs';
import { catchError, map, share, startWith, switchMap, takeUntil, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';
import { DEFAULT_MIN_FEE_RATE_THRESHOLD, MinFeeRateService } from '@app/services/min-fee-rate.service';

// Days at or below the threshold are highlighted green; the rest keep the warm
// fee-gradient tone the other mining charts use.
const HIGHLIGHT_COLOR = '#7CB342';
const DEFAULT_BAR_COLOR = '#FB8C00';

// The series is one point per day, so anything shorter than a month is degenerate.
const TIMESPANS = ['1m', '3m', '6m', '1y', '2y', '3y', 'all'];

@Component({
  selector: 'app-min-fee-rate-graph',
  templateUrl: './min-fee-rate-graph.component.html',
  styleUrls: ['./min-fee-rate-graph.component.scss'],
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
export class MinFeeRateGraphComponent implements OnInit, OnDestroy {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  private destroy$ = new Subject<void>();

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;
  // Kept out of radioGroupForm: that group lives inside the timespan <form>, which is
  // only rendered once the stats arrive, and a control may only belong to one container.
  thresholdControl: UntypedFormControl;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  timespan = '';
  chartInstance: any = undefined;

  data: MinFeeRateDay[] = [];
  threshold = DEFAULT_MIN_FEE_RATE_THRESHOLD;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private minFeeRateService: MinFeeRateService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private router: Router,
    private zone: NgZone,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1m' });
    this.radioGroupForm.controls.dateSpan.setValue('1m');
    this.thresholdControl = this.formBuilder.control(DEFAULT_MIN_FEE_RATE_THRESHOLD);
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@0d0e7374a2ff84cfdaf3f96c455885328747d359:Minimum Daily Fee Rate`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.min-fee-rate:See the lowest fee rate that earned block inclusion on fee merit each day, excluding prioritized and accelerated transactions.`);
    // miningWindowPreference is shared across every mining graph, so floor whatever it
    // holds at the shortest timespan this chart offers.
    this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route.fragment
      .pipe(takeUntil(this.destroy$))
      .subscribe((fragment) => {
        if (TIMESPANS.indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    // Threshold changes only recolour the bars and move the marker, no refetch.
    this.thresholdControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const parsed = parseFloat(value);
        this.threshold = isNaN(parsed) || parsed < 0 ? 0 : parsed;
        this.prepareChartOptions();
        this.cd.markForCheck();
      });

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges.pipe(
      startWith(this.radioGroupForm.controls.dateSpan.value),
      switchMap((timespan) => {
        this.storageService.setValue('miningWindowPreference', timespan);
        this.timespan = timespan;
        this.isLoading = true;
        return this.minFeeRateService.getMinFeeRates$(timespan)
          .pipe(
            tap((response) => {
              this.data = response.body || [];
              this.prepareChartOptions();
              this.isLoading = false;
              this.cd.markForCheck();
            }),
            map((response) => {
              return {
                dayCount: parseInt(response.headers.get('x-total-count'), 10),
              };
            }),
            catchError(() => {
              this.data = [];
              this.prepareChartOptions();
              this.isLoading = false;
              this.cd.markForCheck();
              return EMPTY;
            }),
          );
      }),
      share(),
    );
  }

  formatFeeRate(val: number): string {
    return this.minFeeRateService.formatFeeRate(val);
  }

  // Formatted in UTC: west of Greenwich a UTC-midnight month boundary would otherwise
  // render as the previous month. Granularity follows the tick rather than the timespan,
  // because ECharts sizes tick intervals by pixel density.
  private formatAxisDate(value: number): string {
    const date = new Date(value);
    const isMonthStart = date.getUTCDate() === 1 && date.getUTCHours() === 0 &&
      date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
    return date.toLocaleDateString(this.locale, isMonthStart
      ? { year: 'numeric', month: 'short', timeZone: 'UTC' }
      : { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  private formatTooltipDate(value: number): string {
    return new Date(value).toLocaleDateString(this.locale, {
      year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
    });
  }

  prepareChartOptions(): void {
    const seriesData = this.data.map(d => [d.timestamp * 1000, d.minRate, d.minHeight]);
    const hasData = seriesData.length > 0;

    this.chartOptions = {
      title: hasData ? undefined : {
        textStyle: { color: 'grey', fontSize: 15 },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center',
      },
      color: [DEFAULT_BAR_COLOR],
      animation: false,
      // Buckets are UTC calendar days, so ticks must land on UTC boundaries rather than
      // the viewer's local midnight.
      useUTC: true,
      grid: {
        right: this.right,
        left: this.left,
        bottom: 80,
        top: 20,
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
        formatter: function (data: any): string {
          if (data.length <= 0) {
            return '';
          }
          let tooltip = `<b style="color: white; margin-left: 2px">${this.formatTooltipDate(+data[0].data[0])}</b><br>`;
          tooltip += `${data[0].marker} ` + $localize`:@@mining.min-fee-rate.tooltip-rate:Min fee rate` + `: ${this.formatFeeRate(data[0].data[1])} sats/vByte<br>`;
          tooltip += `<small>` + $localize`:@@mining.min-fee-rate.tooltip-block:At block: ${data[0].data[2]}:block:` + `</small>`;
          return tooltip;
        }.bind(this)
      },
      // A time axis, not a category axis: days with no data must render as proportional
      // gaps instead of collapsing into their neighbours.
      xAxis: !hasData ? undefined : {
        type: 'time',
        axisLine: { onZero: true },
        axisLabel: {
          formatter: (val: number): string => this.formatAxisDate(val),
          align: 'center',
          fontSize: 11,
          lineHeight: 12,
          hideOverlap: true,
          padding: [0, 5],
        },
      },
      yAxis: !hasData ? undefined : {
        position: 'left',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val): string => `${this.formatFeeRate(val)} sat/vB`,
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        },
        type: 'value',
      },
      series: !hasData ? undefined : [{
        zlevel: 0,
        name: 'Min fee rate',
        data: seriesData,
        type: 'bar',
        barWidth: '90%',
        barMaxWidth: 50,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: 'var(--transparent-fg)',
            type: 'dashed',
            opacity: 1,
            width: 1,
          },
          data: [{
            yAxis: this.threshold,
            label: {
              show: true,
              position: 'end',
              formatter: (): string => `${this.formatFeeRate(this.threshold)} sat/vB`,
              color: 'var(--fg)',
              fontSize: 11,
            }
          }],
        }
      }],
      visualMap: !hasData ? undefined : {
        show: false,
        dimension: 1,
        pieces: [
          { lte: this.threshold, color: HIGHLIGHT_COLOR },
          { gt: this.threshold, color: DEFAULT_BAR_COLOR },
        ],
      },
      dataZoom: !hasData ? undefined : [{
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
          lineStyle: { color: '#fff', opacity: 0.45 },
          areaStyle: { opacity: 0 },
        },
      }],
    };
  }

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/block/${e.data[2]}`);
        this.router.navigate([url]);
      });
    });
  }

  isMobile(): boolean {
    return (window.innerWidth <= 767.98);
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
      excludeComponents: ['dataZoom'],
    }), `min-fee-rate-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
