import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Observable } from 'rxjs';
import { delay, map, retryWhen, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { FormBuilder, FormGroup } from '@angular/forms';
import { poolsColor } from 'src/app/app.constants';

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
  @Input() widget = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 25;

  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  hashrateObservable$: Observable<any>;
  isLoading = true;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    if (!this.widget) {
      this.seoService.setTitle($localize`:@@mining.pools-historical-dominance:Pools Historical Dominance`);
    }

    this.hashrateObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith('1y'),
        switchMap((timespan) => {
          this.isLoading = true;
          return this.apiService.getHistoricalPoolsHashrate$(timespan)
            .pipe(
              tap((data: any) => {
                // Prepare series (group all hashrates data point by pool)
                const grouped = {};
                for (const hashrate of data.hashrates) {
                  if (!grouped.hasOwnProperty(hashrate.poolName)) {
                    grouped[hashrate.poolName] = [];
                  }
                  grouped[hashrate.poolName].push(hashrate);
                }

                const series = [];
                const legends = [];
                for (const name in grouped) {
                  series.push({
                    stack: 'Total',
                    name: name,
                    showSymbol: false,
                    symbol: 'none',
                    data: grouped[name].map((val) => [val.timestamp * 1000, val.share * 100]),
                    type: 'line',
                    lineStyle: { width: 0 },
                    areaStyle: { opacity: 1 },
                    smooth: true,
                    color: poolsColor[name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()],
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
                  timestamp: data.oldestIndexedBlockTimestamp,
                });
                this.isLoading = false;

                if (series.length === 0) {
                  this.cd.markForCheck();
                  throw new Error();
                }
              }),
              map((data: any) => {
                const availableTimespanDay = (
                  (new Date().getTime() / 1000) - (data.oldestIndexedBlockTimestamp)
                ) / 3600 / 24;
                return {
                  availableTimespanDay: availableTimespanDay,
                };
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
      const lastBlock = new Date(data.timestamp * 1000);
      const dd = String(lastBlock.getDate()).padStart(2, '0');
      const mm = String(lastBlock.getMonth() + 1).padStart(2, '0'); // January is 0!
      const yyyy = lastBlock.getFullYear();
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: `Indexing in progess - ${yyyy}-${mm}-${dd}`,
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
        bottom: this.widget ? 30 : 70,
        top: this.widget || this.isMobile() ? 10 : 50,
      },
      tooltip: {
        show: !this.isMobile() || !this.widget,
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
          let tooltip = `<b style="color: white; margin-left: 18px">${date}</b><br>`;
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
        splitNumber: (this.isMobile() || this.widget) ? 5 : 10,
      },
      legend: (this.isMobile() || this.widget || data.series.length === 0) ? undefined : {
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
      dataZoom: this.widget ? null : [{
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

  isMobile() {
    return (window.innerWidth <= 767.98);
  }
}
