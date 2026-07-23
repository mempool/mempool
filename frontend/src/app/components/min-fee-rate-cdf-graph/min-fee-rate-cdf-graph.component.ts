import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable, combineLatest } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute } from '@angular/router';
import { MinFeeRateDay } from '@app/interfaces/node-api.interface';
import { DEFAULT_MIN_FEE_RATE_THRESHOLD, MinFeeRateService } from '@app/services/min-fee-rate.service';
import { chartColors } from '@app/app.constants';

const CURVE_COLOR = chartColors[8]; // '#00897B'

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
export class MinFeeRateCdfGraphComponent implements OnInit {
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

  totalDays = 0;
  medianRate = 0;
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
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1m', threshold: DEFAULT_MIN_FEE_RATE_THRESHOLD });
    this.radioGroupForm.controls.dateSpan.setValue('1m');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@mining.min-fee-rate-cdf:Share of days at or below a fee rate`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.min-fee-rate-cdf:The cumulative share of days whose minimum fee-merit fee rate was at or below a given fee rate.`);
    // miningWindowPreference is shared across every mining graph, so floor whatever it
    // holds at the shortest timespan this chart offers.
    this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference, threshold: DEFAULT_MIN_FEE_RATE_THRESHOLD });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (TIMESPANS.indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    // Threshold changes only move the marker and recompute the stats, no refetch.
    this.radioGroupForm.get('threshold').valueChanges.subscribe((value) => {
      const parsed = parseFloat(value);
      this.threshold = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      this.updateChart();
      this.cd.markForCheck();
    });

    this.statsObservable$ = combineLatest([
      this.radioGroupForm.get('dateSpan').valueChanges.pipe(startWith(this.radioGroupForm.controls.dateSpan.value)),
    ]).pipe(
      switchMap(([timespan]) => {
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
                blockCount: parseInt(response.headers.get('x-total-count'), 10),
              };
            }),
          );
      }),
      share(),
    );
  }

  updateChart(): void {
    const stats = this.minFeeRateService.getStats(this.data, this.threshold);
    this.totalDays = stats.totalDays;
    this.medianRate = stats.medianRate;
    this.percentBelow = stats.percentBelow;
    this.prepareChartOptions(this.minFeeRateService.buildCdf(this.data));
  }

  formatFeeRate(val: number): string {
    return this.minFeeRateService.formatFeeRate(val);
  }

  prepareChartOptions(cdf: number[][]): void {
    const hasData = cdf.length > 0;
    const curveLabel = $localize`:@@mining.min-fee-rate-cdf.legend-curve:cumulative % of days ≤ fee rate`;
    const thresholdValue = this.formatFeeRate(this.threshold);
    const thresholdPercent = `${formatNumber(this.percentBelow, this.locale, '1.1-1')}%`;
    const thresholdLabel = $localize`:@@mining.min-fee-rate-cdf.legend-threshold:threshold ${thresholdValue}:VALUE: sat/vB → ${thresholdPercent}:PERCENT:`;

    this.chartOptions = {
      color: [CURVE_COLOR],
      animation: false,
      grid: {
        right: 30,
        left: 65,
        bottom: 75,
        top: 20,
      },
      legend: !hasData ? undefined : {
        bottom: 0,
        left: 'center',
        width: '90%',
        data: [curveLabel, thresholdLabel],
        textStyle: {
          color: 'var(--transparent-fg)',
          fontSize: 11,
        },
        inactiveColor: 'rgb(110, 112, 121)',
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
          tooltip += `${point.marker} ` + $localize`Share of days` + `: ${(+point.data[1]).toFixed(1)}%`;
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
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        },
      },
      yAxis: !hasData ? undefined : {
        position: 'left',
        name: $localize`:@@mining.min-fee-rate-cdf.y-axis:% of days`,
        nameLocation: 'middle',
        nameRotate: 90,
        nameGap: 42,
        nameTextStyle: {
          color: 'rgb(110, 112, 121)',
          fontSize: 12,
        },
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
          lineStyle: {
            color: CURVE_COLOR,
            width: 3,
          },
          areaStyle: {
            color: CURVE_COLOR,
            opacity: 0.12,
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
            color: 'var(--fg)',
            type: 'dashed',
            width: 2,
          },
          itemStyle: {
            color: 'var(--fg)',
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
          itemStyle: {
            color: 'var(--fg)',
            borderColor: CURVE_COLOR,
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
}
