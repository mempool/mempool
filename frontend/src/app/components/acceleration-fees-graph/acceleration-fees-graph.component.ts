import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable, combineLatest } from 'rxjs';
import { map, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { SeoService } from '../../services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis } from '../../shared/graphs.utils';
import { StorageService } from '../../services/storage.service';
import { MiningService } from '../../services/mining.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-acceleration-fees-graph',
  templateUrl: './acceleration-fees-graph.component.html',
  styleUrls: ['./acceleration-fees-graph.component.scss'],
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
export class AccelerationFeesGraphComponent implements OnInit {
  @Input() widget: boolean = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

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

  currency: string;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
    this.currency = 'USD';
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@6c453b11fd7bd159ae30bc381f367bc736d86909:Acceleration Fees`);
    if (this.widget) {
      this.miningWindowPreference = '1w';
      this.isLoading = true;
      this.timespan = this.miningWindowPreference;
      this.statsObservable$ = combineLatest([
        this.apiService.getAccelerationHistory$(this.miningWindowPreference),
        this.apiService.getHistoricalBlockFees$(this.miningWindowPreference),
      ]).pipe(
        tap(([accelerations, blockFeesResponse]) => {
          console.log(accelerations, blockFeesResponse.body);
          this.prepareChartOptions(accelerations, blockFeesResponse.body);
          this.isLoading = false;
        }),
        map(([accelerations, blockFeesResponse]) => {
          return {

          };
        }),
      );
    } else {
      this.miningWindowPreference = this.miningService.getDefaultTimespan('1w');
      this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
      this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);
      this.route.fragment.subscribe((fragment) => {
        if (['24h', '3d', '1w', '1m'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });
      this.statsObservable$ = combineLatest([
        this.radioGroupForm.get('dateSpan').valueChanges.pipe(
          startWith(this.radioGroupForm.controls.dateSpan.value),
          switchMap((timespan) => {
            this.isLoading = true;
            this.storageService.setValue('miningWindowPreference', timespan);
            this.timespan = timespan;
            return this.apiService.getAccelerations$();
          })
        ),
        this.radioGroupForm.get('dateSpan').valueChanges.pipe(
          startWith(this.radioGroupForm.controls.dateSpan.value),
          switchMap((timespan) => {
            return this.apiService.getHistoricalBlockFees$(timespan);
          })
        )
      ]).pipe(
        tap(([accelerations, blockFeesResponse]) => {
          this.prepareChartOptions(accelerations, blockFeesResponse.body);
          this.isLoading = false;
          this.cd.markForCheck();
        }),
        map(([accelerations, blockFeesResponse]) => {
          return {

          };
        }),
      );
    }
  }

  prepareChartOptions(accelerations, blockFees) {
    let title: object;

    const blockAccelerations = {};

    for (const acceleration of accelerations) {
      if (acceleration.mined) {
        if (!blockAccelerations[acceleration.block_height]) {
          blockAccelerations[acceleration.block_height] = [];
        }
        blockAccelerations[acceleration.block_height].push(acceleration);
      }
    }

    let last = null;
    const data = [];
    for (const val of blockFees) {
      if (last == null) {
        last = val.avgHeight;
      }
      let totalFeeDelta = 0;
      let totalCount = 0;
      while (last <= val.avgHeight) {
        totalFeeDelta += (blockAccelerations[last] || []).reduce((total, acc) => total + acc.feeDelta, 0);
        totalCount += (blockAccelerations[last] || []).length;
        last++;
      }
      data.push({
        ...val,
        feeDelta: totalFeeDelta,
        accelerations: totalCount,
      });
    }

    this.chartOptions = {
      title: title,
      color: [
        new graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E' },
          { offset: 0.25, color: '#FB8C00' },
          { offset: 0.5, color: '#FFB300' },
          { offset: 0.75, color: '#FDD835' },
          { offset: 1, color: '#7CB342' }
        ]),
        '#1E88E5',
      ],
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

          for (const tick of data) {
            if (tick.seriesIndex === 0) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')} sats<br>`;
            } else if (tick.seriesIndex === 1) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}<br>`;
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
      xAxis: data.length === 0 ? undefined :
      {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: (this.widget || data.length === 0) ? undefined : {
        data: [
          {
            name: 'Total fee delta',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Total accelerations',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {  
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
      },
      yAxis: data.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val / 100_000_000} BTC`;
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
        {
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: function(val) {
              return `${val}`;
            }.bind(this)
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: data.length === 0 ? undefined : [
        {
          legendHoverLink: false,
          zlevel: 1,
          yAxisIndex: 0,
          name: 'Total fee delta',
          data: data.map(block =>  [block.timestamp * 1000, block.feeDelta, block.avgHeight]),
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: {
            width: 1,
            opacity: 1,
          }
        },
        {
          legendHoverLink: false,
          zlevel: 0,
          yAxisIndex: 1,
          name: 'Total accelerations',
          data: data.map(block =>  [block.timestamp * 1000, block.accelerations, block.avgHeight]),
          type: 'bar',
          barWidth: '100%',
          large: true,
        },
      ],
      dataZoom: (this.widget || data.length === 0 )? undefined : [{
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
    }), `acceleration-fees-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
