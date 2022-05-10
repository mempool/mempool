import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { download, formatterXAxisLabel } from 'src/app/shared/graphs.utils';
import { MiningService } from 'src/app/services/mining.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-block-rewards-graph',
  templateUrl: './block-rewards-graph.component.html',
  styleUrls: ['./block-rewards-graph.component.scss'],
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
export class BlockRewardsGraphComponent implements OnInit {
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
    private miningService: MiningService,
    private storageService: StorageService
  ) {
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@8ba8fe810458280a83df7fdf4c614dfc1a826445:Block Rewards`);
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
          return this.apiService.getHistoricalBlockRewards$(timespan)
            .pipe(
              tap((response) => {
                this.prepareChartOptions({
                  blockRewards: response.body.map(val => [val.timestamp * 1000, val.avg_rewards / 100000000]),
                });
                this.isLoading = false;
              }),
              map((response) => {
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      animation: false,
      color: [
        new graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E' },
          { offset: 0.25, color: '#FB8C00' },
          { offset: 0.5, color: '#FFB300' },
          { offset: 0.75, color: '#FDD835' },
          { offset: 1, color: '#7CB342' }
        ]),
      ],
      grid: {
        top: 20,
        bottom: 80,
        right: this.right,
        left: this.left,
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
        formatter: (ticks) => {
          const tick = ticks[0];
          const rewardsString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.3-3')} BTC`;
          return `
            <b style="color: white; margin-left: 18px">${tick.axisValueLabel}</b><br>
            <span>${rewardsString}</span>
          `;
        }
      },
      xAxis: {
        name: formatterXAxisLabel(this.locale, this.timespan),
        nameLocation: 'middle',
        nameTextStyle: {
          padding: [10, 0, 0, 0],
        },
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
      },
      yAxis: [
        {
          min: value => Math.round(10 * value.min * 0.99) / 10,
          max: value => Math.round(10 * value.max * 1.01) / 10,
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val} BTC`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: '#ffffff66',
              opacity: 0.25,
            }
          },
        },
      ],
      series: [
        {
          zlevel: 0,
          name: 'Reward',
          showSymbol: false,
          symbol: 'none',
          data: data.blockRewards,
          type: 'line',
          lineStyle: {
            width: 2,
          },
        },
      ],
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
    this.chartInstance = ec;
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
    }), `block-rewards-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
