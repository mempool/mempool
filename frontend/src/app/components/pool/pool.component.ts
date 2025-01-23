import { ChangeDetectionStrategy, Component, Inject, Input, LOCALE_ID, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { echarts, EChartsOption } from '@app/graphs/echarts';
import { BehaviorSubject, Observable, Subscription, combineLatest, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, share, switchMap, tap } from 'rxjs/operators';
import { BlockExtended, PoolStat } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { selectPowerOfTen } from '@app/bitcoin.utils';
import { formatNumber } from '@angular/common';
import { SeoService } from '@app/services/seo.service';
import { HttpErrorResponse } from '@angular/common/http';
import { StratumJob } from '../../interfaces/websocket.interface';
import { WebsocketService } from '../../services/websocket.service';
import { MiningService } from '../../services/mining.service';

interface AccelerationTotal {
  cost: number,
  count: number,
}

@Component({
  selector: 'app-pool',
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PoolComponent implements OnInit {
  @Input() right: number | string = 45;
  @Input() left: number | string = 75;

  gfg = true;
  stratumEnabled = this.stateService.env.STRATUM_ENABLED;

  formatNumber = formatNumber;
  Math = Math;
  slugSubscription: Subscription;
  poolStats$: Observable<PoolStat>;
  blocks$: Observable<BlockExtended[]>;
  oobFees$: Observable<AccelerationTotal[]>;
  job$: Observable<StratumJob | null>;
  expectedBlockTime$: Observable<number>;
  isLoading = true;
  error: HttpErrorResponse | null = null;

  chartOptions: EChartsOption = {};
  chartInitOptions = {
    renderer: 'svg',
  };

  blocks: BlockExtended[] = [];
  slug: string = undefined;

  auditAvailable = false;

  loadMoreSubject: BehaviorSubject<number> = new BehaviorSubject(this.blocks[this.blocks.length - 1]?.height);

  constructor(
    @Inject(LOCALE_ID) public locale: string,
    private apiService: ApiService,
    private route: ActivatedRoute,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private miningService: MiningService,
    private seoService: SeoService,
  ) {
    this.auditAvailable = this.stateService.env.AUDIT;
  }

  ngOnInit(): void {
    this.slugSubscription = this.route.params.pipe(map((params) => params.slug)).subscribe((slug) => {
      this.isLoading = true;
      this.blocks = [];
      this.chartOptions = {};
      this.slug = slug;
      this.initializeObservables();
    });
  }

  initializeObservables(): void {
    this.poolStats$ = this.apiService.getPoolHashrate$(this.slug)
      .pipe(
        switchMap((data) => {
          this.isLoading = false;
          const hashrate = data.map(val => [val.timestamp * 1000, val.avgHashrate]);
          const share = data.map(val => [val.timestamp * 1000, val.share * 100]);
          this.prepareChartOptions(hashrate, share);
          return this.apiService.getPoolStats$(this.slug);
        }),
        map((poolStats) => {
          this.seoService.setTitle(poolStats.pool.name);
          this.seoService.setDescription($localize`:@@meta.description.mining.pool:See mining pool stats for ${poolStats.pool.name}\: most recent mined blocks, hashrate over time, total block reward to date, known coinbase addresses, and more.`);
          let regexes = '"';
          for (const regex of poolStats.pool.regexes) {
            regexes += regex + '", "';
          }
          poolStats.pool.regexes = regexes.slice(0, -3);

          return Object.assign({
            logo: `/resources/mining-pools/` + poolStats.pool.slug + '.svg'
          }, poolStats);
        }),
        catchError(() => {
          this.isLoading = false;
          this.seoService.logSoft404();
          return of(null);
        }),
      );

    this.blocks$ = this.loadMoreSubject
      .pipe(
        distinctUntilChanged(),
        switchMap((flag) => {
          if (this.slug === undefined) {
            return [];
          }
          return this.apiService.getPoolBlocks$(this.slug, this.blocks[this.blocks.length - 1]?.height);
        }),
        catchError((err) => {
          this.error = err;
          return of([]);
        }),
        tap((newBlocks) => {
          this.blocks = this.blocks.concat(newBlocks);
        }),
        map(() => this.blocks),
        share(),
      );

    this.oobFees$ = this.route.params.pipe(map((params) => params.slug)).pipe(
      filter(() => this.stateService.env.PUBLIC_ACCELERATIONS === true && this.stateService.network === ''),
      switchMap(slug => {
        return combineLatest([
          this.apiService.getAccelerationTotals$(this.slug, '1w'),
          this.apiService.getAccelerationTotals$(this.slug, '1m'),
          this.apiService.getAccelerationTotals$(this.slug),
        ]);
      }),
      filter(oob => oob.length === 3 && oob[2].count > 0)
    );

    if (this.stratumEnabled) {
      this.job$ = combineLatest([
        this.poolStats$.pipe(
          tap((poolStats) => {
            this.websocketService.startTrackStratum(poolStats.pool.unique_id);
          })
        ),
        this.stateService.stratumJobs$
      ]).pipe(
        map(([poolStats, jobs]) => {
          return jobs[poolStats.pool.unique_id];
        })
      );

      this.expectedBlockTime$ = combineLatest([
        this.miningService.getMiningStats('1w'),
        this.poolStats$,
        this.stateService.difficultyAdjustment$
      ]).pipe(
        map(([miningStats, poolStat, da]) => {
          return (da.timeAvg / ((poolStat.estimatedHashrate || 0) / (miningStats.lastEstimatedHashrate * 1_000_000_000_000_000_000))) + Date.now() + da.timeOffset;
        })
      );
    }
  }

  prepareChartOptions(hashrate, share) {
    let title: object;
    if (hashrate.length <= 1) {
      title = {
        textStyle: {
          color: 'grey',
          fontSize: 15
        },
        text: $localize`Not enough data yet`,
        left: 'center',
        top: 'center'
      };
    }

    this.chartOptions = {
      title: title,
      animation: false,
      color: [
        new echarts.graphic.LinearGradient(0, 0, 0, 0.65, [
          { offset: 0, color: '#F4511E' },
          { offset: 0.25, color: '#FB8C00' },
          { offset: 0.5, color: '#FFB300' },
          { offset: 0.75, color: '#FDD835' },
          { offset: 1, color: '#7CB342' }
        ]),
        '#D81B60',
      ],
      grid: {
        right: this.right,
        left: this.left,
        bottom: 60,
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
        formatter: function (ticks: any[]) {
          let hashrateString = '';
          let dominanceString = '';

          for (const tick of ticks) {
            if (tick.seriesIndex === 0) {
              let hashratePowerOfTen = selectPowerOfTen(tick.data[1], 10);
              let hashrateData = tick.data[1] / hashratePowerOfTen.divider;
              hashrateString = `${tick.marker} ${tick.seriesName}: ${formatNumber(hashrateData, this.locale, '1.0-0')} ${hashratePowerOfTen.unit}H/s<br>`;
            } else if (tick.seriesIndex === 1) {
              dominanceString = `${tick.marker} ${tick.seriesName}: ${formatNumber(tick.data[1], this.locale, '1.0-2')}%`;
            }             
          }
          
          return `
            <b style="color: white; margin-left: 18px">${ticks[0].axisValueLabel}</b><br>
            <span>${hashrateString}</span>
            <span>${dominanceString}</span>
          `;
        }.bind(this)
      },
      xAxis: hashrate.length <= 1 ? undefined : {
        type: 'time',
        splitNumber: (this.isMobile()) ? 5 : 10,
        axisLabel: {
          hideOverlap: true,
        }
      },
      legend: {
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
            name: $localize`:mining.pool-dominance:Pool Dominance`,
            inactiveColor: 'rgb(110, 112, 121)',
            textStyle: {
              color: 'white',
            },
            icon: 'roundRect',
          },
        ],
      },
      yAxis: hashrate.length <= 1 ? undefined : [
        {
          min: (value) => {
            return value.min * 0.9;
          },
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              const selectedPowerOfTen: any = selectPowerOfTen(val);
              const newVal = Math.round(val / selectedPowerOfTen.divider);
              return `${newVal} ${selectedPowerOfTen.unit}H/s`
            }
          },
          splitLine: {
            show: false,
          }
        },
        {
          type: 'value',
          axisLabel: {
            color: 'rgb(110, 112, 121)',
            formatter: (val) => {
              return `${val}%`
            }
          },
          splitLine: {
            show: false,
          }
        }
      ],
      series: hashrate.length <= 1 ? undefined : [
        {
          zlevel: 1,
          name: $localize`:@@79a9dc5b1caca3cbeb1733a19515edacc5fc7920:Hashrate`,
          showSymbol: false,
          symbol: 'none',
          data: hashrate,
          type: 'line',
          lineStyle: {
            width: 2,
          },
        },
        {
          zlevel: 0,
          name: $localize`:mining.pool-dominance:Pool Dominance`,
          showSymbol: false,
          symbol: 'none',
          data: share,
          type: 'line',
          yAxisIndex: 1,
          lineStyle: {
            width: 2,
          },
        }
      ],
      dataZoom: hashrate.length <= 1 ? undefined : [{
        type: 'inside',
        realtime: true,
        zoomLock: true,
        maxSpan: 100,
        minSpan: 10,
        moveOnMouseMove: false,
      }, {
        fillerColor: '#aaaaff15',
        borderColor: '#ffffff88',
        showDetail: false,
        show: true,
        type: 'slider',
        brushSelect: false,
        realtime: true,
        bottom: 0,
        left: 20,
        right: 15,
        selectedDataBackground: {
          lineStyle: {
            color: '#fff',
            opacity: 0.45,
          },
          areaStyle: {
            opacity: 0,
          },
        },
      }],
    };
  }

  isMobile() {
    return (window.innerWidth <= 767.98);
  }

  loadMore() {
    this.loadMoreSubject.next(this.blocks[this.blocks.length - 1]?.height);
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }

  reverseHash(hash: string) {
    return hash.match(/../g).reverse().join('');
  }

  ngOnDestroy(): void {
    this.slugSubscription.unsubscribe();
  }
}
