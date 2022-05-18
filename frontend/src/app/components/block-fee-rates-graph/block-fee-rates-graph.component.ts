import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, NgZone, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from 'src/app/shared/graphs.utils';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { selectPowerOfTen } from 'src/app/bitcoin.utils';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { StateService } from 'src/app/services/state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-block-fee-rates-graph',
  templateUrl: './block-fee-rates-graph.component.html',
  styleUrls: ['./block-fee-rates-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockFeeRatesGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private stateService: StateService,
    private router: Router,
    private zone: NgZone,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@ed8e33059967f554ff06b4f5b6049c465b92d9b3:Block Fee Rates`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.miningWindowPreference),
        switchMap((timespan) => {
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockFeeRates$(timespan)
            .pipe(
              tap((data: any) => {
                // Group by percentile
                const seriesData = {
                  'Min': [],
                  '10th': [],
                  '25th': [],
                  'Median': [],
                  '75th': [],
                  '90th': [],
                  'Max': []
                };
                for (const rate of data.blockFeeRates) {
                  const timestamp = rate.timestamp * 1000;
                  seriesData['Min'].push([timestamp, rate.avg_fee_0, rate.avg_height]);
                  seriesData['10th'].push([timestamp, rate.avg_fee_10, rate.avg_height]);
                  seriesData['25th'].push([timestamp, rate.avg_fee_25, rate.avg_height]);
                  seriesData['Median'].push([timestamp, rate.avg_fee_50, rate.avg_height]);
                  seriesData['75th'].push([timestamp, rate.avg_fee_75, rate.avg_height]);
                  seriesData['90th'].push([timestamp, rate.avg_fee_90, rate.avg_height]);
                  seriesData['Max'].push([timestamp, rate.avg_fee_100, rate.avg_height]);
                }

                // Prepare chart
                const series = [];
                const legends = [];
                for (const percentile in seriesData) {
                  series.push({
                    zlevel: 0,
                    stack: 'Total',
                    name: percentile,
                    data: seriesData[percentile],
                    type: 'bar',
                    barWidth: '100%',
                    large: true,
                  });

                  legends.push({
                    name: percentile,
                    inactiveColor: 'rgb(110, 112, 121)',
                    textStyle: {
                      color: 'white',
                    },
                    icon: 'roundRect',
                    enabled: false,
                    selected: false,
                  });
                }

                this.prepareChartOptions({
                  legends: legends,
                  series: series,
                });
                this.isLoading = false;
              }),
              map((data: any) => {
                const availableTimespanDay = (
                  (new Date().getTime() / 1000) - (data.oldestIndexedBlockTimestamp)
                ) / 3600 / 24;

                return {
                  availableTimespanDay: availableTimespanDay,
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      color: ['#D81B60', '#8E24AA', '#1E88E5', '#7CB342', '#FDD835', '#6D4C41', '#546E7A'],
      animation: false,
      grid: {
        right: this.right,
        left: this.left,
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
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (data) {
          if (data.length <= 0) {
            return '';
          }
          let tooltip = `<b style="color: white; margin-left: 2px">
            ${formatterXAxis(this.locale, this.timespan, parseInt(data[0].axisValue, 10))}</b><br>`;

          for (const pool of data.reverse()) {
            tooltip += `${pool.marker} ${pool.seriesName}: ${pool.data[1]} sats/vByte<br>`;
          }

          if (['24h', '3d'].includes(this.timespan)) {
            tooltip += `<small>At block: ${data[0].data[2]}</small>`;
          } else {
            tooltip += `<small>Around block ${data[0].data[2]}</small>`;
          }

          return tooltip;
        }.bind(this)
      },
      xAxis: data.series.length === 0 ? undefined :
      {
        name: formatterXAxisLabel(this.locale, this.timespan),
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
      legend: (data.series.length === 0) ? undefined : {
        data: data.legends,
        selected: JSON.parse(this.storageService.getValue('fee_rates_legend')) ?? {
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
            const selectedPowerOfTen: any = selectPowerOfTen(val);
            const newVal = Math.round(val / selectedPowerOfTen.divider);
            return `${newVal}${selectedPowerOfTen.unit} s/vB`;
          },
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: '#ffffff66',
            opacity: 0.25,
          }
        },
        type: 'value',
        max: (val) => this.timespan === 'all' ? Math.min(val.max, 5000) : undefined,
      },
      series: data.series,
      dataZoom: [{
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
    this.chartOptions.backgroundColor = '#11131f';
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
