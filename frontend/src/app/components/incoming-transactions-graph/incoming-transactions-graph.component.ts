import { Component, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { OnChanges } from '@angular/core';
import { StorageService } from '@app/services/storage.service';
import { download, formatterXAxis, formatterXAxisLabel } from '@app/shared/graphs.utils';
import { formatNumber } from '@angular/common';
import { StateService } from '@app/services/state.service';
import { Subscription } from 'rxjs';

const OUTLIERS_MEDIAN_MULTIPLIER = 4;

@Component({
  selector: 'app-incoming-transactions-graph',
  templateUrl: './incoming-transactions-graph.component.html',
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 16px);
      z-index: 99;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncomingTransactionsGraphComponent implements OnInit, OnChanges, OnDestroy {
  @Input() data: any;
  @Input() theme: string;
  @Input() height: number | string = '200';
  @Input() right: number | string = '10';
  @Input() top: number | string = '20';
  @Input() left: number | string = '0';
  @Input() template: ('widget' | 'advanced') = 'widget';
  @Input() windowPreferenceOverride: string;
  @Input() outlierCappingEnabled: boolean = false;
  @Input() isLoading: boolean;

  mempoolStatsChartOption: EChartsOption = {};
  mempoolStatsChartInitOption = {
    renderer: 'svg'
  };
  windowPreference: string;
  chartInstance: any = undefined;
  MA: number[][] = [];
  weightMode: boolean = false;
  rateUnitSub: Subscription;
  medianVbytesPerSecond: number | undefined;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private storageService: StorageService,
    public stateService: StateService,
  ) { }

  ngOnInit() {
    this.rateUnitSub = this.stateService.rateUnits$.subscribe(rateUnits => {
      this.weightMode = rateUnits === 'wu';
      if (this.data) {
        this.mountChart();
      }
    });
  }

  ngOnChanges(): void {
    if (!this.data) {
      return;
    }
    this.windowPreference = (this.windowPreferenceOverride ? this.windowPreferenceOverride : this.storageService.getValue('graphWindowPreference')) || '2h';
    const windowSize = Math.max(10, Math.floor(this.data.series[0].length / 8));
    this.MA = this.calculateMA(this.data.series[0], windowSize);
    if (this.outlierCappingEnabled === true) {
      this.computeMedianVbytesPerSecond(this.data.series[0]);
    }
    this.mountChart();
  }

  rendered() {
    if (!this.data) {
      return; 
    }
  }

  /**
   * Calculate the median value of the vbytes per second chart to hide outliers
   */
  computeMedianVbytesPerSecond(data: number[][]): void {
    const vBytes: number[] = [];
    for (const value of data) {
      vBytes.push(value[1]);
    }
    const sorted = vBytes.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    this.medianVbytesPerSecond = sorted[middle];
    if (sorted.length % 2 === 0) {
      this.medianVbytesPerSecond = (sorted[middle - 1] + sorted[middle]) / 2;
    }
  }

  /// calculate the moving average of the provided data based on windowSize
  calculateMA(data: number[][], windowSize: number = 100): number[][] {
    //update const variables that are not changed
    const ma: number[][] = [];
    let sum = 0;
    let i = 0;

    //calculate the centered moving average
    for (i = 0; i < data.length; i++) {
      sum += data[i][1];
      if (i >= windowSize) {
        sum -= data[i - windowSize][1];
        const midpoint = i - Math.floor(windowSize / 2);
        const avg = sum / windowSize;
        ma.push([data[midpoint][0], avg]);
      }
    }

    //return the moving average array
    return ma;
  }

  mountChart(): void {
    //create an array for the echart series
    //similar to how it is done in mempool-graph.component.ts
    const seriesGraph = [];
    seriesGraph.push({
      zlevel: 0,
      name: 'data',
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
    });
    if (this.template !== 'widget') {
      seriesGraph.push({
        zlevel: 0,
        name: 'MA',
        data: this.MA,
        type: 'line',
        smooth: false,
        showSymbol: false,
        symbol: 'none',
        lineStyle: {
          width: 2,
          color: "white",
        }
      });
    }

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
        extraCssText: `background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          const bestItem = params.reduce((best, item) => {
            return (item.seriesName === 'data' && (!best || best.value[1] < item.value[1])) ? item : best;
          }, null);
          const axisValueLabel: string = formatterXAxis(this.locale, this.windowPreference, bestItem.axisValue);
          const colorSpan = (color: string) => `<span class="indicator" style="background-color: ` + color + `"></span>`;
          let itemFormatted = '<div class="title">' + axisValueLabel + '</div>';
          if (bestItem) {
            itemFormatted += `<div class="item">
                  <div class="indicator-container">${colorSpan(bestItem.color)}</div>
                  <div class="grow"></div>
                  <div class="value">${formatNumber(bestItem.value[1], this.locale, '1.0-0')} <span class="symbol">vB/s</span></div>
                </div>`;
          }
          return `<div class="tx-wrapper-tooltip-chart ${(this.template === 'advanced') ? 'tx-wrapper-tooltip-chart-advanced' : ''}" 
                  style="width: ${(this.windowPreference === '2h' || this.template === 'widget') ? '125px' : '215px'}">${itemFormatted}</div>`;
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
        max: (value): number => {
          let cappedMax = value.max;
          if (this.outlierCappingEnabled && value.max >= (this.medianVbytesPerSecond * OUTLIERS_MEDIAN_MULTIPLIER)) {
            cappedMax = Math.round(this.medianVbytesPerSecond * OUTLIERS_MEDIAN_MULTIPLIER);
          }
          // always show the clearing rate line, plus a small margin
          return Math.max(1800, cappedMax);
        },
        type: 'value',
        axisLabel: {
          fontSize: 11,
          formatter: (value): string => {
            return this.weightMode ? (value * 4).toString() : value.toString();
          }
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        }
      },
      series: seriesGraph,
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
    this.mempoolStatsChartOption.backgroundColor = 'var(--active-bg)';
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

  ngOnDestroy(): void {
    this.rateUnitSub.unsubscribe();
  }
}
