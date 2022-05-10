import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable } from 'rxjs';
import { delay, map, retryWhen, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { selectPowerOfTen } from 'src/app/bitcoin.utils';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { download } from 'src/app/shared/graphs.utils';

@Component({
  selector: 'app-hashrate-chart',
  templateUrl: './hashrate-chart.component.html',
  styleUrls: ['./hashrate-chart.component.scss'],
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
export class HashrateChartComponent implements OnInit {
  @Input() tableOnly = false;
  @Input() widget = false;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  hashrateObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private cd: ChangeDetectorRef,
    private storageService: StorageService,
    private miningService: MiningService
  ) {
  }

  ngOnInit(): void {
    let firstRun = true;

    if (this.widget) {
      this.miningWindowPreference = '1y';
    } else {
      this.seoService.setTitle($localize`:@@3510fc6daa1d975f331e3a717bdf1a34efa06dff:Hashrate & Difficulty`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.hashrateObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.miningWindowPreference),
        switchMap((timespan) => {
          if (!this.widget && !firstRun) {
            this.storageService.setValue('miningWindowPreference', timespan);
          }
          this.timespan = timespan;
          firstRun = false;
          this.miningWindowPreference = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalHashrate$(timespan)
            .pipe(
              tap((response) => {
                const data = response.body;
                // We generate duplicated data point so the tooltip works nicely
                const diffFixed = [];
                let diffIndex = 1;
                let hashIndex = 0;
                while (hashIndex < data.hashrates.length) {
                  if (diffIndex >= data.difficulty.length) {
                    while (hashIndex < data.hashrates.length) {
                      diffFixed.push({
                        timestamp: data.hashrates[hashIndex].timestamp,
                        difficulty: data.difficulty[data.difficulty.length - 1].difficulty
                      });
                      ++hashIndex;
                    }
                    break;
                  }

                  while (hashIndex < data.hashrates.length && diffIndex < data.difficulty.length &&
                    data.hashrates[hashIndex].timestamp <= data.difficulty[diffIndex].timestamp
                  ) {
                    diffFixed.push({
                      timestamp: data.hashrates[hashIndex].timestamp,
                      difficulty: data.difficulty[diffIndex - 1].difficulty
                    });
                    ++hashIndex;
                  }
                  ++diffIndex;
                }

                this.prepareChartOptions({
                  hashrates: data.hashrates.map(val => [val.timestamp * 1000, val.avgHashrate]),
                  difficulty: diffFixed.map(val => [val.timestamp * 1000, val.difficulty]),
                });
                this.isLoading = false;
              }),
              map((response) => {
                const data = response.body;
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                  currentDifficulty: data.currentDifficulty,
                  currentHashrate: data.currentHashrate,
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.hashrates.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: `Indexing in progess`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      color: [
        new graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E' },
          { offset: 0.25, color: '#FB8C00' },
          { offset: 0.5, color: '#FFB300' },
          { offset: 0.75, color: '#FDD835' },
          { offset: 1, color: '#7CB342' }
        ]),
        '#D81B60',
      ],
      grid: {
        top: 20,
        bottom: this.widget ? 30 : 70,
        right: this.right,
        left: this.left,
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
        formatter: (ticks) => {
          let hashrateString = '';
          let difficultyString = '';
          let hashratePowerOfTen: any = selectPowerOfTen(1);

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) { // Hashrate
              let hashrate = tick.data[1];
              if (this.isMobile()) {
                hashratePowerOfTen = selectPowerOfTen(tick.data[1]);
                hashrate = Math.round(tick.data[1] / hashratePowerOfTen.divider);
              }
              hashrateString = `${tick.marker} ${tick.seriesName}: ${formatNumber(hashrate, this.locale, '1.0-0')} ${hashratePowerOfTen.unit}H/s`;
            } else if (tick.seriesIndex === 1) { // Difficulty
              let difficultyPowerOfTen = hashratePowerOfTen;
              let difficulty = tick.data[1];
              if (this.isMobile()) {
                difficultyPowerOfTen = selectPowerOfTen(tick.data[1]);
                difficulty = Math.round(tick.data[1] / difficultyPowerOfTen.divider);
              }
              difficultyString = `${tick.marker} ${tick.seriesName}: ${formatNumber(difficulty, this.locale, '1.2-2')} ${difficultyPowerOfTen.unit}`;
            }
          }

          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          return `
            <b style="color: white; margin-left: 18px">${date}</b><br>
            <span>${hashrateString}</span><br>
            <span>${difficultyString}</span>
          `;
        }
      },
      xAxis: data.hashrates.length === 0 ? undefined : {
        type: 'time',
        splitNumber: (this.isMobile() || this.widget) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: (this.widget || data.hashrates.length === 0) ? undefined : {
        data: [
          {
            name: 'Hashrate',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
            itemStyle: {
              color: '#FFB300',
            },
          },
          {
            name: 'Difficulty',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
            itemStyle: {
              color: '#D81B60',
            }
          },
        ],
      },
      yAxis: data.hashrates.length === 0 ? undefined : [
        {
          min: (value) => {
            return value.min * 0.9;
          },
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}H/s`;
            }
          },
          splitLine: {
            show: false,
          }
        },
        {
          min: (value) => {
            return value.min * 0.9;
          },
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: '#ffffff66',
              opacity: 0.25,
            }
          },
        }
      ],
      series: data.hashrates.length === 0 ? [] : [
        {
          zlevel: 0,
          name: 'Hashrate',
          showSymbol: false,
          symbol: 'none',
          data: data.hashrates,
          type: 'line',
          lineStyle: {
            width: 2,
          },
        },
        {
          zlevel: 1,
          yAxisIndex: 1,
          name: 'Difficulty',
          showSymbol: false,
          symbol: 'none',
          data: data.difficulty,
          type: 'line',
          lineStyle: {
            width: 3,
          }
        }
      ],
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
    }), `hashrate-difficulty-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
