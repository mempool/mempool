import { Component, OnInit, Input, Inject, LOCALE_ID, ChangeDetectionStrategy } from '@angular/core';
import { EChartsOption } from '@mempool/echarts';
import { OnChanges } from '@angular/core';
import { StorageService } from 'src/app/services/storage.service';
import { dataZoom, formatterXAxis, labelsData, filterLabelDates } from 'src/app/shared/graphs.utils';

@Component({
  selector: 'app-incoming-transactions-graph',
  templateUrl: './incoming-transactions-graph.component.html',
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
  @Input() showZoom = true;


  mempoolStatsChartOption: EChartsOption = {};
  mempoolStatsChartInitOption = {
    renderer: 'svg'
  };
  windowPreference: string;

  constructor(
    @Inject(LOCALE_ID) private locale: string,
    private storageService: StorageService,
  ) { }

  ngOnChanges(): void {
    this.windowPreference = this.storageService.getValue('graphWindowPreference');
    this.mountChart();
  }

  ngOnInit(): void {
    this.mountChart();
  }

  mountChart(): void {
    const labelsDataLocal = labelsData(this.data.labels, this.template, this.windowPreference);
    const labelsFiltered = filterLabelDates(this.data.labels, this.template, this.windowPreference);

    this.mempoolStatsChartOption = {
      grid: {
        height: this.height,
        right: this.right,
        top: this.top,
        left: this.left,
      },
      animation: false,
      dataZoom: dataZoom(this.template, this.locale, this.showZoom, this.windowPreference),
      tooltip: {
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
          const colorSpan = (color: string) => `<span class="indicator" style="background-color: ` + color + `"></span>`;
          const date = new Date(params[0].axisValue);
          let itemFormatted = '<div class="title">' + date.toLocaleDateString(this.locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' }) + '</div>';
          params.map((item: any, index: number) => {
            if (index < 26) {
              itemFormatted += `<div class="item">
                <div class="indicator-container">${colorSpan(item.color)}</div>
                <div class="grow"></div>
                <div class="value">${item.value} <span class="symbol">vB/s</span></div>
              </div>`;
            }
          });
          return `<div class="tx-wrapper-tooltip-chart ${(this.template === 'advanced') ? 'tx-wrapper-tooltip-chart-advanced' : ''}">${itemFormatted}</div>`;
        }
      },
      xAxis: {
        type: 'category',
        data: labelsDataLocal,
        axisTick: {
          alignWithLabel: true,
          lineStyle: {
            width: 1,
          },
          customValues: ['1y', '2y', '3y'].includes(this.windowPreference) ? null : labelsFiltered,
        },
        axisLabel: {
          interval: ['1y', '2y', '3y'].includes(this.windowPreference) ? 'auto' : labelsFiltered.length,
          align: 'center',
          fontSize: 11,
          lineHeight: 25,
          customValues: ['1y', '2y', '3y'].includes(this.windowPreference) ? null : labelsFiltered,
          formatter: (value: any) => {
            return formatterXAxis(this.template, this.locale, this.windowPreference, value );
          }
        },
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
          data: this.data.series[0],
          type: 'line',
          smooth: false,
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
}
