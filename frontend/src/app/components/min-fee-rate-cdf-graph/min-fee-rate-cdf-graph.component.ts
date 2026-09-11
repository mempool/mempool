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
import {
  DEFAULT_MIN_FEE_RATE_THRESHOLD, MIN_FEE_RATE_TIMESPANS, MinFeeRateService, THRESHOLD_GRAB_RADIUS,
} from '@app/services/min-fee-rate.service';

const CURVE_GRADIENT = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
  { offset: 0, color: '#FDD835' },
  { offset: 1, color: '#FB8C00' },
]);
const THRESHOLD_MARKER_COLOR = '#FDD835';

// Past this fraction of the axis the readout would run off the grid, so it flips side.
const LABEL_FLIP_FRACTION = 0.7;

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

  threshold = DEFAULT_MIN_FEE_RATE_THRESHOLD;

  percentBelow = 0;

  private dragging = false;
  private cdf: number[][] = [];

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
    this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route.fragment
      .pipe(takeUntil(this.destroy$))
      .subscribe((fragment) => {
        if (MIN_FEE_RATE_TIMESPANS.indexOf(fragment) > -1) {
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
    this.cdf = this.minFeeRateService.buildCdf(this.data);
    this.redrawThreshold();
  }

  private redrawThreshold(): void {
    this.percentBelow = this.minFeeRateService.getPercentBelow(this.data, this.threshold);
    this.prepareChartOptions(this.cdf);
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
          // zrender drops events whose topmost hit is silent, which would block the drag.
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
        {
          zlevel: 2,
          name: 'threshold-marker',
          type: 'scatter',
          data: [[this.threshold, this.percentBelow]],
          symbolSize: 10,
          silent: false,
          label: {
            show: true,
            position: this.threshold > maxRate * LABEL_FLIP_FRACTION ? 'left' : 'right',
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

    const zr = this.chartInstance.getZr();

    zr.on('mousedown', (e) => {
      if (!this.isOnThresholdLine([e.offsetX, e.offsetY])) {
        return;
      }
      this.dragging = true;
      zr.setCursorStyle('ew-resize');
    });

    zr.on('mousemove', (e) => {
      if (this.dragging) {
        this.dragThresholdTo(e.offsetX);
        zr.setCursorStyle('ew-resize');
      } else if (this.isOnThresholdLine([e.offsetX, e.offsetY])) {
        zr.setCursorStyle('ew-resize');
      }
    });

    const endDrag = (): void => {
      if (!this.dragging) {
        return;
      }
      this.dragging = false;
      this.zone.run(() => this.cd.markForCheck());
    };
    zr.on('mouseup', endDrag);
    zr.on('globalout', endDrag);
  }

  private isOnThresholdLine(point: number[]): boolean {
    if (!this.chartInstance.containPixel('grid', point)) {
      return false;
    }
    const lineX = this.chartInstance.convertToPixel({ xAxisIndex: 0 }, this.threshold);
    return Math.abs(point[0] - lineX) <= THRESHOLD_GRAB_RADIUS;
  }

  private dragThresholdTo(offsetX: number): void {
    const rate = this.chartInstance.convertFromPixel({ xAxisIndex: 0 }, offsetX);
    this.threshold = Math.max(0, parseFloat(this.formatFeeRate(rate)));
    this.redrawThreshold();
    this.chartInstance.setOption(this.chartOptions);
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
