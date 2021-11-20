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


  filterLabelDates(labels: any) {
    let labelDates = [];

    if (labels.length > 0) {
      for (let index = 0; index < labels.length; index++) {
        const labelDate = new Date(labels[index]);

        // add the first date to the array
        if (index === 0) {
          labelDates.push(labelDate.toISOString());
        } else {

          // mobile sizes
          if(window.innerWidth < 500) {

            if (this.windowPreference === '2h') {
              if (labelDate.getMinutes() % 60 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '24h') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 2 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '1w') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 6 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '1m') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 12 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

          }

          // tablet sizes
          if (window.innerWidth > 500 && window.innerWidth < 900) {

            if (this.windowPreference === '2h') {
              if (labelDate.getMinutes() % 20 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '24h') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 2 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '1w') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 2 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '1m') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 6 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

          }

          // PC sizes
          if (window.innerWidth > 900) {

            if (this.windowPreference === '2h') {
              if (labelDate.getMinutes() % 10 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '24h') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 2 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '1w') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 4 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

            if (this.windowPreference === '1m') {
              if (labelDate.getMinutes() % 60 === 0 &&
                  labelDate.getHours() % 12 === 0) {
                labelDates.push(labelDate.toISOString());
              }
            }

          }
        }
      }
    }
    // use the default
    if (this.template === 'widget' ||
        this.windowPreference === '3m' ||
        this.windowPreference === '6m' ||
        this.windowPreference === '1y' ||
        this.windowPreference === '2y' ||
        this.windowPreference === '3y') {
      labelDates = [];
    }
    return labelDates;
  }

  mountChart(): void {

    const labelDates = this.filterLabelDates(this.data.labels);


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
        axisTick: {
          alignWithLabel: true,
          lineStyle: {
            width: 0,
          },
        },
        axisLabel: {
          interval: labelDates.length ? labelDates.length : 'auto',
          align: 'center',
          fontSize: 11,
          lineHeight: 25,
          customValues: labelDates.length ? labelDates : null,
          formatter: (value: string, index: number) => {
            const date = new Date(value);
            if (this.template === 'widget') {
              return date.toLocaleTimeString(this.locale, { hour: 'numeric', minute: 'numeric' });
            }

            // first date
            if (index === 0) {
              return date.toLocaleDateString(this.locale, {  year: '2-digit', month: 'short', 'day': 'numeric' });
            }

            switch (this.windowPreference) {
              case '2h':
                return date.toLocaleTimeString(this.locale, { hour: 'numeric', minute: 'numeric' });
              case '24h':
                return date.toLocaleTimeString(this.locale, { hour: 'numeric' });
              case '1w':
                return date.toLocaleDateString(this.locale, { month: 'short', day: 'numeric', weekday: 'short' });
              case '1m':
              case '3m':
              case '6m':
              case '1y':
                return date.toLocaleDateString(this.locale, { month: 'short', day: 'numeric' });
              case '2y':
              case '3y':
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
}
