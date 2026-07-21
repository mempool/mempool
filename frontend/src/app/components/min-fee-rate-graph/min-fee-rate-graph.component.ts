import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable, combineLatest } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute, Router } from '@angular/router';

interface MinFeeRateDay {
  minRate: number;
  minHeight: number;
  timestamp: number; // seconds, UTC midnight
}

const DEFAULT_THRESHOLD = 0.1; // sat/vB — Bitcoin Core 30.0 default -minrelaytxfee
// Days at or below the threshold are highlighted; days above stay muted.
const HIGHLIGHT_COLOR = '#1E88E5';
const MUTED_COLOR = '#5A6474';

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
  threshold = DEFAULT_THRESHOLD;

  // Threshold-dependent stats shown above the chart.
  medianRate = 0;
  daysBelow = 0;
  totalDays = 0;
  percentBelow = 0;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private router: Router,
    private zone: NgZone,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y', threshold: DEFAULT_THRESHOLD });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@mining.min-fee-rate:Minimum Daily Fee Rate`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.min-fee-rate:See the lowest fee rate that earned block inclusion on fee merit each day, excluding prioritized and accelerated transactions.`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('1y');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference, threshold: DEFAULT_THRESHOLD });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    // Threshold changes recompute the highlight and stats client-side, no refetch.
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
        return this.apiService.getMinFeeRates$(timespan)
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
    this.computeStats();
    this.prepareChartOptions();
  }

  computeStats(): void {
    this.totalDays = this.data.length;
    if (this.totalDays === 0) {
      this.medianRate = 0;
      this.daysBelow = 0;
      this.percentBelow = 0;
      return;
    }
    const rates = this.data.map(d => d.minRate).sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    this.medianRate = rates.length % 2 === 0 ? (rates[mid - 1] + rates[mid]) / 2 : rates[mid];
    this.daysBelow = rates.filter(r => r <= this.threshold).length;
    this.percentBelow = (this.daysBelow / this.totalDays) * 100;
  }

  prepareChartOptions(): void {
    const seriesData = this.data.map(d => [d.timestamp * 1000, d.minRate, d.minHeight]);
    const hasData = seriesData.length > 0;

    this.chartOptions = {
      color: [HIGHLIGHT_COLOR],
      animation: false,
      grid: {
        right: 45,
        left: 75,
        bottom: 80,
        top: this.isMobile() ? 10 : 50,
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
          let tooltip = `<b style="color: white; margin-left: 2px">${formatterXAxis(this.locale, this.timespan, parseInt(data[0].axisValue, 10))}</b><br>`;
          tooltip += `${data[0].marker} ` + $localize`Min fee rate` + `: ${this.formatFeeRate(data[0].data[1])} sats/vByte<br>`;
          tooltip += `<small>` + $localize`At block: ${data[0].data[2]}` + `</small>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: !hasData ? undefined : {
        name: formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'category',
        boundaryGap: true,
        axisLine: { onZero: true },
        axisLabel: {
          formatter: val => formatterXAxisTimeCategory(this.locale, this.timespan, parseInt(val, 10)),
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
          formatter: (val): string => `${this.formatFeeRate(val)} s/vB`,
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
              show: !this.isMobile(),
              position: 'insideEndTop',
              formatter: () => `${this.formatFeeRate(this.threshold)} s/vB`,
              color: 'var(--fg)',
            }
          }],
        }
      }],
      // Conditional colouring: bars at or below the threshold are highlighted.
      visualMap: !hasData ? undefined : {
        show: false,
        dimension: 1,
        pieces: [
          { lte: this.threshold, color: HIGHLIGHT_COLOR },
          { gt: this.threshold, color: MUTED_COLOR },
        ],
      },
      dataZoom: !hasData ? undefined : [{
        type: 'inside',
        realtime: true,
        zoomLock: false,
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

    this.chartInstance.on('click', (e) => {
      this.zone.run(() => {
        const url = new RelativeUrlPipe(this.stateService).transform(`/block/${e.data[2]}`);
        this.router.navigate([url]);
      });
    });
  }

  // Minimum daily fee rates are often sub-1 sat/vB, so round adaptively: more
  // decimals below 1 to keep values distinguishable, fewer as they grow.
  formatFeeRate(val: number): string {
    if (val >= 100) {
      return val.toFixed(0);
    }
    if (val >= 10) {
      return val.toFixed(1);
    }
    if (val >= 0.1) {
      return val.toFixed(2);
    }
    if (val >= 0.01) {
      return val.toFixed(3);
    }
    if (val > 0) {
      return val.toFixed(4);
    }
    return '0';
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
