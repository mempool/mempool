import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable, Subscription, combineLatest } from 'rxjs';
import { map, max, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { SeoService } from '../../../services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from '../../../shared/graphs.utils';
import { StorageService } from '../../../services/storage.service';
import { MiningService } from '../../../services/mining.service';
import { ActivatedRoute } from '@angular/router';
import { Acceleration } from '../../../interfaces/node-api.interface';

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
export class AccelerationFeesGraphComponent implements OnInit, OnDestroy {
  @Input() widget: boolean = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;
  @Input() accelerations$: Observable<Acceleration[]>;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  hrStatsObservable$: Observable<any>;
  statsObservable$: Observable<any>;
  statsSubscription: Subscription;
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
    this.isLoading = true;
    if (this.widget) {
      this.miningWindowPreference = '1m';
      this.timespan = this.miningWindowPreference;

      this.statsObservable$ = combineLatest([
        (this.accelerations$ || this.apiService.getAccelerationHistory$({ timeframe: this.miningWindowPreference })),
        this.apiService.getHistoricalBlockFees$(this.miningWindowPreference),
      ]).pipe(
        tap(([accelerations, blockFeesResponse]) => {
          this.prepareChartOptions(accelerations, blockFeesResponse.body);
        }),
        map(([accelerations, blockFeesResponse]) => {
          return {
            avgFeesPaid: accelerations.filter(acc => acc.status === 'completed').reduce((total, acc) => total + acc.feePaid, 0) / accelerations.length
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
            return this.apiService.getAccelerationHistory$({});
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
        })
      );
    }
    this.statsSubscription = this.statsObservable$.subscribe(() => {
      this.isLoading = false;
      this.cd.markForCheck();
    });
  }

  prepareChartOptions(accelerations, blockFees) {
    let title: object;

    const blockAccelerations = {};

    for (const acceleration of accelerations) {
      if (acceleration.status === 'completed') {
        if (!blockAccelerations[acceleration.blockHeight]) {
          blockAccelerations[acceleration.blockHeight] = [];
        }
        blockAccelerations[acceleration.blockHeight].push(acceleration);
      }
    }

    let last = null;
    let minValue = Infinity;
    let maxValue = 0;
    const data = [];
    for (const val of blockFees) {
      if (last == null) {
        last = val.avgHeight;
      }
      let totalFeeDelta = 0;
      let totalFeePaid = 0;
      let totalCount = 0;
      let blockCount = 0;
      while (last <= val.avgHeight) {
        blockCount++;
        totalFeeDelta += (blockAccelerations[last] || []).reduce((total, acc) => total + acc.feeDelta, 0);
        totalFeePaid += (blockAccelerations[last] || []).reduce((total, acc) => total + acc.feePaid, 0);
        totalCount += (blockAccelerations[last] || []).length;
        last++;
      }
      minValue = Math.min(minValue, val.avgFees);
      maxValue = Math.max(maxValue, val.avgFees);
      data.push({
        ...val,
        feeDelta: totalFeeDelta,
        avgFeePaid: (totalFeePaid / blockCount),
        accelerations: totalCount / blockCount,
      });
    }

    this.chartOptions = {
      title: title,
      color: [
        '#8F5FF6',
        '#6b6b6b',
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

          for (const tick of data.reverse()) {
            if (tick.data[1] >= 1_000_000) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1] / 100_000_000, this.locale, '1.0-3')} BTC<br>`;
            } else {
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')} sats<br>`;
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
      legend: {
        data: [
          {
            name: 'In-band fees per block',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Out-of-band fees per block',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: {
          'In-band fees per block': false,
          'Out-of-band fees per block': true,
        },
        show: !this.widget,
      },
      yAxis: data.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              if (val >= 100_000) {
                return `${(val / 100_000_000).toFixed(3)} BTC`;
              } else {
                return `${val} sats`;
              }
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
          name: 'Out-of-band fees per block',
          data: data.map(block =>  [block.timestamp * 1000, block.avgFeePaid, block.avgHeight]),
          stack: 'Total',
          type: 'bar',
          barWidth: '100%',
          large: true,
        },
        {
          legendHoverLink: false,
          zlevel: 0,
          name: 'In-band fees per block',
          data: data.map(block =>  [block.timestamp * 1000, block.avgFees, block.avgHeight]),
          stack: 'Total',
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
      visualMap: {
        type: 'continuous',
        min: minValue,
        max: maxValue,
        dimension: 1,
        seriesIndex: 1,
        show: false,
        inRange: {
          color: ['#F4511E7f', '#FB8C007f', '#FFB3007f', '#FDD8357f', '#7CB3427f'].reverse() // Gradient color range
        }
      },
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

  ngOnDestroy(): void {
    if (this.statsSubscription) {
      this.statsSubscription.unsubscribe();
    }
  }
}
