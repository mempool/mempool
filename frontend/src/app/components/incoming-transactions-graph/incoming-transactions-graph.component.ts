import { Component, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { EChartsOption } from 'echarts';
import { OnChanges } from '@angular/core';
import { StorageService } from '../../services/storage.service';
import { download, formatterXAxis, formatterXAxisLabel } from '../../shared/graphs.utils';
import { formatNumber } from '@angular/common';

@Component({
  selector: 'app-incoming-transactions-graph',
  templateUrl: './incoming-transactions-graph.component.html',
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 16px);
      z-index: 100;
    }
  `],
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
  @Input() windowPreferenceOverride: string;

  isLoading = true;
  mempoolStatsChartOption: EChartsOption = {};
  mempoolStatsChartInitOption = {
    renderer: 'svg'
  };
  windowPreference: string;
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private storageService: StorageService,
  ) { }

  ngOnInit() {
    this.isLoading = true;
  }

  ngOnChanges(): void {
    if (!this.data) {
      return;
    }
    this.windowPreference = this.windowPreferenceOverride ? this.windowPreferenceOverride : this.storageService.getValue('graphWindowPreference');
    this.mountChart();
  }

  rendered() {
    if (!this.data) {
      return;
    }
    this.isLoading = false;
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
      dataZoom: (this.template === 'widget' && this.isMobile()) ? null : [{
        type: 'inside',
        realtime: true,
        zoomLock: (this.template === 'widget') ? true : false,
        zoomOnMouseWheel: (this.template === 'advanced') ? true : false,
        moveOnMouseMove: (this.template === 'widget') ? true : false,
        maxSpan: 100,
        minSpan: 10,
      }, {
        showDetail: false,
        show: (this.template === 'advanced') ? true : false,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        bottom: 0,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
          areaStyle: {
            opacity: 0,
          }
        },
      }],
      tooltip: {
        show: !this.isMobile(),
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
          const axisValueLabel: string = formatterXAxis(this.locale, this.windowPreference, params[0].axisValue);         
          const colorSpan = (color: string) => `<span class="indicator" style="background-color: ` + color + `"></span>`;
          let itemFormatted = '<div class="title">' + axisValueLabel + '</div>';
          params.map((item: any, index: number) => {
            if (index < 26) {
              itemFormatted += `<div class="item">
                <div class="indicator-container">${colorSpan(item.color)}</div>
                <div class="grow"></div>
                <div class="value">${formatNumber(item.value[1], this.locale, '1.0-0')}<span class="symbol">vB/s</span></div>
              </div>`;
            }
          });
          return `<div class="tx-wrapper-tooltip-chart ${(this.template === 'advanced') ? 'tx-wrapper-tooltip-chart-advanced' : ''}">${itemFormatted}</div>`;
        }
      },
      xAxis: [
        {
          name: this.template === 'widget' ? '' : formatterXAxisLabel(this.locale, this.windowPreference),
          nameLocation: 'middle',
          nameTextStyle: {
            padding: [20, 0, 0, 0],
          },
          type: 'time',
          axisLabel: {
            margin: 20,
            align: 'center',
            fontSize: 11,
            lineHeight: 12,
            hideOverlap: true,
            padding: [0, 5],
          },
        }
      ],
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
          zlevel: 0,
          data: this.data.series[0],
          type: 'line',
          smooth: false,
          showSymbol: false,
          symbol: 'none',
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

  onChartInit(ec) {
    this.chartInstance = ec;
  }

  isMobile() {
    return window.innerWidth <= 767.98;
  }

  onSaveChart(timespan) {
    // @ts-ignore
    const prevHeight = this.mempoolStatsChartOption.grid.height;
    const now = new Date();
    // @ts-ignore
    this.mempoolStatsChartOption.grid.height = prevHeight + 20;
    this.mempoolStatsChartOption.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.mempoolStatsChartOption);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `incoming-vbytes-${timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.mempoolStatsChartOption.grid.height = prevHeight;
    this.mempoolStatsChartOption.backgroundColor = 'none';
    this.chartInstance.setOption(this.mempoolStatsChartOption);
  }
}
