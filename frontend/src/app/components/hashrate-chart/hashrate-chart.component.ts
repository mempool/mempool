import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { combineLatest, fromEvent, merge, Observable, of } from 'rxjs';
import { map, mergeMap, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { formatNumber } from '@angular/common';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { download } from '@app/shared/graphs.utils';
import { ActivatedRoute } from '@angular/router';
import { StateService } from '@app/services/state.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';

@Component({
  selector: 'app-hashrate-chart',
  templateUrl: './hashrate-chart.component.html',
  styleUrls: ['./hashrate-chart.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 99;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HashrateChartComponent implements OnInit {
  @Input() tableOnly = false;
  @Input() widget = false;
  @Input() height: number = 300;
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  hashrateObservable$: Observable<any>;
  isLoading = true;
  formatNumber = formatNumber;
  timespan = '';
  chartInstance: any = undefined;
  network = '';

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private storageService: StorageService,
    private miningService: MiningService,
    private route: ActivatedRoute,
    public stateService: StateService
  ) {
  }

  ngOnInit(): void {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    let firstRun = true;

    if (this.widget) {
      this.miningWindowPreference = '1y';
    } else {
      this.seoService.setTitle($localize`:@@3510fc6daa1d975f331e3a717bdf1a34efa06dff:Hashrate & Difficulty`);
      this.seoService.setDescription($localize`:@@meta.description.bitcoin.graphs.hashrate:See hashrate and difficulty for the Bitcoin${seoDescriptionNetwork(this.network)} network visualized over time.`);
      this.miningWindowPreference = this.miningService.getDefaultTimespan('3m');
    }
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['1m', '3m', '6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.hashrateObservable$ = combineLatest(
        merge(
        this.radioGroupForm.get('dateSpan').valueChanges
          .pipe(
            startWith(this.radioGroupForm.controls.dateSpan.value),
            switchMap((timespan) => {
              if (!this.widget && !firstRun) {
                this.storageService.setValue('miningWindowPreference', timespan);
              }
              this.timespan = timespan;
              firstRun = false;
              this.miningWindowPreference = timespan;
              this.isLoading = true;
              return this.apiService.getHistoricalHashrate$(this.timespan);
            })
          ),
          this.stateService.chainTip$
            .pipe(
              switchMap(() => {
                return this.apiService.getHistoricalHashrate$(this.timespan);
              })
            )
        ),
        fromEvent(window, 'resize').pipe(startWith(null)),
      ).pipe(
        map(([response, _]) => response),
        tap((response: any) => {
          const data = response.body;

          // always include the latest difficulty
          if (data.difficulty.length && data.difficulty[data.difficulty.length - 1].difficulty !== data.currentDifficulty) {
            data.difficulty.push({
              timestamp: Date.now() / 1000,
              difficulty: data.currentDifficulty
            });
          }

          // We generate duplicated data point so the tooltip works nicely
          const diffFixed = [];
          let diffIndex = 1;
          let hashIndex = 0;
          while (hashIndex < data.hashrates.length) {
            if (diffIndex >= data.difficulty.length) {
              while (hashIndex < data.hashrates.length) {
                diffFixed.push({
                  timestamp: data.hashrates[hashIndex].timestamp,
                  difficulty: data.difficulty.length > 0 ?  data.difficulty[data.difficulty.length - 1].difficulty : null
                });
                ++hashIndex;
              }
              diffIndex++;
              break;
            }

            while (hashIndex < data.hashrates.length && diffIndex < data.difficulty.length &&
              data.hashrates[hashIndex].timestamp <= data.difficulty[diffIndex].time
            ) {
              diffFixed.push({
                timestamp: data.hashrates[hashIndex].timestamp,
                difficulty: data.difficulty[diffIndex - 1].difficulty
              });
              ++hashIndex;
            }
            ++diffIndex;
          }

          while (diffIndex <= data.difficulty.length) {
            diffFixed.push({
              timestamp: data.difficulty[diffIndex - 1].time,
              difficulty: data.difficulty[diffIndex - 1].difficulty
            });
            diffIndex++;
          }

          let maResolution = 15;
          const hashrateMa = [];
          for (let i = maResolution - 1; i < data.hashrates.length; ++i) {
            let avg = 0;
            for (let y = maResolution - 1; y >= 0; --y) {
              avg += data.hashrates[i - y].avgHashrate;
            }
            avg /= maResolution;
            hashrateMa.push([data.hashrates[i].timestamp * 1000, avg]);
          }

          this.prepareChartOptions({
            hashrates: data.hashrates.map(val => [val.timestamp * 1000, val.avgHashrate]),
            difficulty: diffFixed.map(val => [val.timestamp * 1000, val.difficulty]),
            hashrateMa: hashrateMa,
          });
          this.isLoading = false;
        }),
        map((response) => {
          const data = response.body;
          return {
            blockCount: parseInt(response.headers.get('x-total-count'), 10),
            currentDifficulty: data.currentDifficulty,
            currentHashrate: data.currentHashrate,
          };
        }),
        share()
      );
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.hashrates.length === 0) {
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
      animation: false,
      color: [
        new echarts.graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E99' },
          { offset: 0.25, color: '#FB8C0099' },
          { offset: 0.5, color: '#FFB30099' },
          { offset: 0.75, color: '#FDD83599' },
          { offset: 1, color: '#7CB34299' }
        ]),
        '#D81B60',
        new echarts.graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E' },
          { offset: 0.25, color: '#FB8C00' },
          { offset: 0.5, color: '#FFB300' },
          { offset: 0.75, color: '#FDD835' },
          { offset: 1, color: '#7CB342' }
        ]),
      ],
      grid: {
        height: (this.widget && this.height) ? this.height - 30 : undefined,
        top: this.widget ? 20 : 40,
        bottom: this.widget ? 30 : 70,
        right: this.right,
        left: this.left,
      },
      tooltip: {
        show: !this.isMobile() || !this.widget,
        trigger: 'axis',
        axisPointer: {
          type: 'line'
        },
        backgroundColor: 'rgba(17, 19, 31, 1)',
        borderRadius: 4,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        textStyle: {
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: (ticks) => {
          let hashrateString = '';
          let difficultyString = '';
          let hashrateStringMA = '';
          let hashratePowerOfTen: any = selectPowerOfTen(1);

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) { // Hashrate
              let hashrate = tick.data[1];
              hashratePowerOfTen = selectPowerOfTen(tick.data[1], 10);
              hashrate = tick.data[1] / hashratePowerOfTen.divider;
              hashrateString = `${tick.marker} ${tick.seriesName}: ${formatNumber(hashrate, this.locale, '1.0-0')} ${hashratePowerOfTen.unit}H/s<br>`;
            } else if (tick.seriesIndex === 1) { // Difficulty
              let difficultyPowerOfTen = hashratePowerOfTen;
              let difficulty = tick.data[1];
              if (difficulty === null) {
                difficultyString = `${tick.marker} ${tick.seriesName}: No data<br>`;
              } else {
                difficultyPowerOfTen = selectPowerOfTen(tick.data[1]);
                difficulty = tick.data[1] / difficultyPowerOfTen.divider;
                difficultyString = `${tick.marker} ${tick.seriesName}: ${formatNumber(difficulty, this.locale, '1.2-2')} ${difficultyPowerOfTen.unit}<br>`;
              }
            } else if (tick.seriesIndex === 2) { // Hashrate MA
              let hashrate = tick.data[1];
              hashratePowerOfTen = selectPowerOfTen(tick.data[1], 10);
              hashrate = tick.data[1] / hashratePowerOfTen.divider;
              hashrateStringMA = `${tick.marker} ${tick.seriesName}: ${formatNumber(hashrate, this.locale, '1.0-0')} ${hashratePowerOfTen.unit}H/s`;
            }
          }

          const date = new Date(ticks[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });

          return `
            <b style="color: white; margin-left: 2px">${date}</b><br>
            <span>${difficultyString}</span>
            <span>${hashrateString}</span>
            <span>${hashrateStringMA}</span>
          `;
        }
      },
      xAxis: data.hashrates.length === 0 ? undefined : {
        type: 'time',
        splitNumber: (this.isMobile() || this.widget) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: (this.widget || data.hashrates.length === 0) ? undefined : {
        data: [
          {
            name: $localize`:@@79a9dc5b1caca3cbeb1733a19515edacc5fc7920:Hashrate`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
            itemStyle: {
              color: '#FFB300',
            },
          },
          {
            name: $localize`:@@25148835d92465353fc5fe8897c27d5369978e5a:Difficulty`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
          {
            name: $localize`Hashrate (MA)`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
            itemStyle: {
              color: '#FFB300',
            },
          },
        ],
        selected: JSON.parse(this.storageService?.getValue('hashrate_difficulty_legend') || 'null') ?? {
          '$localize`:@@79a9dc5b1caca3cbeb1733a19515edacc5fc7920:Hashrate`': true,
          '$localize`::Difficulty`': this.network === '',
          '$localize`Hashrate (MA)`': true,
        },
      },
      yAxis: data.hashrates.length === 0 ? undefined : [
        {
          min: (value) => {
            const selectedPowerOfTen: any = selectPowerOfTen(value.min);
            const newMin = Math.floor(value.min / selectedPowerOfTen.divider / 10);
            return newMin * selectedPowerOfTen.divider * 10;
          },
          max: (value) => {
            return value.max;
          },
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}H/s`;
            },
            showMinLabel: false,
            showMaxLabel: false,
          },
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
          min: (_) => {
            const firstYAxisMin = this.chartInstance.getModel().getComponent('yAxis', 0).axis.scale.getExtent()[0];
            const selectedPowerOfTen: any = selectPowerOfTen(firstYAxisMin);
            const newMin = Math.floor(firstYAxisMin / selectedPowerOfTen.divider / 10)
            return 600 / 2 ** 32 * newMin * selectedPowerOfTen.divider * 10;
          },
          max: (_) => {
            const firstYAxisMax = this.chartInstance.getModel().getComponent('yAxis', 0).axis.scale.getExtent()[1];
            return 600 / 2 ** 32 * firstYAxisMax;
          },
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val): string => {
              if (this.stateService.network === 'signet') {
                return `${val}`;
              }
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}`;
            },
            showMinLabel: false,
            showMaxLabel: false,
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: data.hashrates.length === 0 ? [] : [
        {
          zlevel: 0,
          yAxisIndex: 0,
          name: $localize`:@@79a9dc5b1caca3cbeb1733a19515edacc5fc7920:Hashrate`,
          showSymbol: false,
          symbol: 'none',
          data: data.hashrates,
          type: 'line',
          lineStyle: {
            width: 1,
          },
        },
        {
          zlevel: 1,
          yAxisIndex: 1,
          name: $localize`:@@25148835d92465353fc5fe8897c27d5369978e5a:Difficulty`,
          showSymbol: false,
          symbol: 'none',
          data: data.difficulty,
          type: 'line',
          lineStyle: {
            width: 3,
          }
        },
        {
          zlevel: 2,
          name: $localize`Hashrate (MA)`,
          showSymbol: false,
          symbol: 'none',
          data: data.hashrateMa,
          type: 'line',
          smooth: true,
          lineStyle: {
            width: 3,
          }
        }
      ],
      dataZoom: this.widget ? null : [{
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

    this.chartInstance.on('legendselectchanged', (e) => {
      this.storageService.setValue('hashrate_difficulty_legend', JSON.stringify(e.selected));
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
    this.chartOptions.grid.bottom = 30;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `hashrate-difficulty-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
