import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { formatDate } from '@angular/common';
import { VbytesPipe } from 'src/app/shared/pipes/bytes-pipe/vbytes.pipe';
import { formatNumber } from "@angular/common";

import { OptimizedMempoolStats } from 'src/app/interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { StorageService } from 'src/app/services/storage.service';
import { EChartsOption } from 'echarts';
import { feeLevels, chartColors } from 'src/app/app.constants';

@Component({
  selector: 'app-mempool-graph',
  templateUrl: './mempool-graph.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolGraphComponent implements OnInit, OnChanges {
  @Input() data: any[];
  @Input() limitFee = 350;
  @Input() height: number | string = 200;
  @Input() top: number | string = 20;
  @Input() right: number | string = 10;
  @Input() left: number | string = 75;
  @Input() template: ('widget' | 'advanced') = 'widget';
  @Input() showZoom = true;

  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: EChartsOption;
  mempoolVsizeFeesInitOptions = {
    renderer: 'svg',
  };
  windowPreference: string;
  hoverIndexSerie = 0;
  feeLimitIndex: number;
  feeLevelsOrdered = [];
  chartColorsOrdered = [];
  inverted: boolean;

  constructor(
    private vbytesPipe: VbytesPipe,
    private stateService: StateService,
    private storageService: StorageService,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.inverted = this.storageService.getValue('inverted-graph') === 'true';
    for (let i = 0; i < feeLevels.length; i++) {
      if (feeLevels[i] === this.limitFee) {
        this.feeLimitIndex = i;
      }
      if (feeLevels[i] <= this.limitFee) {
        if (i === 0) {
          this.feeLevelsOrdered.push('0 - 1');
        } else {
          this.feeLevelsOrdered.push(`${feeLevels[i - 1]} - ${feeLevels[i]}`);
        }
      }
    }
    this.chartColorsOrdered =  chartColors.slice(0, this.feeLevelsOrdered.length);
    this.mountFeeChart();
  }

  ngOnChanges() {
    this.windowPreference = this.storageService.getValue('graphWindowPreference');
    this.mempoolVsizeFeesData = this.handleNewMempoolData(this.data.concat([]));
    this.mountFeeChart();
  }

  onChartReady(myChart: any) {
    myChart.getZr().on('mousemove', e => {
      if (e.target !== undefined) {
        this.hoverIndexSerie = e.target.parent.parent.__ecComponentInfo.index;
      }
    });
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);
    const finalArrayVByte = this.generateArray(mempoolStats);

    // Only Liquid has lower than 1 sat/vb transactions
    if (this.stateService.network !== 'liquid') {
      finalArrayVByte.shift();
    }

    return {
      labels: labels,
      series: finalArrayVByte
    };
  }

  generateArray(mempoolStats: OptimizedMempoolStats[]) {
    const finalArray: number[][] = [];
    let feesArray: number[] = [];
    for (let index = 37; index > -1; index--) {
      feesArray = [];
      mempoolStats.forEach((stats) => {
        feesArray.push(stats.vsizes[index] ? stats.vsizes[index] : 0);
      });
      finalArray.push(feesArray);
    }
    finalArray.reverse();
    return finalArray;
  }

  mountFeeChart() {
    const { labels, series } = this.mempoolVsizeFeesData;

    const seriesGraph = series.map((value: Array<number>, index: number) => {
      if (index <= this.feeLimitIndex){
        return {
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
            color: chartColors[index],
            opacity: 1,
          },
          data: value
        };
      }
    });

    this.mempoolVsizeFeesOptions = {
      series: this.inverted ? [...seriesGraph].reverse() : seriesGraph,
      hover: true,
      color: this.inverted ? [...this.chartColorsOrdered].reverse() : this.chartColorsOrdered,
      tooltip: {
        show: (window.innerWidth >= 768) ? true : false,
        trigger: 'axis',
        alwaysShowContent: false,
        position: (pos, params, el, elRect, size) => {
          const positions = { top: (this.template === 'advanced') ? 30 : -30 };
          positions[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 60;
          return positions;
        },
        extraCssText: `width: ${(this.template === 'advanced') ? '275px' : '200px'};
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          const colorSpan = (index: any) => `<span class="indicator" style="background-color: ${this.chartColorsOrdered[index]}"></span>
            <span>
              ${this.feeLevelsOrdered[index]}
            </span>`;
          const totals = (values: any) => {
            let totalValueTemp = 0;
            const totalValueArrayTemp = [];
            const valuesInverted = this.inverted ? values : [...values].reverse();
            for (const item of valuesInverted) {
              totalValueTemp += item.value;
              totalValueArrayTemp.push(totalValueTemp);
            }
            return {
              totalValue: totalValueTemp,
              totalValueArray: totalValueArrayTemp.reverse(),
              valuesOrdered: this.inverted ? [...values].reverse() : values,
            };
          };
          const { totalValue, totalValueArray, valuesOrdered } = totals(params);
          const title = `<div class="title">
            ${params[0].axisValue}
            <span class="total-value">
              ${this.vbytesPipe.transform(totalValue, 2, 'vB', 'MvB', false)}
            </span>
          </div>`;
          const itemFormatted = [];
          let totalParcial = 0;
          let progressPercentageText = '';
          params.map((item: any, index: number) => {
            totalParcial += item.value;
            let progressPercentage = 0;
            let progressPercentageSum = 0;
            if (index <= this.feeLimitIndex) {
              progressPercentage = (item.value / totalValue) * 100;
              progressPercentageSum = (totalValueArray[index] / totalValue) * 100;
              let activeItemClass = '';
              const hoverActive = (this.inverted) ? Math.abs(item.seriesIndex - params.length + 1) : item.seriesIndex;
              if (this.hoverIndexSerie === hoverActive) {
                progressPercentageText = `<div class="total-parcial-active">
                  <span class="progress-percentage">
                    ${formatNumber(progressPercentage, this.locale, '1.2-2')}
                    <span class="symbol">%</span>
                  </span>
                  <span class="total-parcial-vbytes">
                    ${this.vbytesPipe.transform(totalParcial, 2, 'vB', 'MvB', false)}
                  </span>
                  <div class="total-percentage-bar">
                    <span class="total-percentage-bar-background">
                      <span style="width: ${progressPercentage}%; background: ${this.chartColorsOrdered[index]}"></span>
                    </span>
                  </div>
                </div>`;
                activeItemClass = 'active';
              }
              itemFormatted.push(`<tr class="item ${activeItemClass}">
              <td class="indicator-container">
                ${colorSpan(item.seriesIndex)}
              </td>
              <td class="total-progress-sum">
                <span>
                  ${this.vbytesPipe.transform(valuesOrdered[item.seriesIndex].value, 2, 'vB', 'MvB', false)}
                </span>
              </td>
              <td class="total-progress-sum">
                <span>
                  ${this.vbytesPipe.transform(totalValueArray[item.seriesIndex], 2, 'vB', 'MvB', false)}
                </span>
              </td>
              <td class="total-progress-sum-bar">
                <span class="total-percentage-bar-background">
                  <span style="width: ${progressPercentageSum.toFixed(2)}%; background-color: ${this.chartColorsOrdered[3]}"></span>
                </span>
              </td>
            </tr>`);
            }
          });
          const classActive = (this.template === 'advanced') ? 'fees-wrapper-tooltip-chart-advanced' : '';
          return `<div class="fees-wrapper-tooltip-chart ${classActive}">
            ${title}
            <table>
              <thead>
                <tr>
                  <th>Range</th>
                  <th>Size</th>
                  <th>Sum</th>
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
      dataZoom: [{
        type: 'inside',
        realtime: true,
        zoomOnMouseWheel: (this.template === 'advanced') ? true : false,
        maxSpan: 100,
        minSpan: 10,
      }, {
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
          type: 'category',
          boundaryGap: false,
          axisLine: { onZero: true },
          axisLabel: {
            align: 'center',
            fontSize: 11,
            lineHeight: 12,
          },
          data: labels.map((value: any) => `${formatDate(value, 'M/d', this.locale)}\n${formatDate(value, 'H:mm', this.locale)}`),
        }
      ],
      yAxis: {
        type: 'value',
        axisLine: { onZero: false },
        axisLabel: {
          fontSize: 11,
          formatter: (value: number) => (`${this.vbytesPipe.transform(value, 2, 'vB', 'MvB', true)}`),
        },
        splitLine: {
          lineStyle: {
            type: 'dotted',
            color: '#ffffff66',
            opacity: 0.25,
          }
        }
      },
    };
  }
}

