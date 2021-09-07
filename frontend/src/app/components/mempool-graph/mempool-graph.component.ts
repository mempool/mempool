import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { formatDate } from '@angular/common';
import { VbytesPipe } from 'src/app/shared/pipes/bytes-pipe/vbytes.pipe';
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
  hoverIndexSerie: -1;
  feeLimitIndex: number;

  constructor(
    private vbytesPipe: VbytesPipe,
    private stateService: StateService,
    private storageService: StorageService,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.mountFeeChart();
  }

  ngOnChanges() {
    this.windowPreference = this.storageService.getValue('graphWindowPreference');
    this.mempoolVsizeFeesData = this.handleNewMempoolData(this.data.concat([]));
    this.mountFeeChart();
  }

  onChartReady(myChart: any) {
    myChart.on('mouseover', 'series', (serie: any) => {
      this.hoverIndexSerie = serie.seriesIndex;
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

  mountFeeChart(){
    const { labels, series } = this.mempoolVsizeFeesData;

    const feeLevelsOrdered = feeLevels.map((sat, i, arr) => {
      if (arr[i] === this.limitFee) { this.feeLimitIndex = i; }
      if (arr[i] < this.limitFee) {
        if (i === 0) { return '0 - 1'; }
        return `${arr[i - 1]} - ${arr[i]}`;
      } else {
        return `${this.limitFee}+`;
      }
    });

    const seriesGraph = series.map((value: Array<number>, index: number) => {
      if (index <= this.feeLimitIndex){
        return {
          type: 'line',
          stack: 'total',
          smooth: false,
          markPoint: {
            symbol: 'rect',
          },
          lineStyle: {
            width: 0,
            opacity: 0,
          },
          symbolSize: (this.template === 'advanced') ? 20 : 10,
          showSymbol: false,
          areaStyle: {
            opacity: 1,
            color: chartColors[index],
          },
          emphasis: {
            focus: 'series',
            select: {
              areaStyle: {
                opacity: 1,
              }
            },
          },
          itemStyle: {
            borderWidth: 30,
          },
          data: this.vbytesPipe.transform(value, 2, 'vB', 'MvB', true)
        };
      }
    });

    this.mempoolVsizeFeesOptions = {
      color: chartColors,
      tooltip: {
        trigger: 'axis',
        position: (pos, params, el, elRect, size) => {
          const positions = { top: (this.template === 'advanced') ? 30 : -30 };
          positions[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 60;
          return positions;
        },
        extraCssText: `width: ${(this.template === 'advanced') ? '210px' : '200px'};
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          const legendName = (index: number) => feeLevelsOrdered[index];
          const colorSpan = (index: number) => `<span class="indicator" style="background-color: ${chartColors[index]}"></span><span>${legendName(index)}`;
          let total = 0;
          params.map((item: any) => {
            total += item.value;
          });
          const title = `<div class="title">${params[0].axisValue}
          <span class="total-value">${this.vbytesPipe.transform(total, 2, 'vB', 'MvB', false)}</span></div>`;
          const itemFormatted = [];
          let totalParcial = 0;
          let progressPercentageText = '';
          params.map((item: any, index: number) => {
            totalParcial += item.value;
            let progressPercentage = 0;
            if (index <= this.feeLimitIndex) {
              progressPercentage = (item.value / total) * 100;
              let activeItemClass = '';
              if (this.hoverIndexSerie === index) {
                progressPercentageText = `<div class="total-parcial-active">
                  <span class="progress-percentage">${progressPercentage.toFixed(2)} <span class="symbol">%</span></span><span class="total-parcial-vbytes">${this.vbytesPipe.transform(totalParcial, 2, 'vB', 'MvB', false)}</span>
                  <div class="total-percentage-bar"><span><span style="width: ${progressPercentage}%; background: ${chartColors[index]}"></span></span></div>
                </div>`;
                activeItemClass = 'active';
              }
              itemFormatted.push(`<tr class="item ${activeItemClass}">
              <td class="indicator-container">${colorSpan(index)}</td>
              <td class="value">${this.vbytesPipe.transform(item.value, 2, 'vB', 'MvB', false)}</td>
              <td class="total-progress-percentage"><span color: ${chartColors[index]}">${progressPercentage.toFixed(1)} <span class="symbol">%</span></td>
            </tr>`);
            }
          });
          const progressActiveDiv = `<span class="total-value">${progressPercentageText}</span>`;
          const advancedClass = (this.template === 'advanced') ? 'fees-wrapper-tooltip-chart-advanced' : '';
          return `<div class="fees-wrapper-tooltip-chart ${advancedClass}">
            ${title}
            <table>
              <thead>
                <tr>
                  <th>Range</th>
                  <th>Size</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>${itemFormatted.reverse().join('')}</tbody>
            </table>
            ${progressActiveDiv}
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
          axisLine: { onZero: false },
          data: labels.map((value: any) => formatDate(value, 'MM/dd - HH:mm', this.locale)),
        }
      ],
      yAxis: {
        type: 'value',
        axisLine: { onZero: false },
        axisLabel: {
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
      series: seriesGraph
    };
  }
}
