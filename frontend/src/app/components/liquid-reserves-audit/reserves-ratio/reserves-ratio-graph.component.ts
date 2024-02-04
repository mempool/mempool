import { Component, Inject, LOCALE_ID, ChangeDetectionStrategy, Input, OnChanges, OnInit } from '@angular/core';
import { formatDate, formatNumber } from '@angular/common';
import { EChartsOption } from '../../../graphs/echarts';

@Component({
  selector: 'app-reserves-ratio-graph',
  templateUrl: './reserves-ratio-graph.component.html',
  styleUrls: ['./reserves-ratio-graph.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservesRatioGraphComponent implements OnInit, OnChanges {
  @Input() data: any;
  ratioHistoryChartOptions: EChartsOption;
  ratioSeries: number[] = [];

  height: number | string = '200';
  right: number | string = '10';
  top: number | string = '20';
  left: number | string = '50';
  template: ('widget' | 'advanced') = 'widget';
  isLoading = true;

  ratioHistoryChartInitOptions = {
    renderer: 'svg'
  };

  constructor(
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit() {
    this.isLoading = true;
  }

  ngOnChanges() {
    if (!this.data) {
      return;
    }
    // Compute the ratio series: the ratio of the reserves to the pegs
    this.ratioSeries = this.data.liquidReserves.series.map((value: number, index: number) => value / this.data.liquidPegs.series[index]);
    // Truncate the ratio series and labels series to last 3 years
    this.ratioSeries = this.ratioSeries.slice(Math.max(this.ratioSeries.length - 36, 0));
    this.data.liquidPegs.labels = this.data.liquidPegs.labels.slice(Math.max(this.data.liquidPegs.labels.length - 36, 0));
    // Cut the values that are too high or too low
    this.ratioSeries = this.ratioSeries.map((value: number) => Math.min(Math.max(value, 0.995), 1.005));
    this.ratioHistoryChartOptions = this.createChartOptions(this.ratioSeries, this.data.liquidPegs.labels);
  }

  rendered() {
    if (!this.data) {
      return;
    }
    this.isLoading = false;
  }

  createChartOptions(ratioSeries: number[], labels: string[]): EChartsOption {
    return {
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
        extraCssText: `width: ${(this.template === 'widget') ? '125px' : '135px'};
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          const colorSpan = (color: string) => `<span class="indicator" style="background-color: ${color};"></span>`;
          let itemFormatted = '<div class="title">' + params[0].axisValue + '</div>';
          const item = params[0];
          const formattedValue = formatNumber(item.value, this.locale, '1.5-5');
          const symbol = (item.value === 1.005) ? '≥ ' : (item.value === 0.995) ? '≤ ' : '';
          itemFormatted += `<div class="item">
            <div class="indicator-container">${colorSpan(item.color)}</div>
            <div style="margin-right: 5px"></div>
            <div class="value">${symbol}${formattedValue}</div>
          </div>`;
          return `<div class="tx-wrapper-tooltip-chart ${(this.template === 'advanced') ? 'tx-wrapper-tooltip-chart-advanced' : ''}">${itemFormatted}</div>`;
        }
      },
      xAxis: {
        type: 'category',
        axisLabel: {
          align: 'center',
          fontSize: 11,
          lineHeight: 12
        },
        boundaryGap: false,
        data: labels.map((value: any) => `${formatDate(value, 'MMM\ny', this.locale)}`),
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
        },
        min: 0.995,
        max: 1.005,
      },
      series: [
        {
          data: ratioSeries,
          name: '',
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
              opacity: 1,
              width: 1,
            },
            data: [{
              yAxis: 1,
              label: {
                show: false,
                color: '#ffffff',
              }
            }],
          },
        },
      ],
      visualMap: {
        show: false,
        top: 50,
        right: 10,
        pieces: [{
          gt: 0,
          lte: 0.999,
          color: '#D81B60'
        },
        {
          gt: 0.999,
          lte: 1.001,
          color: '#FDD835'
        },
        {
          gt: 1.001,
          lte: 2,
          color: '#7CB342'
        }
        ],
        outOfRange: {
          color: '#999'
        }
      },
    };
  }
}

