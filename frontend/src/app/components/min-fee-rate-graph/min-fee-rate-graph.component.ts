import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable, combineLatest, of } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute, Router } from '@angular/router';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';
import { DEFAULT_MIN_FEE_RATE_THRESHOLD, MinFeeRateService } from '@app/services/min-fee-rate.service';
import { chartColors } from '@app/app.constants';

// Days at or below the threshold are highlighted in green; the rest keep the warm
// default. Both come from the shared chart palette.
const HIGHLIGHT_COLOR = chartColors[9]; // '#43A047'
const DEFAULT_BAR_COLOR = chartColors[14]; // '#FB8C00'

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
export class MinFeeRateGraphComponent implements OnInit {
  @Input() widget = false;

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
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1m', threshold: DEFAULT_MIN_FEE_RATE_THRESHOLD });
    this.radioGroupForm.controls.dateSpan.setValue('1m');
  }

  ngOnInit(): void {
    if (this.widget) {
      this.miningWindowPreference = '1m';
    } else {
      this.seoService.setTitle($localize`:@@mining.min-fee-rate:Minimum Daily Fee Rate`);
      this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.min-fee-rate:See the lowest fee rate that earned block inclusion on fee merit each day, excluding prioritized and accelerated transactions.`);
      // miningWindowPreference is shared across every mining graph, so floor whatever it
      // holds at the shortest timespan this chart offers.
      this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference, threshold: DEFAULT_MIN_FEE_RATE_THRESHOLD });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    if (!this.widget) {
      this.route
        .fragment
        .subscribe((fragment) => {
          if (TIMESPANS.indexOf(fragment) > -1) {
            this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
          }
        });
    }

    // Threshold changes only recolour the bars and move the marker, no refetch.
    this.radioGroupForm.get('threshold').valueChanges.subscribe((value) => {
      const parsed = parseFloat(value);
      this.threshold = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      this.prepareChartOptions();
      this.cd.markForCheck();
    });

    this.statsObservable$ = combineLatest([
      this.widget ? of(this.miningWindowPreference) : this.radioGroupForm.get('dateSpan').valueChanges.pipe(startWith(this.radioGroupForm.controls.dateSpan.value)),
    ]).pipe(
      switchMap(([timespan]) => {
        if (!this.widget) {
          this.storageService.setValue('miningWindowPreference', timespan);
        }
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
      color: [DEFAULT_BAR_COLOR],
      animation: false,
      // Buckets are UTC calendar days, so ticks must land on UTC boundaries rather than
      // the viewer's local midnight.
      useUTC: true,
      grid: {
        right: this.widget ? 10 : 25,
        left: this.widget ? 45 : 70,
        bottom: this.widget ? 30 : 50,
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
          tooltip += `${data[0].marker} ` + $localize`Min fee rate` + `: ${this.formatFeeRate(data[0].data[1])} sats/vByte<br>`;
          tooltip += `<small>` + $localize`At block: ${data[0].data[2]}` + `</small>`;
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
        name: this.widget ? undefined : $localize`:@@mining.min-fee-rate.axis:sat/vB`,
        nameLocation: 'middle',
        nameRotate: 90,
        nameGap: 48,
        nameTextStyle: {
          color: 'rgb(110, 112, 121)',
          fontSize: 12,
        },
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val): string => this.formatFeeRate(val),
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
        large: true,
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: 'var(--fg)',
            type: 'dashed',
            opacity: 1,
            width: 2,
          },
          data: [{
            yAxis: this.threshold,
            label: {
              show: true,
              position: 'insideStartTop',
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
      dataZoom: (this.widget || !hasData) ? undefined : [{
        type: 'inside',
        realtime: true,
        zoomLock: false,
        maxSpan: 100,
        minSpan: 5,
        moveOnMouseMove: false,
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
}
