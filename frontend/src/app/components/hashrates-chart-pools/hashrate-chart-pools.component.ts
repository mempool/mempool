import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Observable } from 'rxjs';
import { delay, map, retryWhen, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { poolsColor } from 'src/app/app.constants';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { download } from 'src/app/shared/graphs.utils';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-hashrate-chart-pools',
  templateUrl: './hashrate-chart-pools.component.html',
  styleUrls: ['./hashrate-chart-pools.component.scss'],
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
export class HashrateChartPoolsComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 25;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  hashrateObservable$: Observable<any>;
  isLoading = true;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    let firstRun = true;

    this.seoService.setTitle($localize`:@@mining.pools-historical-dominance:Pools Historical Dominance`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('6m');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.hashrateObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          if (!firstRun) {
            this.storageService.setValue('miningWindowPreference', timespan);
          }
          this.timespan = timespan;
          firstRun = false;
          this.isLoading = true;
          return this.apiService.getHistoricalPoolsHashrate$(timespan)
            .pipe(
              tap((response) => {
                const hashrates = response.body;
                // Prepare series (group all hashrates data point by pool)
                const grouped = {};
                for (const hashrate of hashrates) {
                  if (!grouped.hasOwnProperty(hashrate.poolName)) {
                    grouped[hashrate.poolName] = [];
                  }
                  grouped[hashrate.poolName].push(hashrate);
                }

                const series = [];
                const legends = [];
                for (const name in grouped) {
                  series.push({
                    zlevel: 0,
                    stack: 'Total',
                    name: name,
                    showSymbol: false,
                    symbol: 'none',
                    data: grouped[name].map((val) => [val.timestamp * 1000, val.share * 100]),
                    type: 'line',
                    lineStyle: { width: 0 },
                    areaStyle: { opacity: 1 },
                    smooth: true,
                    color: poolsColor[name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()],
                    emphasis: {
                      disabled: true,
                      scale: false,
                    },
                  });

                  legends.push({
                    name: name,
                    inactiveColor: 'rgb(110, 112, 121)',
                    textStyle: {
                      color: 'white',
                    },
                    icon: 'roundRect',
                    itemStyle: {
                      color: poolsColor[name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()],
                    },
                  });
                }

                this.prepareChartOptions({
                  legends: legends,
                  series: series,
                });
                this.isLoading = false;

                if (series.length === 0) {
                  this.cd.markForCheck();
                  throw new Error();
                }
              }),
              map((response) => {
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                }
              }),
              retryWhen((errors) => errors.pipe(
                delay(60000)
              ))
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.series.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center',
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      grid: {
        right: this.right,
        left: this.left,
        bottom: 70,
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
          const date = new Date(data[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          let tooltip = `<b style="color: white; margin-left: 2px">${date}</b><br>`;
          data.sort((a, b) => b.data[1] - a.data[1]);
          for (const pool of data) {
            if (pool.data[1] > 0) {
              tooltip += `${pool.marker} ${pool.seriesName}: ${pool.data[1].toFixed(2)}%<br>`;
            }
          }
          return tooltip;
        }.bind(this)
      },
      xAxis: data.series.length === 0 ? undefined : {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: (this.isMobile() || data.series.length === 0) ? undefined : {
        data: data.legends
      },
      yAxis: data.series.length === 0 ? undefined : {
        position: 'right',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val) => `${val}%`,
        },
        splitLine: {
          show: false,
        },
        type: 'value',
        max: 100,
        min: 0,
      },
      series: data.series,
      dataZoom: [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 10,
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
    this.chartOptions.grid.bottom = 30;
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `pools-dominance-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
