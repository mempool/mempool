import { Component, Inject, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatNumber } from "@angular/common";

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
  ) {
    this.seoService.setTitle($localize`:@@mining.difficulty:Difficulty`);
  }

  ngOnInit(): void {
    this.difficultyObservable$ = this.apiService.getHistoricalDifficulty$(undefined)
      .pipe(
        map(data => {
          let formatted = [];
          for (let i = 0; i < data.length - 1; ++i) {
            const change = (data[i].difficulty / data[i + 1].difficulty - 1) * 100;
            formatted.push([
              data[i].timestamp,
              data[i].difficulty,
              data[i].height,
              formatNumber(change, this.locale, '1.2-2'),
              change,
              formatNumber(data[i].difficulty, this.locale, '1.2-2'),
            ]);
          }
          return formatted;
        }),
        tap(data => {
          this.prepareChartOptions(data);
          this.isLoading = false;
        }),
        share()
      )
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      title: {
        text: $localize`:@@mining.difficulty:Difficulty`,
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
          formatter: function(val) {
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
