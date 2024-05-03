import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { EChartsOption } from '../../graphs/echarts';
import { Observable } from 'rxjs';
import { map, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';
import { SeoService } from '../../services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { download, formatterXAxis } from '../../shared/graphs.utils';
import { ActivatedRoute, Router } from '@angular/router';
import { FiatShortenerPipe } from '../../shared/pipes/fiat-shortener.pipe';
import { FiatCurrencyPipe } from '../../shared/pipes/fiat-currency.pipe';
import { StateService } from '../../services/state.service';

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

  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  statsObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  endBlock = '';
  blockCount = 0;
  chartInstance: any = undefined;
  showFiat = false;
  dropdownOptions = [];
  step = 20000;
  includeAccelerations = false;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    public stateService: StateService,
    private route: ActivatedRoute,
    private router: Router,
    private fiatShortenerPipe: FiatShortenerPipe,
    private fiatCurrencyPipe: FiatCurrencyPipe,
  ) {
    this.radioGroupForm = this.formBuilder.group({ endBlock: '' });
    this.radioGroupForm.controls.endBlock.setValue('');
  }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@mining.block-fees-subsidy:Block Fees Vs Subsidy`);
    this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.block-fees-subsidy:See the mining fees earned per Bitcoin block compared to the Bitcoin block subsidy, visualized in BTC and USD over time.`);

    this.route.queryParams.subscribe((params) => {
      if (/^(0|[1-9]\d{0,9})$/.test(params['height'])) {
        this.radioGroupForm.controls.endBlock.setValue(params['height'], { emitEvent: false });
      }
    });

    this.includeAccelerations = this.stateService.env.ACCELERATOR;

    this.statsObservable$ = this.radioGroupForm.get('endBlock').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.endBlock.value),
        switchMap((endBlock) => {
          this.isLoading = true;
          this.endBlock = endBlock;
          return this.apiService.getHistoricalExactBlockFees$(endBlock === '' ? undefined : endBlock)
            .pipe(
              tap((response) => {
                let blockReward = 50 * 100_000_000;
                const subsidies = {};
                for (let i = 0; i <= 33; i++) {
                  subsidies[i] = blockReward;
                  blockReward = Math.floor(blockReward / 2);
                }

                const existingHeights = new Set(response.body.map(val => val.height));

                for (let i = response.body[0].height; i <= response.body[response.body.length - 1].height; i++) {
                  if (!existingHeights.has(i)) {
                    response.body.push({ height: i, fees: 0, missing: true });
                  }
                }

                response.body.sort((a, b) => a.height - b.height);

                const data = {
                  blockHeight: response.body.map(val => val.height),
                  blockSubsidy: response.body.map(val => val?.missing ? 0 : subsidies[Math.floor(Math.min(val.height / 210000, 33))] / 100_000_000),
                  blockSubsidyFiat: response.body.map(val => val?.missing ? 0 : subsidies[Math.floor(Math.min(val.height / 210000, 33))] / 100_000_000 * val.USD),
                  blockFees: response.body.map(val => val.fees / 100_000_000),
                  blockFeesFiat: response.body.map(val => val.fees / 100_000_000 * val.USD),
                }

                let accelerationData = {};
                if (this.includeAccelerations) {
                  accelerationData = {
                    blockAccelerations: response.body.map(val => val?.accelerations ? val.accelerations / 100_000_000 : 0),
                    blockAccelerationsFiat: response.body.map(val => val?.accelerations ? val.accelerations / 100_000_000 * val.USD : 0),
                  }
                }

                this.prepareChartOptions(data, accelerationData);
                this.isLoading = false;
              }),
              map((response) => {
                this.blockCount = parseInt(response.headers.get('x-total-count'), 10);
                if (this.radioGroupForm.controls.endBlock.value === '') this.radioGroupForm.controls.endBlock.setValue((this.blockCount - 1).toString(), { emitEvent: false });
                this.dropdownOptions = [(this.blockCount - 1).toString()];
                if (this.blockCount) {
                  let i = this.blockCount - 1 - this.step;
                  while (i >= 0) {
                    this.dropdownOptions.push(i.toString());
                    i -= this.step;
                  }
                }
                return {
                  blockCount: this.blockCount,
                };
              }),
            );
        }),
        share()
      );
  }

  prepareChartOptions(data, accelerationData) {
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
        'var(--orange)',
        'var(--success)',
        'var(--tertiary)'
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

          let tooltip = `Block <b style="color: white; margin-left: 2px">${data[0].axisValue}</b><br>`;
          for (let i = data.length - 1; i >= 0; i--) {
            const tick = data[i];
            if (tick.seriesName.includes('Accelerations') && tick.data === 0) continue;
            if (!this.showFiat) tooltip += `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data, this.locale, '1.0-3')} BTC<br>`;
            else tooltip += `${tick.marker} ${tick.seriesName}: ${this.fiatCurrencyPipe.transform(tick.data, null, 'USD') }<br>`;
          }
          if (!this.showFiat) tooltip += `<div style="margin-left: 2px">${formatNumber(data.reduce((acc, val) => acc + val.data, 0), this.locale, '1.0-3')} BTC</div>`;
          else tooltip += `<div style="margin-left: 2px">${this.fiatCurrencyPipe.transform(data.reduce((acc, val) => acc + val.data, 0), null, 'USD')}</div>`;
          return tooltip;
        }.bind(this)
      },
      xAxis: data.blockFees.length === 0 ? undefined :
      {
        type: 'category',
        data: data.blockHeight,
        axisLabel: {
          hideOverlap: true,
          color: 'var(--grey)',
        }
      },
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
          this.includeAccelerations ? {
            name: 'Accelerations',
            inactiveColor: 'var(--grey)',
            textStyle: {
                color: 'white',
            },
            icon: 'roundRect',
          } : null,
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
          this.includeAccelerations ? {
            name: 'Accelerations (USD)',
            inactiveColor: 'var(--grey)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          } : null
        ].filter(legend => legend !== null),
        selected: {
          'Subsidy (USD)': this.showFiat,
          'Fees (USD)': this.showFiat,
          'Accelerations (USD)': this.showFiat,
          'Subsidy': !this.showFiat,
          'Fees': !this.showFiat,
          'Accelerations': !this.showFiat,
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
          name: 'Accelerations',
          yAxisIndex: 0,
          type: 'bar',
          stack: 'total',
          data: accelerationData.blockAccelerations,
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
        {
          name: 'Accelerations (USD)',
          yAxisIndex: 1,
          type: 'bar',
          stack: 'total',
          data: accelerationData.blockAccelerationsFiat,
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
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Accelerations' });        
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Subsidy (USD)' });
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Fees (USD)' });
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Accelerations (USD)' });
      } else {
        this.showFiat = false;
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Subsidy' });
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Fees' });
        this.chartInstance.dispatchAction({ type: 'legendSelect',   name: 'Accelerations' });
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Subsidy (USD)' });
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Fees (USD)' });
        this.chartInstance.dispatchAction({ type: 'legendUnSelect', name: 'Accelerations (USD)' });
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
    }), `block-fees-subsidy-${this.endBlock}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }

  selectBlockSpan(value: string) {
    this.radioGroupForm.controls.endBlock.setValue(value);
    this.router.navigate([], { queryParams: { height: value }, queryParamsHandling: 'merge' });
  }

  endBlockToSelector(value: string): string {
    if (parseInt(value, 10) > this.blockCount) value = (this.blockCount).toString();
    return `Blocks ${Math.max(0, parseInt(value, 10) - this.step)} - ` + value;
  }
}
