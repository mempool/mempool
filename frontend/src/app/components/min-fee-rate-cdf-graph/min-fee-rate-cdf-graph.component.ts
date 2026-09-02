import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnDestroy, OnInit } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { EMPTY, Observable, Subject } from 'rxjs';
import { catchError, map, share, startWith, switchMap, takeUntil, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute } from '@angular/router';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';
import { MinFeeRateService } from '@app/services/min-fee-rate.service';

// Vertical fee gradient, the palette the other mining charts use.
const CURVE_GRADIENT = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
  { offset: 0, color: '#FDD835' },
  { offset: 1, color: '#FB8C00' },
]);
const THRESHOLD_MARKER_COLOR = '#FDD835';

// The series is one point per day, so anything shorter than a month is degenerate.
const TIMESPANS = ['1m', '3m', '6m', '1y', '2y', '3y', 'all'];

@Component({
  selector: 'app-min-fee-rate-cdf-graph',
  templateUrl: './min-fee-rate-cdf-graph.component.html',
  styleUrls: ['./min-fee-rate-cdf-graph.component.scss'],
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
export class MinFeeRateCdfGraphComponent implements OnInit, OnDestroy {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  private destroy$ = new Subject<void>();

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  timespan = '';
  chartInstance: any = undefined;

  data: MinFeeRateDay[] = [];

  // Null while only the hover readout is in play.
  pinnedRate: number | null = null;

  percentBelow = 0;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private minFeeRateService: MinFeeRateService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private route: ActivatedRoute,
    private zone: NgZone,
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1m' });
    this.radioGroupForm.controls.dateSpan.setValue('1m');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@6f8c9d30ae2ee307772b1cbe4e0da5d9a1d54b9b:Share of days at or below a fee rate`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.min-fee-rate-cdf:The cumulative share of days whose minimum fee-merit fee rate was at or below a given fee rate.`);
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
              this.updateChart();
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
              this.updateChart();
              this.isLoading = false;
              this.cd.markForCheck();
              return EMPTY;
            }),
          );
      }),
      share(),
    );
  }

  updateChart(): void {
    this.percentBelow = this.pinnedRate === null
      ? 0
      : this.minFeeRateService.getPercentBelow(this.data, this.pinnedRate);
    this.prepareChartOptions(this.minFeeRateService.buildCdf(this.data));
  }

  formatFeeRate(val: number): string {
    return this.minFeeRateService.formatFeeRate(val);
  }

  prepareChartOptions(cdf: number[][]): void {
    const hasData = cdf.length > 0;
    const isPinned = hasData && this.pinnedRate !== null;
    const curveLabel = $localize`:@@mining.min-fee-rate-cdf.legend-curve:Cumulative`;
    const thresholdValue = this.formatFeeRate(this.pinnedRate ?? 0);
    const thresholdPercent = `${formatNumber(this.percentBelow, this.locale, '1.1-1')}%`;
    const thresholdLabel = $localize`:@@mining.min-fee-rate-cdf.legend-threshold:Threshold`;
    const maxRate = hasData ? cdf[cdf.length - 1][0] : 0;

    this.chartOptions = {
      title: hasData ? undefined : {
        textStyle: { color: 'grey', fontSize: 15 },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center',
      },
      color: [CURVE_GRADIENT],
      animation: false,
      grid: {
        right: this.right,
        left: this.left,
        bottom: 80,
        top: 40,
      },
      legend: !hasData ? undefined : {
        top: 'top',
        data: [
          { name: curveLabel, inactiveColor: 'rgb(110, 112, 121)', textStyle: { color: 'var(--fg)' }, icon: 'roundRect' },
          ...(isPinned
            ? [{ name: thresholdLabel, inactiveColor: 'rgb(110, 112, 121)', textStyle: { color: 'var(--fg)' }, icon: 'roundRect' }]
            : []),
        ],
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
          const point = data.find(d => d.seriesName === curveLabel);
          if (!point) {
            return '';
          }
          let tooltip = `<b style="color: white; margin-left: 2px">≤ ${this.formatFeeRate(+point.data[0])} sat/vB</b><br>`;
          tooltip += `${point.marker} ` + $localize`:@@mining.min-fee-rate-cdf.tooltip-share:Share of days` + `: ${(+point.data[1]).toFixed(1)}%`;
          return tooltip;
        }.bind(this)
      },
      xAxis: !hasData ? undefined : {
        name: $localize`:@@mining.min-fee-rate-cdf.x-axis:fee rate (sat/vB)`,
        nameLocation: 'middle',
        nameTextStyle: {
          color: 'rgb(110, 112, 121)',
          fontSize: 12,
          padding: [12, 0, 0, 0],
        },
        type: 'value',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          fontSize: 11,
          formatter: (val): string => this.formatFeeRate(val),
        },
      },
      yAxis: !hasData ? undefined : {
        position: 'left',
        min: 0,
        max: 100,
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val): string => `${val}%`,
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
      series: !hasData ? undefined : [
        {
          zlevel: 0,
          name: curveLabel,
          data: cdf,
          type: 'line',
          step: 'end',
          symbol: 'none',
          showSymbol: false,
          lineStyle: {
            width: 2,
          },
          areaStyle: {
            opacity: 0.5,
          },
        },
        ...(!isPinned ? [] : [
          {
            zlevel: 1,
            name: thresholdLabel,
            type: 'line',
            data: [[this.pinnedRate, 0], [this.pinnedRate, 100]],
            symbol: 'none',
            // zrender drops events whose topmost hit is silent, which would make the
            // pinned line the one place a click cannot clear it.
            silent: false,
            lineStyle: {
              color: 'var(--transparent-fg)',
              type: 'dashed',
              width: 1,
            },
            itemStyle: {
              color: 'var(--fg)',
            },
          },
          // Scatter rather than a markPoint: MarkPointComponent is not in the bundle.
          {
            zlevel: 2,
            name: 'threshold-marker',
            type: 'scatter',
            data: [[this.pinnedRate, this.percentBelow]],
            symbolSize: 10,
            silent: false,
            // Flips side once the pin is far enough right to push the text off the grid.
            label: {
              show: true,
              position: this.pinnedRate > maxRate * 0.7 ? 'left' : 'right',
              distance: 8,
              color: 'var(--fg)',
              fontSize: 11,
              formatter: `${thresholdValue} sat/vB → ${thresholdPercent}`,
            },
            itemStyle: {
              color: 'var(--fg)',
              borderColor: THRESHOLD_MARKER_COLOR,
              borderWidth: 2,
            },
          },
        ]),
      ],
    };
  }

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }
    this.chartInstance = ec;

    // Bound at the zrender layer: the curve draws no symbols, so series-level clicks
    // would only land on the line itself.
    this.chartInstance.getZr().on('click', (e) => {
      const point = [e.offsetX, e.offsetY];
      if (!this.chartInstance.containPixel('grid', point)) {
        return;
      }
      this.zone.run(() => {
        this.togglePin(this.chartInstance.convertFromPixel({ seriesIndex: 0 }, point)[0]);
      });
    });
  }

  /** Rounds to the printed precision so the share answers the rate the label shows. */
  private togglePin(rate: number): void {
    this.pinnedRate = this.pinnedRate !== null || !(rate > 0)
      ? null
      : parseFloat(this.formatFeeRate(rate));
    this.updateChart();
    this.cd.markForCheck();
  }

  isMobile(): boolean {
    return (window.innerWidth <= 767.98);
  }

  onSaveChart(): void {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 75;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
    }), `min-fee-rate-cdf-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
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
