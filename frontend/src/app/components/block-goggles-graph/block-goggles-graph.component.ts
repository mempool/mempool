import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { Observable, combineLatest, of } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from '@app/shared/graphs.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from '@app/services/state.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-block-goggles-graph',
  templateUrl: './block-goggles-graph.component.html',
  styleUrls: ['./block-goggles-graph.component.scss'],
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
export class BlockGogglesGraphComponent implements OnInit {
  @Input() widget = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  hrStatsObservable$: Observable<any>;
  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

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
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    if (this.widget) {
      this.miningWindowPreference = '1m';
    } else {
      this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    }

    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    if (!this.widget) {
      this.route
        .fragment
        .subscribe((fragment) => {
          if (['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
            this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
          }
        });
    }

    this.hrStatsObservable$ = combineLatest([
      this.apiService.getHistoricalBlockFeeRates$('24h'),
      this.stateService.rateUnits$
    ]).pipe(
      map(([response, rateUnits]) => {
        return {
          blockCount: parseInt(response.headers.get('x-total-count'), 10),
          avgMedianRate: response.body.length ? response.body.reduce((acc, rate) => acc + rate.avgFee_50, 0) / response.body.length : 0,
        };
      }),
      share(),
    );

    this.statsObservable$ = combineLatest([
        this.widget ? of(this.miningWindowPreference) : this.radioGroupForm.get('dateSpan').valueChanges.pipe(startWith(this.radioGroupForm.controls.dateSpan.value)),
        this.stateService.rateUnits$
    ]).pipe();
  }

  prepareChartOptions(data, weightMode) {
    this.chartOptions = {
      color: this.widget ? ['#6b6b6b', new echarts.graphic.LinearGradient(0, 0, 0, 0.65, [
        { offset: 0, color: '#F4511E' },
        { offset: 0.25, color: '#FB8C00' },
        { offset: 0.5, color: '#FFB300' },
        { offset: 0.75, color: '#FDD835' },
        { offset: 1, color: '#7CB342' }
      ])] : ['#D81B60', '#8E24AA', '#1E88E5', '#7CB342', '#FDD835', '#6D4C41', '#546E7A'],
      animation: false,
      grid: {
        right: this.right,
        left: this.left,
        bottom: this.widget ? 30 : 80,
        top: this.widget ? 20 : (this.isMobile() ? 10 : 50),
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
        formatter: function(data) {
          if (data.length <= 0) {
            return '';
          }
          let tooltip = `<b style="color: white; margin-left: 2px">${formatterXAxis(this.locale, this.timespan, parseInt(data[0].axisValue, 10))}</b><br>`;

          for (const rate of data.reverse()) {
            if (weightMode) {
              tooltip += `${rate.marker} ${rate.seriesName}: ${(rate.data[1] / 4).toFixed(2)} sats/WU<br>`;
            } else {
              tooltip += `${rate.marker} ${rate.seriesName}: ${rate.data[1].toFixed(2)} sats/vByte<br>`;
            }
          }

          if (['24h', '3d'].includes(this.timespan)) {
            tooltip += `<small>` + $localize`At block: ${data[0].data[2]}` + `</small>`;
          } else {
            tooltip += `<small>` + $localize`Around block: ${data[0].data[2]}` + `</small>`;
          }

          return tooltip;
        }.bind(this)
      },
      xAxis: data.series.length === 0 ? undefined :
      {
        name: this.widget ? undefined : formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'category',
        boundaryGap: false,
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
      legend: (this.widget || data.series.length === 0) ? undefined : {
        padding: [10, 75],
        data: data.legends,
        selected:  JSON.parse(this.storageService.getValue('fee_rates_legend') || 'null') ?? {
          'Min': true,
          '10th': true,
          '25th': true,
          'Median': true,
          '75th': true,
          '90th': true,
          'Max': false,
        },
        id: 4242,
      },
      yAxis: data.series.length === 0 ? undefined : {
        position: 'left',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val) => {
            if (weightMode) {
              val /= 4;
            }
            const selectedPowerOfTen: any = selectPowerOfTen(val);
            const newVal = Math.round(val / selectedPowerOfTen.divider);
            return `${newVal}${selectedPowerOfTen.unit} s/${weightMode ? 'WU': 'vB'}`;
          },
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        },
        type: 'value',
        max: (val) => this.timespan === 'all' ? Math.min(val.max, 5000) : undefined,
      },
      series: data.series,
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

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('click', (e) => {
      this.zone.run(() => {
        if (['24h', '3d'].includes(this.timespan)) {
          const url = new RelativeUrlPipe(this.stateService).transform(`/block/${e.data[2]}`);
          this.router.navigate([url]);
        }
      });
    });

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('fee_rates_legend', JSON.stringify(e.selected));
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
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-fee-rates-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
