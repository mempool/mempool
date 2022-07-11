import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption, graphic } from 'echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { formatCurrency, formatNumber, getCurrencySymbol } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { download, formatterXAxis, formatterXAxisLabel, formatterXAxisTimeCategory } from 'src/app/shared/graphs.utils';
import { StorageService } from 'src/app/services/storage.service';
import { MiningService } from 'src/app/services/mining.service';
import { ActivatedRoute } from '@angular/router';
import { FiatShortenerPipe } from 'src/app/shared/pipes/fiat-shortener.pipe';

@Component({
  selector: 'app-block-fees-graph',
  templateUrl: './block-fees-graph.component.html',
  styleUrls: ['./block-fees-graph.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockFeesGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: FormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: FormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
    private fiatShortenerPipe: FiatShortenerPipe,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@6c453b11fd7bd159ae30bc381f367bc736d86909:Block Fees`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('1m');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockFees$(timespan)
            .pipe(
              tap((response) => {
                this.prepareChartOptions({
                  blockFees: response.body.map(val => [val.timestamp * 1000, val.avgFees / 100000000, val.avgHeight]),
                  blockFeesUSD: response.body.filter(val => val.USD > 0).map(val => [val.timestamp * 1000, val.avgFees / 100000000 * val.USD, val.avgHeight]),
                });
                this.isLoading = false;
              }),
              map((response) => {
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    this.chartOptions = {
      color: [
        new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#FDD835' },
          { offset: 1, color: '#FB8C00' },
        ]),
        new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#C0CA33' },
          { offset: 1, color: '#1B5E20' },
        ]),
      ],
      animation: false,
      grid: {
        top: 30,
        bottom: 80,
        right: this.right,
        left: this.left,
      },
      tooltip: {
        show: !this.isMobile(),
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: '#b1b1b1',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (data) {
          if (data.length <= 0) {
            return '';
          }
          let tooltip = `<b style="color: white; margin-left: 2px">
            ${formatterXAxis(this.locale, this.timespan, parseInt(data[0].axisValue, 10))}</b><br>`;

          for (const tick of data) {
            if (tick.seriesIndex === 0) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.3-3')} BTC<br>`;
            } else if (tick.seriesIndex === 1) {
              tooltip += `${tick.marker} ${tick.seriesName}: ${formatCurrency(tick.data[1], this.locale, getCurrencySymbol('USD', 'narrow'), 'USD', '1.0-0')}<br>`;
            }
          }

          tooltip += `<small>* On average around block ${data[0].data[2]}</small>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: data.blockFees.length === 0 ? undefined :
      {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: {
        data: [
          {
            name: 'Fees BTC',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Fees USD',
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {  
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
      },
      yAxis: [
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val} BTC`;
            }
          },
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: '#ffffff66',
              opacity: 0.25,
            }
          },
        },
        {
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: function(val) {
              return this.fiatShortenerPipe.transform(val);
            }.bind(this)
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: [
        {
          legendHoverLink: false,
          zlevel: 0,
          yAxisIndex: 0,
          name: 'Fees BTC',
          data: data.blockFees,
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: {
            width: 1,
            opacity: 1,
          }
        },
        {
          legendHoverLink: false,
          zlevel: 1,
          yAxisIndex: 1,
          name: 'Fees USD',
          data: data.blockFeesUSD,
          type: 'line',
          smooth: 0.25,
          symbol: 'none',
          lineStyle: {
            width: 2,
            opacity: 1,
          }
        },
      ],
      dataZoom: [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 5,
        moveOnMouseMove: false,
      }, {
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        left: 20,
        right: 15,
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
    };
  }

  onChartInit(ec) {
    this.chartInstance = ec;
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  onSaveChart() {
    // @ts-ignore
    const prevBottom = this.chartOptions.grid.bottom;
    const now = new Date();
    // @ts-ignore
    this.chartOptions.grid.bottom = 40;
    this.chartOptions.backgroundColor = '#11131f';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-fees-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
