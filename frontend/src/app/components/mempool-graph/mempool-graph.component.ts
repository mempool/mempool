import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy, OnChanges } from '@angular/core';
import { formatDate } from '@angular/common';
import { VbytesPipe } from 'src/app/shared/pipes/bytes-pipe/vbytes.pipe';
import { OptimizedMempoolStats } from 'src/app/interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { StorageService } from 'src/app/services/storage.service';
import { EChartsOption } from 'echarts';
import { feeLevels, chartColors } from 'src/app/app.constants';

interface AxisObject {
  axisDimension: string;
  axisIndex: number;
  seriesData: any;
  value: string;
}

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
  @Input() dateSpan = '2h';
  @Input() showLegend = true;
  @Input() small = false;

  mempoolVsizeFeesData: any;
  mempoolVsizeFeesOptions: EChartsOption;

  inverted: boolean;

  constructor(
    private vbytesPipe: VbytesPipe,
    private stateService: StateService,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit(): void {
    this.mountFeeChart();
  }

  ngOnChanges() {
    // this.inverted = this.storageService.getValue('inverted-graph') === 'true';
    this.mempoolVsizeFeesData = this.handleNewMempoolData(this.data.concat([]));
    this.mountFeeChart();
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
      // if (this.inverted && finalArray.length) {
      //   feesArray = feesArray.map((value, i) => value + finalArray[finalArray.length - 1][i]);
      // }
      finalArray.push(feesArray);
    }
    finalArray.reverse();
    return finalArray;
  }

  mountFeeChart(){
    const { labels, series } = this.mempoolVsizeFeesData;

    const legendNames: string[] = feeLevels.map((sat, i, arr) => {
      if (sat > this.limitFee) { return `${this.limitFee}+`; }
      if (i === 0) { return '0 - 1'; }
      return arr[i - 1] + ' - ' + sat;
    });

    const yAxisSeries = series.map((value: Array<number>, index: number) => {
      return {
        name: labels[index].name,
        type: 'line',
        stack: 'total',
        smooth: false,
        lineStyle: {
          width: 0,
          opacity: 0,
        },
        showSymbol: false,
        areaStyle: {
          opacity: 1,
          color: chartColors[index],
        },
        emphasis: {
          focus: 'series'
        },
        markLine: {
          symbol: 'none',
          itemStyle: {
            borderWidth: 0,
            borderColor: 'none',
            color: '#fff',
          },
          lineStyle: {
            color: '#fff',
            opacity: 0.75,
            width: 2,
          },
        },
        data: this.vbytesPipe.transform(value, 2, 'vB', 'MvB', true)
      };
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
        extraCssText: `width: 150px;
                      background: transparent;
                      border: none;
                      box-shadow: none;`,
        axisPointer: {
          type: 'cross',
          label: {
            formatter: (axis: AxisObject) => {
              if (axis.axisDimension === 'y') {
                return `${this.vbytesPipe.transform(axis.value, 2, 'vB', 'MvB', true)}`;
              }
              if (axis.axisDimension === 'x') {
                return axis.value;
              }
            },
          }
        },
        formatter: (params: any) => {
          const colorSpan = (index: number) => `<div class="indicator" style="background-color: ` + chartColors[index] + `"></div>`;
          const legendName = (index: number) => legendNames[index];
          let itemFormatted = '<div>' + params[0].axisValue + '</div>';
          params.map((item: any, index: number) => {
            if (feeLevels[index - 1] < this.limitFee) {
              itemFormatted += `<div class="item">
                ${colorSpan(index - 1)} ${legendName(index)}
                <div class="grow"></div>
                <div class="value">${this.vbytesPipe.transform(item.value, 2, 'vB', 'MvB', true)}</div>
              </div>`;
            }
          });
          return `<div class="fees-wrapper-tooltip-chart">${itemFormatted}</div>`;
        }
      },
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
          data: labels.map((value: any) => formatDate(value, 'HH:mm', this.locale)),
        }
      ],
      yAxis: {
        type: 'value',
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
