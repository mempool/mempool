import { Component, Inject, LOCALE_ID, ChangeDetectionStrategy, Input, OnChanges, OnInit } from '@angular/core';
import { formatDate, formatNumber } from '@angular/common';
import { EChartsOption } from '@app/graphs/echarts';
import { StateService } from '@app/services/state.service';

@Component({
  selector: 'app-lbtc-pegs-graph',
  styles: [`
  ::ng-deep .tx-wrapper-tooltip-chart { width: 135px; }
  .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 16px);
      z-index: 99;
    }
  `],
  templateUrl: './lbtc-pegs-graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LbtcPegsGraphComponent implements OnInit, OnChanges {
  @Input() data: any;
  @Input() height: number | string = '360';
  pegsChartOptions: EChartsOption;

  right: number | string = '10';
  top: number | string = '20';
  left: number | string = '50';
  template: ('widget' | 'advanced') = 'widget';
  isLoading = true;

  pegsChartInitOption = {
    renderer: 'svg'
  };

  constructor(
    public stateService: StateService,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit() {
    this.isLoading = true;
  }

  ngOnChanges() {
    if (!this.data?.liquidPegs) {
      return;
    }
    if (!this.data.liquidReserves) {
      this.pegsChartOptions = this.createChartOptions(this.data.liquidPegs.series, this.data.liquidPegs.labels);
    } else {
      this.pegsChartOptions = this.createChartOptions(this.data.liquidPegs.series, this.data.liquidPegs.labels, this.data.liquidReserves.series);
    }
  }

  rendered() {
    if (!this.data.liquidPegs) {
      return;
    }
    this.isLoading = false;
  }

  createChartOptions(pegSeries: number[], labels: string[], reservesSeries?: number[],): EChartsOption {
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
          for (let index = params.length - 1; index >= 0; index--) {
            const item = params[index];
            if (index < 26) {
              itemFormatted += `<div class="item">
                <div class="indicator-container">${colorSpan(item.color)}</div>
                <div style="margin-right: 5px"></div>
                <div class="value">${formatNumber(item.value, this.locale, '1.2-2')} <span class="symbol">${item.seriesName}</span></div>
              </div>`;
            }
          }
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
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        }
      },
      series: [
        {
          data: pegSeries,
          name: 'L-BTC',
          color: '#116761',
          type: 'line',
          stack: 'total',
          smooth: true,
          showSymbol: false,
          areaStyle: {
            opacity: 0.2,
            color: '#116761',
          },
          lineStyle: {
            width: 2,
            color: '#116761',
          },
        },
        {
          data: reservesSeries,
          name: 'BTC',
          color: '#EA983B',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 2,
            color: '#EA983B',
          },
        },
      ],
    };
  }
}

