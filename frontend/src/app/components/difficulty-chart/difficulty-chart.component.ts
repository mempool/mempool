import { Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-difficulty-chart',
  templateUrl: './difficulty-chart.component.html',
  styleUrls: ['./difficulty-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 38%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class DifficultyChartComponent implements OnInit {
  @Input() widget: boolean = false;

  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg'
  };

  difficultyObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
  ) {
    this.seoService.setTitle($localize`:@@mining.difficulty:Difficulty`);
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    const powerOfTen = {
      terra: Math.pow(10, 12),
      giga: Math.pow(10, 9),
      mega: Math.pow(10, 6),
      kilo: Math.pow(10, 3),
    }

    this.difficultyObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith('1y'),
        switchMap((timespan) => {
          return this.apiService.getHistoricalDifficulty$(timespan)
            .pipe(
              tap(data => {
                this.prepareChartOptions(data.adjustments.map(val => [val.timestamp * 1000, val.difficulty]));
                this.isLoading = false;
              }),
              map(data => {
                const availableTimespanDay = (
                  (new Date().getTime() / 1000) - (data.oldestIndexedBlockTimestamp / 1000)
                ) / 3600 / 24;

                const tableData = [];
                for (let i = 0; i < data.adjustments.length - 1; ++i) {
                  const change = (data.adjustments[i].difficulty / data.adjustments[i + 1].difficulty - 1) * 100;
                  let selectedPowerOfTen = { divider: powerOfTen.terra, unit: 'T' };
                  if (data.adjustments[i].difficulty < powerOfTen.mega) {
                    selectedPowerOfTen = { divider: 1, unit: '' }; // no scaling
                  } else if (data.adjustments[i].difficulty < powerOfTen.giga) {
                    selectedPowerOfTen = { divider: powerOfTen.mega, unit: 'M' };
                  } else if (data.adjustments[i].difficulty < powerOfTen.terra) {
                    selectedPowerOfTen = { divider: powerOfTen.giga, unit: 'G' };
                  }

                  tableData.push(Object.assign(data.adjustments[i], {
                    change: change,
                    difficultyShorten: formatNumber(
                      data.adjustments[i].difficulty / selectedPowerOfTen.divider,
                      this.locale, '1.2-2') + selectedPowerOfTen.unit
                  }));
                }
                return {
                  availableTimespanDay: availableTimespanDay,
                  data: tableData
                };
              }),
            );
          }),
          share()
        );
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      title: {
        text: this.widget? '' : $localize`:@@mining.difficulty:Difficulty`,
        left: 'center',
        textStyle: {
          color: '#FFF',
        },
      },
      tooltip: {
        show: true,
        trigger: 'axis',
      },
      axisPointer: {
        type: 'line',
      },
      xAxis: [
        {
          type: 'time',
        }
      ],
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
          formatter: (val) => {
            const diff = val / Math.pow(10, 12); // terra
            return diff.toString() + 'T';
          }
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: '#ffffff66',
            opacity: 0.25,
          }
        }
      },
      series: [
        {
          data: data,
          type: 'line',
          smooth: false,
          lineStyle: {
            width: 3,
          },
          areaStyle: {}
        },
      ],
    };
  }

}
