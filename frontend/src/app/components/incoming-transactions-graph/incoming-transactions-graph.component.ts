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
  @Input() left: number | string = '0';
  @Input() template: ('widget' | 'advanced') = 'widget';

  mempoolStatsChartOption: EChartsOption = {};
  mempoolStatsChartInitOption = {
    renderer: 'svg'
  };
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
      animation: false,
      dataZoom: [{
        type: 'inside',
        realtime: true,
        zoomOnMouseWheel: (this.template === 'advanced') ? true : false,
        maxSpan: (window.innerWidth >= 850 || this.template === 'widget') ? 100 : 40,
        minSpan: 10,
      }, {
        show: (this.template === 'advanced') ? true : false,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        labelFormatter: (value, valueStr) => {
          const date = new Date (valueStr);
          switch (this.windowPreference) {
            case '1w':
            case '1m':
              return date.toLocaleDateString(this.locale, { month: 'short', weekday: 'short', day: 'numeric' });
            case '3m':
            case '6m':
            case '1y':
              return date.toLocaleDateString(this.locale, { year: 'numeric', month: 'short' });
            default: // 2m, 24h
              return date.toLocaleTimeString(this.locale, { hour: 'numeric', minute: 'numeric' });
          }
        },
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
        extraCssText: `width: ${(['2h', '24h'].includes(this.windowPreference) || this.template === 'widget') ? '125px' : '135px'};
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          const colorSpan = (color: string) => `<span class="indicator" style="background-color: ` + color + `"></span>`;
          const date = new Date(params[0].axisValue);
          let itemFormatted = '<div class="title">' + date.toLocaleDateString(this.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }) + '</div>';
          params.map((item: any, index: number) => {
            if (index < 26) {
              itemFormatted += `<div class="item">
                <div class="indicator-container">${colorSpan(item.color)}</div>
                <div class="grow"></div>
                <div class="value">${item.value} <span class="symbol">vB/s</span></div>
              </div>`;
            }
          });
          return `<div class="tx-wrapper-tooltip-chart ${(this.template === 'advanced') ? 'tx-wrapper-tooltip-chart-advanced' : ''}">${itemFormatted}</div>`;
        }
      },
      xAxis: {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
          lineStyle: {
            width: 1,
          },
          length: 8
        },
        axisLabel: {
          interval: this.getAxisLabelInterval(),
          align: 'center',
          fontSize: 11,
          lineHeight: 25,
          margin: 11,
          formatter: (value: string, index: number) => {
            const date = new Date(value);
            if (this.template !== 'advanced') {
              const dayControl = date.getDay();
              if (index === 0) {
                return date.toLocaleTimeString(this.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
              } else {
                if (dayControl < date.getDay()) {
                  return date.toLocaleTimeString(this.locale, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
                } else {
                  return date.toLocaleTimeString(this.locale, { hour: 'numeric', minute: 'numeric' });
                }
              }
            }
            const dayControl = date.getDay();
            switch (this.windowPreference) {
              case '2h':
                if (index === 0) {
                  return date.toLocaleTimeString(this.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' });
                } else {
                  if (dayControl < date.getDay()) {
                    return date.toLocaleTimeString(this.locale, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' });
                  } else {
                    return date.toLocaleTimeString(this.locale, { hour: 'numeric', minute: 'numeric' });
                  }
                }
              case '24h':
                if (index === 0) {
                  return date.toLocaleTimeString(this.locale, { month: 'short', day: 'numeric', hour: 'numeric' });
                } else {
                  if (dayControl < date.getDay()) {
                    return date.toLocaleTimeString(this.locale, { month: 'numeric', day: 'numeric', hour: 'numeric' });
                  } else {
                    return date.toLocaleTimeString(this.locale, { hour: 'numeric' });
                  }
                }
              case '1w':
              case '1m':
                return date.toLocaleDateString(this.locale, { month: 'short', weekday: 'short', day: 'numeric' });
              case '3m':
              case '6m':
              case '1y':
                return date.toLocaleDateString(this.locale, { year: 'numeric', month: 'short' });
            }
          }
        },
        data: this.data.labels,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
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
          data: this.data.series[0],
          type: 'line',
          smooth: false,
          showSymbol: false,
          lineStyle: {
            width: 3,
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#fff',
              opacity: 1,
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
  getAxisLabelInterval() {
    if (this.template !== 'advanced') {
      return 30;
    }
    switch (this.windowPreference) {
      case '2h':
        return 14;
      case '24h':
        return 40;
      case '1w':
        return 68;
      case '1m':
        return 112;
      case '3m':
        return 140;
      case '6m':
        return 70;
      case '1y':
        return 40;
      default:
        return 5;
    }
  }
}
