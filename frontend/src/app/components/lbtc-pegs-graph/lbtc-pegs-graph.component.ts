import { Component, Inject, LOCALE_ID, ChangeDetectionStrategy, Input, OnChanges, OnInit } from '@angular/core';
import { formatDate, formatNumber } from '@angular/common';
import { EChartsOption } from '../../graphs/echarts';

@Component({
  selector: 'app-lbtc-pegs-graph',
  styles: [`
  ::ng-deep .tx-wrapper-tooltip-chart { width: 135px; }
  .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 16px);
      z-index: 100;
    }
  `],
  templateUrl: './lbtc-pegs-graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LbtcPegsGraphComponent implements OnInit, OnChanges {
  @Input() data: any;
  pegsChartOptions: EChartsOption;

  height: number | string = '200';
  right: number | string = '10';
  top: number | string = '20';
  left: number | string = '50';
  template: ('widget' | 'advanced') = 'widget';
  isLoading = true;

  pegsChartOption: EChartsOption = {};
  pegsChartInitOption = {
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
    this.pegsChartOptions = this.createChartOptions(this.data.series, this.data.labels);
  }

  rendered() {
    if (!this.data) {
      return;
    }
    this.isLoading = false;
  }

  createChartOptions(series: number[], labels: string[]): EChartsOption {
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
          const colorSpan = (color: string) => `<span class="indicator" style="background-color: #116761;"></span>`;
          let itemFormatted = '<div class="title">' + params[0].axisValue + '</div>';
          params.map((item: any, index: number) => {
            if (index < 26) {
              itemFormatted += `<div class="item">
                <div class="indicator-container">${colorSpan(item.color)}</div>
                <div class="grow"></div>
                <div class="value">${formatNumber(item.value, this.locale, '1.2-2')} <span class="symbol">L-BTC</span></div>
              </div>`;
            }
          });
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
        }
      },
      series: [
        {
          data: series,
          type: 'line',
          stack: 'total',
          smooth: false,
          showSymbol: false,
          areaStyle: {
            opacity: 0.2,
            color: '#116761',
          },
          lineStyle: {
            width: 3,
            color: '#116761',
          },
        },
      ],
    };
  }
}

