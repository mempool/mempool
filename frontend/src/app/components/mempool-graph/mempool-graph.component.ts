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
  @Input() limitFee = 300;
  @Input() height: number | string = 200;
  @Input() top: number | string = 20;
  @Input() right: number | string = 10;
  @Input() left: number | string = 75;
  @Input() small = false;
  @Input() size: ('small' | 'big') = 'small';

  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: EChartsOption;
  windowPreference: string;
  hoverIndexSerie: -1;

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
        const theFee = stats.vsizes[index].toString();
        if (theFee) {
          feesArray.push(parseInt(theFee, 10));
        } else {
          feesArray.push(0);
        }
      });
      if (finalArray.length) {
        feesArray = feesArray.map((value, i) => value + finalArray[finalArray.length - 1][i]);
      }
      finalArray.push(feesArray);
    }
    finalArray.reverse();
    return finalArray;
  }

  mountFeeChart(){
    const { labels, series } = this.mempoolVsizeFeesData;

    const feeLevelsOrdered = feeLevels.map((sat, i, arr) => {
      if (i <= 26) {
        if (i === 0) { return '0 - 1'; }
        if (i === 26) { return '350+'; }
        return arr[i - 1] + ' - ' + sat;
      }
    });

    const yAxisSeries = series.map((value: Array<number>, index: number) => {
      if (index <= 26){
        return {
          name: feeLevelsOrdered[index],
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
          symbolSize: (this.size === 'big') ? 15 : 10,
          showSymbol: false,
          areaStyle: {
            opacity: 1,
            color: chartColors[index],
          },
          emphasis: {
            focus: 'series',
          },
          itemStyle: {
            borderWidth: 30,
            color: chartColors[index],
            borderColor: chartColors[index],
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
          const positions = { top: -20 };
          positions[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 80;
          return positions;
        },
        extraCssText: `width: ${(this.size === 'big') ? '200px' : '170px'};
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'line',
        },
        formatter: (params: any) => {
          const colorSpan = (index: number) => `<div class="indicator" style="background-color: ` + chartColors[index] + `"></div>`;
          const legendName = (index: number) => feeLevelsOrdered[index];
          let itemFormatted = `<div class="title">${params[0].axisValue}</div>`;
          let total = 0;
          params.map((item: any, index: number) => {
            total += item.value;
            if (index <= 26) {
              let activeItemClass = '';
              if (this.hoverIndexSerie === index){
                activeItemClass = 'active';
              }
              itemFormatted += `<div class="item ${activeItemClass}">
                ${colorSpan(index)} ${legendName(index)}
                <div class="grow"></div>
                <div class="value">${this.vbytesPipe.transform(item.value, 2, 'vB', 'MvB', false)}</div>
              </div>`;
            }
          });
          const totalDiv = `<div class="total-label">Total
            <span class="total-value">${this.vbytesPipe.transform(total, 2, 'vB', 'MvB', true)}</span>
          </div>`;
          const bigClass = (this.size === 'big') ? 'fees-wrapper-tooltip-chart-big' : '';
          return `<div class="fees-wrapper-tooltip-chart ${bigClass}">${itemFormatted} ${totalDiv}</div>`;
        }
      },
      dataZoom: [{
        type: 'inside',
        realtime: true,
      }, {
        show: (this.size === 'big') ? true : false,
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
          data: labels.map((value: any) => {
            if (['2h', '24h'].includes(this.windowPreference) || this.size === 'small') {
              return formatDate(value, 'HH:mm', this.locale);
            } else {
              return formatDate(value, 'MM/dd - HH:mm', this.locale);
            }
          }),
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
      series: yAxisSeries
    };
  }
}
