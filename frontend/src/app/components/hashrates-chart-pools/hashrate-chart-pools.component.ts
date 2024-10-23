import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, Input, LOCALE_ID, OnInit, HostBinding } from '@angular/core';
import { EChartsOption } from '@app/graphs/echarts';
import { Observable } from 'rxjs';
import { delay, map, retryWhen, share, startWith, switchMap, tap } from 'rxjs/operators';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { chartColors, poolsColor } from '@app/app.constants';
import { StorageService } from '@app/services/storage.service';
import { MiningService } from '@app/services/mining.service';
import { download } from '@app/shared/graphs.utils';
import { ActivatedRoute } from '@angular/router';
import { StateService } from '@app/services/state.service';

interface Hashrate {
  timestamp: number;
  avgHashRate: number;
  share: number;
  poolName: string;
}

@Component({
  selector: 'app-hashrate-chart-pools',
  templateUrl: './hashrate-chart-pools.component.html',
  styleUrls: ['./hashrate-chart-pools.component.scss'],
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
export class HashrateChartPoolsComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 25;

  miningWindowPreference: string;
  radioGroupForm: UntypedFormGroup;

  hashrates: Hashrate[];
  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  @HostBinding('attr.dir') dir = 'ltr';

  hashrateObservable$: Observable<any>;
  isLoading = true;
  timespan = '';
  chartInstance: any = undefined;

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private seoService: SeoService,
    private apiService: ApiService,
    private formBuilder: UntypedFormBuilder,
    private cd: ChangeDetectorRef,
    private storageService: StorageService,
    private miningService: MiningService,
    public stateService: StateService,
    private route: ActivatedRoute,
  ) {
    this.radioGroupForm = this.formBuilder.group({ dateSpan: '1y' });
    this.radioGroupForm.controls.dateSpan.setValue('1y');
  }

  ngOnInit(): void {
    let firstRun = true;

    this.seoService.setTitle($localize`:@@mining.pools-historical-dominance:Pools Historical Dominance`);
    this.seoService.setDescription($localize`:@@meta.descriptions.bitcoin.graphs.hashrate-pools:See Bitcoin mining pool dominance visualized over time: see how top mining pools' share of total hashrate has fluctuated over time.`);
    this.miningWindowPreference = this.miningService.getDefaultTimespan('6m');
    this.radioGroupForm = this.formBuilder.group({ dateSpan: this.miningWindowPreference });
    this.radioGroupForm.controls.dateSpan.setValue(this.miningWindowPreference);

    this.route
      .fragment
      .subscribe((fragment) => {
        if (['6m', '1y', '2y', '3y', 'all'].indexOf(fragment) > -1) {
          this.radioGroupForm.controls.dateSpan.setValue(fragment, { emitEvent: false });
        }
      });

    this.hashrateObservable$ = this.radioGroupForm.get('dateSpan').valueChanges
      .pipe(
        startWith(this.radioGroupForm.controls.dateSpan.value),
        switchMap((timespan) => {
          if (!firstRun) {
            this.storageService.setValue('miningWindowPreference', timespan);
          }
          this.timespan = timespan;
          firstRun = false;
          this.isLoading = true;
          return this.apiService.getHistoricalPoolsHashrate$(timespan)
            .pipe(
              tap((response) => {
                this.hashrates = response.body;
                // Prepare series (group all hashrates data point by pool)
                const series = this.applyHashrates();
                if (series.length === 0) {
                  this.cd.markForCheck();
                  throw new Error();
                }
              }),
              map((response) => {
                return {
                  blockCount: parseInt(response.headers.get('x-total-count'), 10),
                }
              }),
              retryWhen((errors) => errors.pipe(
                delay(60000)
              ))
            );
        }),
        share()
      );
  }

  applyHashrates(): any[] {
    const times: { [time: number]: { hashrates: { [pool: string]: Hashrate } } } = {};
    const pools = {};
    for (const hashrate of this.hashrates) {
      if (!times[hashrate.timestamp]) {
        times[hashrate.timestamp] = { hashrates: {} };
      }
      times[hashrate.timestamp].hashrates[hashrate.poolName] = hashrate;
      if (!pools[hashrate.poolName]) {
        pools[hashrate.poolName] = true;
      }
    }

    const sortedTimes = Object.keys(times).sort((a,b) => parseInt(a) - parseInt(b)).map(time => ({ time: parseInt(time), hashrates: times[time].hashrates }));
    const lastHashrates = sortedTimes[sortedTimes.length - 1].hashrates;
    const sortedPools = Object.keys(pools).sort((a,b) => {
      if (lastHashrates[b]?.share ?? lastHashrates[a]?.share ?? false) {
        // sort by descending share of hashrate in latest period
        return (lastHashrates[b]?.share || 0) - (lastHashrates[a]?.share || 0);
      } else {
        // tiebreak by pool name
        b < a;
      }
    });

    const series = [];
    const legends = [];
    for (const name of sortedPools) {
      const data = sortedTimes.map(({ time, hashrates }) => {
        return [time * 1000, (hashrates[name]?.share || 0) * 100];
      });
      series.push({
        zlevel: 0,
        stack: 'Total',
        name: name,
        showSymbol: false,
        symbol: 'none',
        data,
        type: 'line',
        lineStyle: { width: 0 },
        areaStyle: { opacity: 1 },
        smooth: true,
        color: poolsColor[name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()],
        emphasis: {
          disabled: true,
          scale: false,
        },
      });

      legends.push({
        name: name,
        inactiveColor: 'rgb(110, 112, 121)',
        textStyle: {
          color: 'white',
        },
        icon: 'roundRect',
        itemStyle: {
          color: poolsColor[name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()],
        },
      });
    }

    this.prepareChartOptions({
      legends: legends,
      series: series,
    });
    this.isLoading = false;

    return series;
  }

  prepareChartOptions(data) {
    let title: object;
    if (data.series.length === 0) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`:@@23555386d8af1ff73f297e89dd4af3f4689fb9dd:Indexing blocks`,
        left: 'center',
        top: 'center',
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      color: chartColors.filter(color => color !== '#FDD835'),
      grid: {
        right: this.right,
        left: this.left,
        bottom: 70,
        top: this.isMobile() ? 10 : 50,
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
          color: 'var(--tooltip-grey)',
          align: 'left',
        },
        borderColor: '#000',
        formatter: function (data) {
          const date = new Date(data[0].data[0]).toLocaleDateString(this.locale, { year: 'numeric', month: 'short', day: 'numeric' });
          let tooltip = `<b style="color: white; margin-left: 2px">${date}</b><br>`;
          data.sort((a, b) => b.data[1] - a.data[1]);
          for (const pool of data) {
            if (pool.data[1] > 0) {
              tooltip += `${pool.marker} ${pool.seriesName}: ${pool.data[1].toFixed(2)}%<br>`;
            }
          }
          return tooltip;
        }.bind(this)
      },
      xAxis: data.series.length === 0 ? undefined : {
        type: 'time',
        splitNumber: this.isMobile() ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: (this.isMobile() || data.series.length === 0) ? undefined : {
        data: data.legends
      },
      yAxis: data.series.length === 0 ? undefined : {
        position: 'right',
        axisLabel: {
          color: 'rgb(110, 112, 121)',
          formatter: (val) => `${val}%`,
        },
        splitLine: {
          show: false,
        },
        type: 'value',
        max: 100,
        min: 0,
      },
      series: data.series,
      dataZoom: [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 10,
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
    this.cd.markForCheck();
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
    this.chartOptions.grid.bottom = 30;
    this.chartOptions.backgroundColor = 'var(--active-bg)';
    this.chartInstance.setOption(this.chartOptions);
    download(this.chartInstance.getDataURL({
      pixelRatio: 2,
      excludeComponents: ['dataZoom'],
    }), `pools-dominance-${this.timespan}-${Math.round(now.getTime() / 1000)}.svg`);
    // @ts-ignore
    this.chartOptions.grid.bottom = prevBottom;
    this.chartOptions.backgroundColor = 'none';
    this.chartInstance.setOption(this.chartOptions);
  }
}
