import { Component, Inject, LOCALE_ID, ChangeDetectionStrategy, Input, OnChanges, OnInit, ChangeDetectorRef } from '@angular/core';
import { formatDate, formatNumber } from '@angular/common';
import { EChartsOption } from '@app/graphs/echarts';
import { StateService } from '@app/services/state.service';
import { map, Subscription, switchMap } from 'rxjs';
import { PriceService } from '@app/services/price.service';
import { AmountShortenerPipe } from '@app/shared/pipes/amount-shortener.pipe';

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
  subscription: Subscription;

  right: number | string = '5';
  top: number | string = '20';
  left: number | string = '60';
  template: ('widget' | 'advanced') = 'widget';
  isLoading = true;
  chartInstance: any = undefined;
  pegsChartInitOption = {
    renderer: 'svg'
  };

  adjustedLeft: number;
  adjustedRight: number;
  selected = {
    'LBTC': true,
    'BTC': true,
    'USD': false,
  };

  constructor(
    public stateService: StateService,
    public priceService: PriceService,
    public amountShortenerPipe: AmountShortenerPipe,
    public cd: ChangeDetectorRef,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  ngOnInit() {
    this.isLoading = true;
  }

  ngOnChanges() {
    if (!this.data?.liquidReserves) {
      return;
    }

    this.subscription = this.stateService.conversions$.pipe(
      switchMap(conversions =>
        this.priceService.getPriceByBulk$(this.data.liquidPegs.labels.map((date: string) => Math.floor(new Date(date).getTime() / 1000)).slice(0, -1), 'USD')
          .pipe(
            map(prices => this.data.liquidReserves.series.map((value, i) => value * (prices[i]?.price.USD || conversions['USD'])))
          )
      )
    ).subscribe((usdBanlance: any) => {
      if (!this.data.liquidReserves) {
        this.pegsChartOptions = this.createChartOptions(this.data.liquidPegs.series, this.data.liquidPegs.labels);
      } else {
        this.pegsChartOptions = this.createChartOptions(this.data.liquidPegs.series, this.data.liquidPegs.labels, this.data.liquidReserves.series, usdBanlance);
      }
      this.cd.markForCheck();
    });
  }

  rendered() {
    if (!this.data.liquidPegs) {
      return;
    }
    this.isLoading = false;
  }

  createChartOptions(pegSeries: number[], labels: string[], reservesSeries?: number[], usdBalance?: number[]): EChartsOption {
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
      legend: {
        data: [
          {
            name: 'LBTC',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'BTC',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'USD',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          }
        ],
        selected: this.selected,
      },
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
              let formattedValue;
              item.seriesName === 'USD' ? formattedValue = this.amountShortenerPipe.transform(item.value, 3, undefined, true, true) : formattedValue = formatNumber(item.value, this.locale, '1.2-2');
              itemFormatted += `<div class="item">
                <div class="indicator-container">${colorSpan(item.color)}</div>
                <div style="margin-right: 5px"></div>
                <div class="value">${formattedValue} <span class="symbol">${item.seriesName}</span></div>
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
      yAxis: [{
        type: 'value',
        axisLabel: {
          fontSize: 11,
          formatter: (val): string => {
            return `${this.amountShortenerPipe.transform(Math.round(val), 0, undefined, true)} BTC`;
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
      {
        type: 'value',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: function(val) {
            return `$${this.amountShortenerPipe.transform(val, 3, undefined, true, true)}`;
          }.bind(this)
        },
        splitLine: {
          show: false,
        },
      }],
      series: [
        {
          data: pegSeries,
          name: 'LBTC',
          yAxisIndex: 0,
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
          yAxisIndex: 0,
          color: '#EA983B',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 2,
            color: '#EA983B',
          },
        },
        {
          data: usdBalance,
          name: 'USD',
          yAxisIndex: 1,
          color: '#4CAF50',
          type: 'line',
          smooth: true,
          showSymbol: false,
          lineStyle: {
            width: 2,
            color: '#3BCC49',
          },
        },
      ],
    };
  }

  onLegendSelectChanged(e) {
    this.selected = e.selected;
    this.adjustedRight = this.selected['USD'] ? +this.right + 40 : +this.right;
    this.adjustedLeft = this.selected['LBTC'] || this.selected['BTC'] ? +this.left : +this.left - 40;

    this.pegsChartOptions = {
      ...this.pegsChartOptions,
      grid: {
        ...this.pegsChartOptions.grid,
        right: this.adjustedRight,
        left: this.adjustedLeft,
      },
      legend: {
        ...this.pegsChartOptions.legend,
        selected: this.selected,
      },
    };
  }

  onChartInit(ec) {
    this.chartInstance = ec;
    this.chartInstance.on('legendselectchanged', this.onLegendSelectChanged.bind(this));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}

