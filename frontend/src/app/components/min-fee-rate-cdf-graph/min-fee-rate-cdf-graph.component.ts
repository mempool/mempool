import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable, combineLatest } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute } from '@angular/router';

interface MinFeeRateDay {
  minRate: number;
  minHeight: number;
  timestamp: number;
}

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

  totalDays = 0;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@mining.min-fee-rate-cdf:Share of Days at or Below a Fee Rate`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.min-fee-rate-cdf:The cumulative share of days whose minimum fee-merit fee rate was at or below a given fee rate.`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('1y');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
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
              const data: MinFeeRateDay[] = response.body || [];
              this.prepareChartOptions(this.buildCdf(data));
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

  // Cumulative share of days whose minRate is <= a given fee rate. Duplicate rates are
  // collapsed to a single step so the staircase is monotonic and clean.
  buildCdf(data: MinFeeRateDay[]): number[][] {
    this.totalDays = data.length;
    if (this.totalDays === 0) {
      return [];
    }
    const counts = new Map<number, number>();
    for (const d of data) {
      counts.set(d.minRate, (counts.get(d.minRate) || 0) + 1);
    }
    const rates = Array.from(counts.keys()).sort((a, b) => a - b);
    const cdf: number[][] = [];
    let cumulative = 0;
    for (const rate of rates) {
      cumulative += counts.get(rate);
      cdf.push([rate, (cumulative / this.totalDays) * 100]);
    }
    return cdf;
  }

  prepareChartOptions(cdf: number[][]): void {
    const hasData = cdf.length > 0;

    this.chartOptions = {
      color: ['#1E88E5'],
      animation: false,
      grid: {
        right: 45,
        left: 60,
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
          const point = data[0].data;
          let tooltip = `<b style="color: white; margin-left: 2px">≤ ${(+point[0]).toFixed(2)} sats/vByte</b><br>`;
          tooltip += `${data[0].marker} ` + $localize`Share of days` + `: ${(+point[1]).toFixed(1)}%`;
          return tooltip;
        }.bind(this)
      },
      xAxis: !hasData ? undefined : {
        name: $localize`Fee rate (sat/vB)`,
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'value',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          fontSize: 11,
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
      series: !hasData ? undefined : [{
        zlevel: 0,
        name: 'Share of days',
        data: cdf,
        type: 'line',
        step: 'end',
        symbol: 'none',
        lineStyle: {
          width: 3,
        },
        areaStyle: {
          opacity: 0.15,
        },
      }],
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
    }), `min-fee-rate-cdf-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
