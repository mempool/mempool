import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { EMPTY, Observable, Subject } from 'rxjs';
import { catchError, map, share, startWith, switchMap, takeUntil, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute } from '@angular/router';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';
import { DEFAULT_MIN_FEE_RATE_THRESHOLD, MinFeeRateService } from '@app/services/min-fee-rate.service';

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

  // Share of days at or below the threshold: drives the marker and the legend readout.
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
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1m' });
    this.radioGroupForm.controls.dateSpan.setValue('1m');
    this.thresholdControl = this.formBuilder.control(DEFAULT_MIN_FEE_RATE_THRESHOLD);
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

    // Threshold changes only move the marker and recompute the stats, no refetch.
    this.thresholdControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((value) => {
        const parsed = parseFloat(value);
        this.threshold = isNaN(parsed) || parsed < 0 ? 0 : parsed;
        this.updateChart();
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
    this.percentBelow = this.minFeeRateService.getPercentBelow(this.data, this.threshold);
    this.prepareChartOptions(this.minFeeRateService.buildCdf(this.data));
  }

  formatFeeRate(val: number): string {
    return this.minFeeRateService.formatFeeRate(val);
  }

  prepareChartOptions(cdf: number[][]): void {
    const hasData = cdf.length > 0;
    const curveLabel = $localize`:@@mining.min-fee-rate-cdf.legend-curve:Cumulative`;
    const thresholdValue = this.formatFeeRate(this.threshold);
    const thresholdPercent = `${formatNumber(this.percentBelow, this.locale, '1.1-1')}%`;
    const thresholdLabel = $localize`:@@mining.min-fee-rate-cdf.legend-threshold:Threshold`;

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
        top: 20,
      },
      legend: !hasData ? undefined : {
        top: 'top',
        data: [
          { name: curveLabel, inactiveColor: 'rgb(110, 112, 121)', textStyle: { color: 'var(--fg)' }, icon: 'roundRect' },
          { name: thresholdLabel, inactiveColor: 'rgb(110, 112, 121)', textStyle: { color: 'var(--fg)' }, icon: 'roundRect' },
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
        {
          zlevel: 1,
          name: thresholdLabel,
          type: 'line',
          data: [[this.threshold, 0], [this.threshold, 100]],
          symbol: 'none',
          silent: true,
          lineStyle: {
            color: 'var(--transparent-fg)',
            type: 'dashed',
            width: 1,
          },
          itemStyle: {
            color: 'var(--fg)',
          },
          // The reading the threshold control produces, kept on the line itself now
          // that the legend carries only the short series name.
          endLabel: {
            show: true,
            color: 'var(--fg)',
            fontSize: 11,
            formatter: `${thresholdValue} sat/vB → ${thresholdPercent}`,
          },
        },
        // Marker where the threshold crosses the curve. A separate series rather than a
        // markPoint because MarkPointComponent is not registered in the echarts bundle.
        {
          zlevel: 2,
          name: 'threshold-marker',
          type: 'scatter',
          data: [[this.threshold, this.percentBelow]],
          symbolSize: 10,
          silent: true,
          // Flips side once the threshold is far enough right to push the text off
          // the grid.
          label: {
            show: true,
            position: this.threshold > maxRate * 0.7 ? 'left' : 'right',
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
      ],
    };
  }

  onChartInit(ec): void {
    if (this.chartInstance !== undefined) {
      return;
    }
    this.chartInstance = ec;
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
