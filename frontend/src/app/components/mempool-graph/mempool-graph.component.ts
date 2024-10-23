import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { VbytesPipe } from '@app/shared/pipes/bytes-pipe/vbytes.pipe';
import { WuBytesPipe } from '@app/shared/pipes/bytes-pipe/wubytes.pipe';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';
import { formatNumber } from '@angular/common';
import { OptimizedMempoolStats } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { StorageService } from '@app/services/storage.service';
import { EChartsOption } from '@app/graphs/echarts';
import { feeLevels, chartColors } from '@app/app.constants';
import { download, formatterXAxis, formatterXAxisLabel } from '@app/shared/graphs.utils';

@Component({
  selector: 'app-mempool-graph',
  templateUrl: './mempool-graph.component.html',
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
export class MempoolGraphComponent implements OnInit, OnChanges {
  @Input() data: any[];
  @Input() filterSize = 100000;
  @Input() limitFilterFee = 1;
  @Input() hideCount: boolean = true;
  @Input() height: number | string = 200;
  @Input() top: number | string = 20;
  @Input() right: number | string = 10;
  @Input() left: number | string = 75;
  @Input() template: ('widget' | 'advanced') = 'widget';
  @Input() showZoom = true;
  @Input() windowPreferenceOverride: string;
  @Input() isLoading: boolean;

  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: EChartsOption;
  mempoolVsizeFeesInitOptions = {
    renderer: 'svg',
  };
  windowPreference: string;
  hoverIndexSerie = 0;
  maxFee: number;
  feeLimitIndex: number;
  maxFeeIndex: number;
  feeLevelsOrdered = [];
  chartColorsOrdered = chartColors;
  inverted: boolean;
  chartInstance: any = undefined;
  weightMode: boolean = false;
  isWidget: boolean = false;
  showCount: boolean = false;

  constructor(
    private vbytesPipe: VbytesPipe,
    private wubytesPipe: WuBytesPipe,
    private amountShortenerPipe: AmountShortenerPipe,
    public stateService: StateService,
    private storageService: StorageService,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.inverted = this.storageService.getValue('inverted-graph') === 'true';
    this.isWidget = this.template === 'widget';
    this.showCount = !this.isWidget && !this.hideCount;
  }

  ngOnChanges(changes) {
    if (!this.data) {
      return;
    }
    this.isWidget = this.template === 'widget';
    this.showCount = !this.isWidget && !this.hideCount;
    this.windowPreference = (this.windowPreferenceOverride ? this.windowPreferenceOverride : this.storageService.getValue('graphWindowPreference')) || '2h';
    this.mempoolVsizeFeesData = this.handleNewMempoolData(this.data.concat([]));
    this.mountFeeChart();
  }

  rendered() {
    if (!this.data) {
      return;
    }
  }

  onChartReady(myChart: any) {
    myChart.getZr().on('mousemove', (e: any) => {
      if (e.target !== undefined &&
        e.target.parent !== undefined &&
        e.target.parent.parent !== null &&
        e.target.parent.parent.__ecComponentInfo !== undefined) {
          this.hoverIndexSerie = e.target.parent.parent.__ecComponentInfo.index;
      }
    });
    this.chartInstance = myChart;
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);
    const finalArrayVByte = this.generateArray(mempoolStats);
    const finalArrayCount = this.generateCountArray(mempoolStats);

    return {
      labels: labels,
      series: finalArrayVByte,
      countSeries: finalArrayCount,
    };
  }

  generateArray(mempoolStats: OptimizedMempoolStats[]) {
    const finalArray: number[][][] = [];
    let feesArray: number[][] = [];

    let maxTier = 0;
    for (let index = 37; index > -1; index--) {
      feesArray = [];
      mempoolStats.forEach((stats) => {
        if (stats.vsizes[index] >= this.filterSize) {
          maxTier = Math.max(maxTier, index);
        }
        feesArray.push([stats.added * 1000, stats.vsizes[index] ? stats.vsizes[index] : 0]);
      });
      finalArray.push(feesArray);
    }
    this.maxFeeIndex = maxTier;

    finalArray.reverse();
    return finalArray;
  }

  generateCountArray(mempoolStats: OptimizedMempoolStats[]) {
    return mempoolStats.filter(stats => stats.count > 0).map(stats => [stats.added * 1000, stats.count]);
  }

  mountFeeChart() {
    this.orderLevels();
    const { series, countSeries } = this.mempoolVsizeFeesData;

    const seriesGraph = [];
    const newColors = [];
    for (let index = 0; index < series.length; index++) {
      const value = series[index];
      if (index >= this.feeLimitIndex && index <= this.maxFeeIndex) {
        newColors.push(this.chartColorsOrdered[index]);
        seriesGraph.push({
          zlevel: 0,
          name: this.feeLevelsOrdered[index],
          type: 'line',
          stack: 'fees',
          smooth: false,
          markPoint: {
            symbol: 'rect',
          },
          lineStyle: {
            width: 0,
            opacity: 0,
          },
          symbol: 'none',
          emphasis: {
            focus: 'none',
            areaStyle: {
              opacity: 0.85,
            },
          },
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: {
              color: '#fff',
              opacity: 1,
              width: this.inverted ? 2 : 0,
            },
            data: [{
              yAxis: '1000000',
              label: {
                show: false,
                color: '#ffffff',
              }
            }],
          },
          areaStyle: {
            color: this.chartColorsOrdered[index],
            opacity: 1,
          },
          data: value
        });
      }
    }
    if (this.showCount) {
      newColors.push('white');
      seriesGraph.push({
        zlevel: 1,
        yAxisIndex: 1,
        name: 'count',
        type: 'line',
        stack: 'count',
        smooth: false,
        markPoint: false,
        lineStyle: {
          width: 2,
          opacity: 1,
        },
        symbol: 'none',
        silent: true,
        areaStyle: {
          color: null,
          opacity: 0,
        },
        data: countSeries,
      });
    }

    this.mempoolVsizeFeesOptions = {
      series: this.inverted ? [...seriesGraph].reverse() : seriesGraph,
      hover: true,
      color: this.inverted ? [...newColors].reverse() : newColors,
      tooltip: {
        show: !this.isMobile(),
        trigger: 'axis',
        alwaysShowContent: false,
        position: (pos, params, el, elRect, size) => {
          const positions = { top: (this.template === 'advanced') ? 0 : -30 };
          positions[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 100;
          return positions;
        },
        extraCssText: `width: ${(this.template === 'advanced') ? '300px' : '200px'};
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'cross',
          label: {
            formatter: (params: any) => {
              if (params.axisDimension === 'y') {
                if (params.axisIndex === 0) {
                  return this.vbytesPipe.transform(params.value, 2, 'vB', 'MvB', true);
                } else {
                  return this.amountShortenerPipe.transform(params.value, 2, undefined, true);
                }
              } else {
                return formatterXAxis(this.locale, this.windowPreference, params.value);
              }
            }
          }
        },
        formatter: (params: any) => {
          const axisValueLabel: string = formatterXAxis(this.locale, this.windowPreference, params[0].axisValue);
          const { totalValue, totalValueArray } = this.getTotalValues(params);
          const itemFormatted = [];
          let sum = 0;
          let progressPercentageText = '';
          const unfilteredItems = this.inverted ? [...params].reverse() : params;
          const countItem = unfilteredItems.find(p => p.seriesName === 'count');
          const usedSeries = {};
          const items = unfilteredItems.filter(p => {
            if (usedSeries[p.seriesName] || p.seriesName === 'count') {
              return false;
            }
            usedSeries[p.seriesName] = true;
            return true;
          });

          items.map((item: any, index: number) => {
            sum += item.value[1];
            const progressPercentage = (item.value[1] / totalValue) * 100;
            const progressPercentageSum = (totalValueArray[index] / totalValue) * 100;
            let activeItemClass = '';
            let hoverActive = 0;
            if (this.inverted) {
              hoverActive = Math.abs(this.feeLevelsOrdered.length - item.seriesIndex - this.feeLevelsOrdered.length);
            } else {
              hoverActive = item.seriesIndex;
            }
            if (this.hoverIndexSerie === hoverActive) {
              progressPercentageText = `<div class="total-parcial-active">
                <span class="progress-percentage">
                  ${formatNumber(progressPercentage, this.locale, '1.2-2')}
                  <span class="symbol">%</span>
                </span>
                <span class="total-parcial-vbytes">
                  ${this.vbytesPipe.transform(sum, 2, 'vB', 'MvB', false)}
                </span>
                <div class="total-percentage-bar">
                  <span class="total-percentage-bar-background">
                    <span style="
                      width: ${progressPercentage}%;
                      background: ${item.color}
                    "></span>
                  </span>
                </div>
              </div>`;
              activeItemClass = 'active';
            }
            itemFormatted.push(`<tr class="item ${activeItemClass}">
              <td class="indicator-container">
                <span class="indicator" style="
                  background-color: ${item.color}
                "></span>
                <span>
                  ${item.seriesName}
                </span>
              </td>
              <td class="total-progress-sum">
                <span>
                  ${(item.value[1] / 1_000_000).toFixed(2)} <span class="symbol">MvB</span>
                </span>
              </td>
              <td class="total-progress-sum">
                <span>
                  ${(totalValueArray[index] / 1_000_000).toFixed(2)} <span class="symbol">MvB</span>
                </span>
              </td>
              <td class="total-progress-sum-bar">
                <span class="total-percentage-bar-background">
                  <span style="
                    width: ${progressPercentageSum.toFixed(2)}%;
                    background-color: ${this.chartColorsOrdered[3]}
                  "></span>
                </span>
              </td>
            </tr>`);
          });
          const classActive = (this.template === 'advanced') ? 'fees-wrapper-tooltip-chart-advanced' : '';
          const titleCount = $localize`Count`;
          const titleRange = $localize`Range`;
          const titleSize = $localize`:@@7faaaa08f56427999f3be41df1093ce4089bbd75:Size`;
          const titleSum = $localize`Sum`;
          return `<div class="fees-wrapper-tooltip-chart ${classActive}">
            <div class="title">
              ${axisValueLabel}
              <span class="total-value">
                ${this.vbytesPipe.transform(totalValue, 2, 'vB', 'MvB', false)}
              </span>
            </div>
            ` +
              (this.showCount && countItem ? `
                <table class="count">
                  <tbody>
                    <tr class="item">
                      <td class="indicator-container">
                        <span class="indicator" style="background-color: white"></span>
                        <span>
                          ${titleCount}
                        </span>
                      </td>
                      <td style="text-align: right;">
                        <span>${this.amountShortenerPipe.transform(countItem.value[1], 2, undefined, true)}</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              ` : '')
            + `
            <table>
              <thead>
                <tr>
                  <th>${titleRange}</th>
                  <th>${titleSize}</th>
                  <th>${titleSum}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${this.inverted ? itemFormatted.join('') : itemFormatted.reverse().join('')}
              </tbody>
            </table>
            <span class="total-value">
              ${progressPercentageText}
            </span>
          </div>`;
        }
      },
      dataZoom: (this.isWidget && this.isMobile()) ? null : [{
        type: 'inside',
        realtime: true,
        zoomLock: (this.isWidget) ? true : false,
        zoomOnMouseWheel: (this.template === 'advanced') ? true : false,
        moveOnMouseMove: (this.isWidget) ? true : false,
        maxSpan: 100,
        minSpan: 10,
      }, {
        showDetail: false,
        show: (this.template === 'advanced' && this.showZoom) ? true : false,
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
        }
      }],
      animation: false,
      grid: {
        height: this.height,
        right: this.right,
        top: this.top,
        left: this.left,
      },
      xAxis: [
        {
          name: this.isWidget ? '' : formatterXAxisLabel(this.locale, this.windowPreference),
          nameLocation: 'middle',
          nameTextStyle: {
            padding: [20, 0, 0, 0],
          },
          type: 'time',
          axisLine: { onZero: true },
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
      yAxis: [{
        type: 'value',
        axisLine: { onZero: false },
        axisLabel: {
          fontSize: 11,
          formatter: (value: number) => (`${this.vbytesPipe.transform(value, 2, 'vB', 'MvB', true)}`),
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: 'var(--transparent-fg)',
            opacity: 0.25,
          }
        }
      }, this.showCount ? {
        type: 'value',
        position: 'right',
        axisLine: { onZero: false },
        axisLabel: {
          formatter: (value: number) => (`${this.amountShortenerPipe.transform(value, 2, undefined, true)}`),
        },
        splitLine: {
          show: false,
        }
      } : null],
    };
  }

  getTotalValues = (values: any) => {
    let totalValueTemp = 0;
    const totalValueArray = [];
    const valuesInverted = this.inverted ? values : [...values].reverse();
    for (const item of valuesInverted) {
      totalValueTemp += item.value[1];
      totalValueArray.push(totalValueTemp);
    }
    return {
      totalValue: totalValueTemp,
      totalValueArray: totalValueArray.reverse(),
    };
  }

  orderLevels() {
    this.feeLevelsOrdered = [];
    const maxIndex = Math.min(feeLevels.length, this.maxFeeIndex);
    for (let i = 0; i < feeLevels.length; i++) {
      if (feeLevels[i] === this.limitFilterFee) {
        this.feeLimitIndex = i;
      }
      if (feeLevels[i] <= feeLevels[this.maxFeeIndex]) {
        if (this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet') {
          if (i === maxIndex || feeLevels[i] == null) {
            this.feeLevelsOrdered.push(`${(feeLevels[i] / 10).toFixed(1)}+`);
          } else {
            this.feeLevelsOrdered.push(`${(feeLevels[i] / 10).toFixed(1)} - ${(feeLevels[i + 1]  / 10).toFixed(1)}`);
          }
        } else {
          if (i === maxIndex || feeLevels[i] == null) {
            this.feeLevelsOrdered.push(`${feeLevels[i]}+`);
          } else {
            this.feeLevelsOrdered.push(`${feeLevels[i]} - ${feeLevels[i + 1]}`);
          }
        }
      }
    }
    this.chartColorsOrdered =  chartColors.slice(0, this.feeLevelsOrdered.length);
  }

  isMobile() {
    return window.innerWidth <= 767.98;
  }

  onSaveChart(timespan) {
    // @ts-ignore
    const prevHeight = this.mempoolVsizeFeesOptions.grid.height;
    const now = new Date();
    // @ts-ignore
    this.mempoolVsizeFeesOptions.grid.height = prevHeight + 20;
    this.mempoolVsizeFeesOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.mempoolVsizeFeesOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `mempool-graph-${timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.mempoolVsizeFeesOptions.grid.height = prevHeight;
    this.mempoolVsizeFeesOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.mempoolVsizeFeesOptions);
  }
}

