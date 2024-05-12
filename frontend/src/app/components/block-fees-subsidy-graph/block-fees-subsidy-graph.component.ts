import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from '../../graphs/echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { SeoService } from '../../services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis } from '../../shared/graphs.utils';
import { ActivatedRoute } from '@angular/router';
import { FiatShortenerPipe } from '../../shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from '../../shared/pipes/fiat-currency.pipe';
import { StateService } from '../../services/state.service';
import { MiningService } from '../../services/mining.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-block-fees-subsidy-graph',
  templateUrl: './block-fees-subsidy-graph.component.html',
  styleUrls: ['./block-fees-subsidy-graph.component.scss'],
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
export class BlockFeesSubsidyGraphComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;
  showFiat = false;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    public stateService: StateService,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
    private fiatShortenerPipe: FiatShortenerPipe,
    private fiatCurrencyPipe: FiatCurrencyPipe,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@mining.block-fees-subsidy:Block Fees Vs Subsidy`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.block-fees-subsidy:See the mining fees earned per Bitcoin block compared to the Bitcoin block subsidy, visualized in BTC and USD over time.`);

    this.miningWindowPreference = this.miningService.getDefaultTimespan('24h');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
    .fragment
    .subscribe((fragment) => {
      if (['24h', '3d', '1w', '1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
        this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
      }
    });

    this.statsObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          this.isLoading = true;
          this.storageService.setValue('miningWindowPreference', timespan);
          this.timespan = timespan;
          this.isLoading = true;
          return this.apiService.getHistoricalBlockFees$(timespan)
            .pipe(
              tap((response) => {
                let blockReward = 50 * 100_000_000;
                const subsidies = {};
                for (let i = 0; i <= 33; i++) {
                  subsidies[i] = blockReward;
                  blockReward = Math.floor(blockReward / 2);
                }

                const data = {
                  timestamp: response.body.map(val => val.timestamp * 1000),
                  blockHeight: response.body.map(val => val.avgHeight),
                  blockFees: response.body.map(val => val.avgFees / 100_000_000),
                  blockFeesFiat: response.body.filter(val => val['USD'] > 0).map(val => val.avgFees / 100_000_000 * val['USD']),
                  blockSubsidy: response.body.map(val => subsidies[Math.floor(Math.min(val.avgHeight / 210000, 33))] / 100_000_000),
                  blockSubsidyFiat: response.body.filter(val => val['USD'] > 0).map(val => subsidies[Math.floor(Math.min(val.avgHeight / 210000, 33))] / 100_000_000 * val['USD']),
                };
                
                this.prepareChartOptions(data);
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
    let title: object;
    if (data.blockFees.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      color: [
        '#ff9f00',
        '#0aab2f',
      ],
      animation: false,
      grid: {
        top: 80,
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
        backgroundColor: 'color-mix(in srgb, var(--active-bg) 95%, transparent)',
        borderRadius: 4,
        shadowColor: 'color-mix(in srgb, var(--active-bg) 95%, transparent)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: 'var(--active-bg)',
        formatter: function (data) {
          if (data.length <= 0) {
            return '';
          }

          let tooltip = '';
          if (['24h', '3d'].includes(this.timespan)) {
            tooltip += $localize`At block <b style="color: white; margin-left: 2px">${data[0].axisValue}</b><br>`;
          } else {
            tooltip += $localize`Around block <b style="color: white; margin-left: 2px">${data[0].axisValue}</b><br>`;
          }
          for (let i = data.length - 1; i >= 0; i--) {
            const tick = data[i];
            if (!this.showFiat) tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data, this.locale, '1.0-3')} BTC<br>`;
            else tooltip += `${tick.marker} ${tick.seriesName}: ${this.fiatCurrencyPipe.transform(tick.data, null, 'USD') }<br>`;
          }
          if (!this.showFiat) tooltip += `<div style="margin-left: 2px">${formatNumber(data.reduce((acc, val) => acc + val.data, 0), this.locale, '1.0-3')} BTC</div>`;
          else tooltip += `<div style="margin-left: 2px">${this.fiatCurrencyPipe.transform(data.reduce((acc, val) => acc + val.data, 0), null, 'USD')}</div>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: data.blockFees.length === 0 ? undefined : [
        {
          type: 'category',
          data: data.blockHeight,
          show: false,
          axisLabel: {
            hideOverlap: true,
          }
        },
        {
          type: 'category',
          data: data.timestamp,
          show: true,
          position: 'bottom',
          axisLabel: {
            color: 'var(--grey)',
            formatter: (val) => {
              return formatterXAxis(this.locale, this.timespan, parseInt(val, 10));
            }
          },
          axisTick: {
            show: false,
          },
          axisLine: {
            show: false,
          },
          splitLine: {
            show: false,
          },
        }
      ],
      legend: data.blockFees.length === 0 ? undefined : {
        data: [
          {
            name: 'Subsidy',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Fees',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Subsidy (USD)',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: 'Fees (USD)',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
        selected: {
          'Subsidy (USD)': this.showFiat,
          'Fees (USD)': this.showFiat,
          'Subsidy': !this.showFiat,
          'Fees': !this.showFiat,
        },
      },
      yAxis: data.blockFees.length === 0 ? undefined : [
        {
          type: 'value',
          axisLabel: {
            color: 'var(--grey)',
            formatter: (val) => {
              return `${val} BTC`;
            }
          },
          min: 0,
          splitLine: {
            lineStyle: {
              type: 'dotted',
              color: 'var(--transparent-fg)',
              opacity: 0.25,
            }
          },
        },
        {
          type: 'value',
          position: 'right',
          axisLabel: {
            color: 'var(--grey)',
            formatter: function(val) {
              return this.fiatShortenerPipe.transform(val, null, 'USD');
            }.bind(this)
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: data.blockFees.length === 0 ? undefined : [
        {
          name: 'Subsidy',
          yAxisIndex: 0,
          type: 'bar',
          stack: 'total',
          data: data.blockSubsidy,
        },
        {
          name: 'Fees',
          yAxisIndex: 0,
          type: 'bar',
          stack: 'total',
          data: data.blockFees,
        },
        {
          name: 'Subsidy (USD)',
          yAxisIndex: 1,
          type: 'bar',
          stack: 'total',
          data: data.blockSubsidyFiat,
        },
        {
          name: 'Fees (USD)',
          yAxisIndex: 1,
          type: 'bar',
          stack: 'total',
          data: data.blockFeesFiat,
        },
      ],
      dataZoom: data.blockFees.length === 0 ? undefined : [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 1,
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
        },
      }],
    };
  }

  onChartInit(ec) {
    this.chartInstance = ec;

    this.chartInstance.on('legendselectchanged', (params) => {
      const isFiat = params.name.includes('USD');
      if (isFiat === this.showFiat) return;

      const isActivation = params.selected[params.name];
      if (isFiat === isActivation) {
        this.showFiat = true;
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Subsidy' });
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Fees' });
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Subsidy (USD)' });
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Fees (USD)' });
      } else {
        this.showFiat = false;
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Subsidy' });
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Fees' });
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Subsidy (USD)' });
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Fees (USD)' });
      }
    });
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
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `block-fees-subsidy-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

}
