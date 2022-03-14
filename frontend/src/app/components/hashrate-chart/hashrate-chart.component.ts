import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable } from 'rxjs';
import { delay, map, retryWhen, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { selectPowerOfTen } from 'src/app/bitcoin.utils';

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

  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
    width: 'auto',
    height: 'auto',
  };

  hashrateObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;

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
      this.seoService.setTitle($localize`:@@mining.hashrate-difficulty:Hashrate and Difficulty`);
    }

    this.hashrateObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith('1y'),
        switchMap((timespan) => {
          return this.apiService.getHistoricalHashrate$(timespan)
            .pipe(
              tap((data: any) => {
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
                  timestamp: data.oldestIndexedBlockTimestamp,
                });
                this.isLoading = false;

                if (data.hashrates.length === 0) {
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
                  currentDifficulty: Math.round(data.difficulty[data.difficulty.length - 1].difficulty * 100) / 100,
                  currentHashrate: data.hashrates[data.hashrates.length - 1].avgHashrate,
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
    if (data.hashrates.length === 0) {
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
        top: 'center'
      };
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
        '#D81B60',
      ],
      grid: {
        top: 30,
        right: this.right,
        left: this.left,
        bottom: this.widget ? 30 : 60,
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
          let hashratePowerOfTen: any = selectPowerOfTen(1);
          let hashrate = data[0].data[1];
          let difficultyPowerOfTen = hashratePowerOfTen;
          let difficulty = data[1].data[1];

          if (this.isMobile()) {
            hashratePowerOfTen = selectPowerOfTen(data[0].data[1]);
            hashrate = Math.round(data[0].data[1] / hashratePowerOfTen.divider);
            difficultyPowerOfTen = selectPowerOfTen(data[1].data[1]);
            difficulty = Math.round(data[1].data[1] / difficultyPowerOfTen.divider);
          }

          const date = new Date(data[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          return `
            <b style="color: white; margin-left: 18px">${date}</b><br>
            <span>${data[0].marker} ${data[0].seriesName}: ${formatNumber(hashrate, this.locale, '1.0-0')} ${hashratePowerOfTen.unit}H/s</span><br>
            <span>${data[1].marker} ${data[1].seriesName}: ${formatNumber(difficulty, this.locale, '1.2-2')} ${difficultyPowerOfTen.unit}</span>
          `;
        }.bind(this)
      },
      xAxis: data.hashrates.length === 0 ? undefined : {
        type: 'time',
        splitNumber: (this.isMobile() || this.widget) ? 5 : 10,
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
          min: function (value) {
            return value.min * 0.9;
          },
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}H/s`
            }
          },
          splitLine: {
            show: false,
          }
        },
        {
          min: function (value) {
            return value.min * 0.9;
          },
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}`
            }
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: data.hashrates.length === 0 ? [] : [
        {
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
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        maxSpan: 100,
        minSpan: 10,
      }, {
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        bottom: 0,
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
