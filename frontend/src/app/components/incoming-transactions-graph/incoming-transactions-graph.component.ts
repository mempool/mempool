import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy } from '@angular/core';
import { formatDate } from '@angular/common';
import { EChartsOption } from 'echarts';
import { OnChanges } from '@angular/core';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  selector: 'app-incoming-transactions-graph',
  templateUrl: './incoming-transactions-graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingTransactionsGraphComponent implements OnInit, OnChanges {
  @Input() data: any;
  @Input() theme: string;
  @Input() height: number | string = '200';
  @Input() right: number | string = '10';
  @Input() top: number | string = '20';
  @Input() left: number | string = '50';
  @Input() size: ('small' | 'big') = 'small';

  mempoolStatsChartOption: EChartsOption = {};
  windowPreference: string;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private storageService: StorageService,
  ) { }

  ngOnChanges(): void {
    this.windowPreference = this.storageService.getValue('graphWindowPreference');
    this.mountChart();
  }

  ngOnInit(): void {
    this.mountChart();
  }

  mountChart(): void {
    this.mempoolStatsChartOption = {
      grid: {
        height: this.height,
        right: this.right,
        top: this.top,
        left: this.left,
      },
      dataZoom: [{
        type: 'inside',
        realtime: true,
      }, {
        show: (this.size === 'big') ? true : false,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
          areaStyle: {
            opacity: 0,
          }
        }
      }],
      tooltip: {
        trigger: 'axis',
        position: (pos, params, el, elRect, size) => {
          const obj = { top: -20 };
          obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 80;
          return obj;
        },
        extraCssText: `width: ${(['2h', '24h'].includes(this.windowPreference) || this.size === 'small') ? '105px' : '135px'};
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          const colorSpan = (color: string) => `<div class="indicator" style="background-color: ` + color + `"></div>`;
          let itemFormatted = '<div class="title">' + params[0].axisValue + '</div>';
          params.map((item: any, index: number) => {
            if (index < 26) {
              itemFormatted += `<div class="item">
                ${colorSpan(item.color)}
                <div class="grow"></div>
                <div class="value">${item.value}</div>
              </div>`;
            }
          });
          return `<div class="tx-wrapper-tooltip-chart ${(this.size === 'big') ? 'tx-wrapper-tooltip-chart-big' : ''}">${itemFormatted}</div>`;
        }
      },
      xAxis: {
        type: 'category',
        data: this.data.labels.map((value: any) => {
          if (['2h', '24h'].includes(this.windowPreference) || this.size === 'small') {
            return formatDate(value, 'HH:mm', this.locale);
          } else {
            return formatDate(value, 'MM/dd - HH:mm', this.locale);
          }
        }),
      },
      yAxis: {
        type: 'value',
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
          data: this.data.series[0],
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 3,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#fff',
              opacity: 0.75,
              width: 2,
            },
            data: [{
              yAxis: 1667,
              label: {
                show: false,
                color: '#ffffff',
              }
            }],
          }
        },
      ],
      visualMap: {
        show: false,
        top: 50,
        right: 10,
        pieces: [{
          gt: 0,
          lte: 1667,
          color: '#7CB342'
        },
        {
          gt: 1667,
          lte: 2000,
          color: '#FDD835'
        },
        {
          gt: 2000,
          lte: 2500,
          color: '#FFB300'
        },
        {
          gt: 2500,
          lte: 3000,
          color: '#FB8C00'
        },
        {
          gt: 3000,
          lte: 3500,
          color: '#F4511E'
        },
        {
          gt: 3500,
          color: '#D81B60'
        }],
        outOfRange: {
          color: '#999'
        }
      },
    };
  }
}
