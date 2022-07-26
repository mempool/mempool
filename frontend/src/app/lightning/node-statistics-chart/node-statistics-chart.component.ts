import { Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption } from 'echarts';
import { Observable } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { formatNumber } from '@angular/common';
import { FormGroup } from '@angular/forms';
import { StorageService } from 'src/app/services/storage.service';
import { download } from 'src/app/shared/graphs.utils';
import { LightningApiService } from '../lightning-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';

@Component({
  selector: 'app-node-statistics-chart',
  templateUrl: './node-statistics-chart.component.html',
  styleUrls: ['./node-statistics-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class NodeStatisticsChartComponent implements OnInit {
  @Input() publicKey: string;
  @Input() right: number | string = 65;
  @Input() left: number | string = 55;
  @Input() widget = false;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  blockSizesWeightsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private lightningApiService: LightningApiService,
    private storageService: StorageService,
    private activatedRoute: ActivatedRoute,
  ) {
  }

  ngOnInit(): void {

    this.activatedRoute.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.isLoading = true;
          return this.lightningApiService.listNodeStats$(params.get('public_key'))
            .pipe(
              tap((data) => {
                this.prepareChartOptions({
                  channels: data.map(val => [val.added * 1000, val.channels]),
                  capacity: data.map(val => [val.added * 1000, val.capacity]),
                });
                this.isLoading = false;
              }),
            );
        }),
      ).subscribe(() => {
      });
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.channels.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: `Loading`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      color: [
        '#FDD835',
        '#D81B60',
      ],
      grid: {
        top: 30,
        bottom: 70,
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
          let sizeString = '';
          let weightString = '';

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) { // Channels
              sizeString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-0')}`;
            } else if (tick.seriesIndex === 1) { // Capacity
              weightString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1] / 100000000, this.locale, '1.0-0')} BTC`;
            }
          }

          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          const tooltip = `<b style="color: white; margin-left: 18px">${date}</b><br>
            <span>${sizeString}</span><br>
            <span>${weightString}</span>`;

          return tooltip;
        }
      },
      xAxis: data.channels.length === 0 ? undefined : {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: data.channels.length === 0 ? undefined : {
        padding: 10,
        data: [
          {
            name: 'Channels',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Capacity',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: JSON.parse(this.storageService.getValue('sizes_ln_legend'))  ?? {
          'Channels': true,
          'Capacity': true,
        }
      },
      yAxis: data.channels.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${Math.round(val)}`;
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
            formatter: (val) => {
              return `${val / 100000000} BTC`;
            }
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: data.channels.length === 0 ? [] : [
        {
          zlevel: 1,
          name: 'Channels',
          showSymbol: false,
          symbol: 'none',
          data: data.channels,
          type: 'line',
          step: 'middle',
          lineStyle: {
            width: 2,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              type: 'solid',
              color: '#ffffff66',
              opacity: 1,
              width: 1,
            },
          }
        },
        {
          zlevel: 0,
          yAxisIndex: 1,
          name: 'Capacity',
          showSymbol: false,
          symbol: 'none',
          stack: 'Total',
          data: data.capacity,
          areaStyle: {},
          type: 'line',
          step: 'middle',
        }
      ],
    };
  }

  onChartInit(ec) {
    if (this.chartInstance !== undefined) {
      return;
    }

    this.chartInstance = ec;

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('sizes_ln_legend', JSON.stringify(e.selected));
    });
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
    }), `block-sizes-weights-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
