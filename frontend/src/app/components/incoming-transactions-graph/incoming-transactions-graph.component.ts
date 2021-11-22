import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy } from '@angular/core';
import { EChartsOption } from '@mempool/echarts';
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

  addMinutes =  function (dt: Date, minutes: number) {
    return new Date(dt.getTime() + minutes * 60000);
  }

  filterLabelDates(labels: any) {
    let labelDates = [];

    if (labels.length > 0) {
      const firstDate = new Date(labels[0]);
      const lastDate = new Date(labels[labels.length - 1]);
      let currentDate = firstDate;

      currentDate.setUTCMilliseconds(0);
      currentDate.setUTCSeconds(0);
      currentDate.setUTCMinutes(0);

      if (this.template !== 'widget') {

        if(['1w', '1m', '2m', '3m', '6m', '1y', '2y', '3y'].includes(this.windowPreference)){
          currentDate.setUTCMinutes(0);
        }

        if(['6m', '1y', '2y', '3y'].includes(this.windowPreference)){
          currentDate.setUTCHours(0);
        }
      }

      let timeIntervals = {
        '2h' : 10,           // 10 mins
        '24h': 120,          //  2 hours
        '1w' : 60 * 24,      //  1 day
        '1m' : 60 * 24 * 7,  //  7 days
        '3m' : 60 * 24 * 7,  //  7 days
        '6m' : 60 * 24 * 15, // 15 days
        '1y' : 60 * 24 * 30, // 30 days
        '2y' : 60 * 24 * 60, // 30 days
        '3y' : 60 * 24 * 60, // 30 days
      };

      if (window.innerWidth < 600 || this.template === 'widget') {
        timeIntervals = {
          '2h' : 30,           // 30 mins
          '24h': 60 * 6,       //  6 hours
          '1w' : 60 * 48,      //  2 day
          '1m' : 60 * 24 * 7,  //  7 days
          '3m' : 60 * 24 * 7,  // 15 days
          '6m' : 60 * 24 * 30, // 30 days
          '1y' : 60 * 24 * 30, // 30 days
          '2y' : 60 * 24 * 60, // 30 days
          '3y' : 60 * 24 * 60, // 30 days
        };
      }

      const windowPreference = this.windowPreference in timeIntervals && this.template !== 'widget' ? this.windowPreference : '2h';
      while (currentDate.getTime() < lastDate.getTime()) {
        currentDate = this.addMinutes(currentDate, timeIntervals[windowPreference]);
        labelDates.push(currentDate.toISOString());
      }
    }

    return labelDates;
  }

  mountChart(): void {

    const labelsData = this.data.labels.map((label: string, index: number) => {
      const date = new Date(label);

      date.setUTCMilliseconds(0);
      date.setUTCSeconds(0);

      if (this.template !== 'widget') {

        if(['1w', '1m', '2m', '3m', '6m', '1y', '2y', '3y'].includes(this.windowPreference)){
          date.setUTCMinutes(0);
        }

        if(['6m', '1y', '2y', '3y'].includes(this.windowPreference)){
          date.setUTCHours(0);
        }
      }

      return date.toISOString();
    })
    const labelsFiltered = this.filterLabelDates(this.data.labels);


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
        maxSpan: 100,
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
            case '2y':
            case '3y':
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
        data: labelsData,
        axisTick: {
          alignWithLabel: true,
          lineStyle: {
            width: 1,
          },
          customValues: ['1y', '2y', '3y'].includes(this.windowPreference) ? null : labelsFiltered,
        },
        axisLabel: {
          interval: ['1y', '2y', '3y'].includes(this.windowPreference) ? 'auto' : labelsFiltered.length,
          align: 'center',
          fontSize: 11,
          lineHeight: 25,
          customValues: ['1y', '2y', '3y'].includes(this.windowPreference) ? null : labelsFiltered,
          formatter: (value: string, index: number) => {

            if(value.length === 0){
              return null;
            }

            const date = new Date(value);
            if (this.template === 'widget') {
              return date.toLocaleTimeString(this.locale, { hour: 'numeric', minute: 'numeric' });
            }

            switch (this.windowPreference) {
              case '2h':
                return date.toLocaleTimeString(this.locale, { hour: 'numeric', minute: 'numeric' });
              case '24h':
                return date.toLocaleTimeString(this.locale, { hour: 'numeric' });
              case '1w':
              case '1m':
                return date.toLocaleDateString(this.locale, { month: 'short', day: 'numeric', weekday: 'short' });
              case '3m':
              case '6m':
                return date.toLocaleDateString(this.locale, { month: 'short', day: 'numeric' });
              case '1y':
              case '2y':
              case '3y':
                return date.toLocaleDateString(this.locale, { year: 'numeric', month: 'short' });
            }
          }
        },
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
}
