import { Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
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
      top: 38%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class HashrateChartComponent implements OnInit {
  @Input() widget: boolean = false;
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
  ) {
    this.seoService.setTitle($localize`:@@mining.hashrate-difficulty:Hashrate and Difficulty`);
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.hashrateObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith('1y'),
        switchMap((timespan) => {
          return this.apiService.getHistoricalHashrate$(timespan)
            .pipe(
              map((data: any) => {
                const diffFixed = [];
                diffFixed.push({
                  timestamp: data.hashrates[0].timestamp,
                  difficulty: data.difficulty[0].difficulty
                });

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

                  while (data.hashrates[hashIndex].timestamp < data.difficulty[diffIndex].timestamp) {
                    diffFixed.push({
                      timestamp: data.hashrates[hashIndex].timestamp,
                      difficulty: data.difficulty[diffIndex - 1].difficulty
                    });
                    ++hashIndex;
                  }
                  ++diffIndex;
                }

                data.difficulty = diffFixed;
                return data;
              }),
              tap((data: any) => {
                this.prepareChartOptions({
                  hashrates: data.hashrates.map(val => [val.timestamp * 1000, val.avgHashrate]),
                  difficulty: data.difficulty.map(val => [val.timestamp * 1000, val.difficulty])
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
        right: this.right,
        left: this.left,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
        },
        borderColor: '#000',
      },
      xAxis: {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
      },
      legend: {
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
      yAxis: [
        {
          type: 'value',
          name: 'Hashrate',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = val / selectedPowerOfTen.divider;
              return `${newVal} ${selectedPowerOfTen.unit}H/s`
            }
          },
          splitLine: {
            show: false,
          }
        },
        {
          type: 'value',
          name: 'Difficulty',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = val / selectedPowerOfTen.divider;
              return `${newVal} ${selectedPowerOfTen.unit}`
            }
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: [
        {
          name: 'Hashrate',
          showSymbol: false,
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
