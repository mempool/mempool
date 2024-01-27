import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { combineLatest, EMPTY, merge, Observable, of, Subject, Subscription, timer } from 'rxjs';
import { catchError, delayWhen, filter, map, scan, share, shareReplay, startWith, switchMap, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { AuditStatus, BlockExtended, CurrentPegs, OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { MempoolInfo, TransactionStripped, ReplacementInfo } from '../interfaces/websocket.interface';
import { ApiService } from '../services/api.service';
import { StateService } from '../services/state.service';
import { WebsocketService } from '../services/websocket.service';
import { SeoService } from '../services/seo.service';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressColor: string;
}

interface MempoolStatsData {
  mempool: OptimizedMempoolStats[];
  weightPerSecond: any;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  featuredAssets$: Observable<any>;
  network$: Observable<string>;
  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;
  mempoolLoadingStatus$: Observable<number>;
  vBytesPerSecondLimit = 1667;
  transactions$: Observable<TransactionStripped[]>;
  blocks$: Observable<BlockExtended[]>;
  replacements$: Observable<ReplacementInfo[]>;
  latestBlockHeight: number;
  mempoolTransactionsWeightPerSecondData: any;
  mempoolStats$: Observable<MempoolStatsData>;
  transactionsWeightPerSecondOptions: any;
  isLoadingWebSocket$: Observable<boolean>;
  liquidPegsMonth$: Observable<any>;
  currentPeg$: Observable<CurrentPegs>;
  auditStatus$: Observable<AuditStatus>;
  auditUpdated$: Observable<boolean>;
  liquidReservesMonth$: Observable<any>;
  currentReserves$: Observable<CurrentPegs>;
  fullHistory$: Observable<any>;
  isLoad: boolean = true;
  currencySubscription: Subscription;
  currency: string;
  private lastPegBlockUpdate: number = 0;
  private lastPegAmount: string = '';
  private lastReservesBlockUpdate: number = 0;

  private destroy$ = new Subject();

  constructor(
    public stateService: StateService,
    private apiService: ApiService,
    private websocketService: WebsocketService,
    private seoService: SeoService
  ) { }

  ngAfterViewInit(): void {
    this.stateService.focusSearchInputDesktop();
  }

  ngOnDestroy(): void {
    this.currencySubscription.unsubscribe();
    this.websocketService.stopTrackRbfSummary();
    this.destroy$.next(1);
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.seoService.resetTitle();
    this.seoService.resetDescription();
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks', 'live-2h-chart']);
    this.websocketService.startTrackRbfSummary();
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.mempoolLoadingStatus$ = this.stateService.loadingIndicators$
      .pipe(
        map((indicators) => indicators.mempool !== undefined ? indicators.mempool : 100)
      );

    this.mempoolInfoData$ = combineLatest([
      this.stateService.mempoolInfo$,
      this.stateService.vbytesPerSecond$
    ])
      .pipe(
        map(([mempoolInfo, vbytesPerSecond]) => {
          const percent = Math.round((Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100);

          let progressColor = 'bg-success';
          if (vbytesPerSecond > 1667) {
            progressColor = 'bg-warning';
          }
          if (vbytesPerSecond > 3000) {
            progressColor = 'bg-danger';
          }

          const mempoolSizePercentage = (mempoolInfo.usage / mempoolInfo.maxmempool * 100);
          let mempoolSizeProgress = 'bg-danger';
          if (mempoolSizePercentage <= 50) {
            mempoolSizeProgress = 'bg-success';
          } else if (mempoolSizePercentage <= 75) {
            mempoolSizeProgress = 'bg-warning';
          }

          return {
            memPoolInfo: mempoolInfo,
            vBytesPerSecond: vbytesPerSecond,
            progressWidth: percent + '%',
            progressColor: progressColor,
            mempoolSizeProgress: mempoolSizeProgress,
          };
        })
      );

    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$
      .pipe(
        map((mempoolBlocks) => {
          const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b, 0);
          const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b, 0);

          return {
            size: size,
            blocks: Math.ceil(vsize / this.stateService.blockVSize)
          };
        })
      );

    this.featuredAssets$ = this.apiService.listFeaturedAssets$()
      .pipe(
        map((featured) => {
          const newArray = [];
          for (const feature of featured) {
            if (feature.ticker !== 'L-BTC' && feature.asset) {
              newArray.push(feature);
            }
          }
          return newArray.slice(0, 4);
        }),
      );

    this.transactions$ = this.stateService.transactions$
      .pipe(
        scan((acc, tx) => {
          if (acc.find((t) => t.txid == tx.txid)) {
            return acc;
          }
          acc.unshift(tx);
          acc = acc.slice(0, 6);
          return acc;
        }, []),
      );

    this.blocks$ = this.stateService.blocks$
      .pipe(
        tap((blocks) => {
          this.latestBlockHeight = blocks[0].height;
        }),
        switchMap((blocks) => {
          if (this.stateService.env.MINING_DASHBOARD === true) {
            for (const block of blocks) {
              // @ts-ignore: Need to add an extra field for the template
              block.extras.pool.logo = `/resources/mining-pools/` +
                block.extras.pool.slug + '.svg';
            }
          }
          return of(blocks.slice(0, 6));
        })
      );

    this.replacements$ = this.stateService.rbfLatestSummary$;

    this.mempoolStats$ = this.stateService.connectionState$
      .pipe(
        filter((state) => state === 2),
        switchMap(() => this.apiService.list2HStatistics$().pipe(
          catchError((e) => {
            return of(null);
          })
        )),
        switchMap((mempoolStats) => {
          return merge(
            this.stateService.live2Chart$
              .pipe(
                scan((acc, stats) => {
                  acc.unshift(stats);
                  acc = acc.slice(0, 120);
                  return acc;
                }, mempoolStats)
              ),
            of(mempoolStats)
          );
        }),
        map((mempoolStats) => {
          if (mempoolStats) {
            return {
              mempool: mempoolStats,
              weightPerSecond: this.handleNewMempoolData(mempoolStats.concat([])),
            };
          } else {
            return null;
          }
        }),
        share(),
      );

    if (this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet') {
      this.auditStatus$ = this.stateService.blocks$.pipe(
        takeUntil(this.destroy$),
        throttleTime(40000),
        delayWhen(_ => this.isLoad ? timer(0) : timer(2000)),
        tap(() => this.isLoad = false),
        switchMap(() => this.apiService.federationAuditSynced$()),
        shareReplay(1)
      );

      ////////// Pegs historical data //////////
      this.liquidPegsMonth$ = this.auditStatus$.pipe(
        throttleTime(60 * 60 * 1000),
        switchMap(() => this.apiService.listLiquidPegsMonth$()),
        map((pegs) => {
          const labels = pegs.map(stats => stats.date);
          const series = pegs.map(stats => parseFloat(stats.amount) / 100000000);
          series.reduce((prev, curr, i) => series[i] = prev + curr, 0);
          return {
            series,
            labels
          };
        }),
        share(),
      );

      this.currentPeg$ = this.auditStatus$.pipe(
        switchMap(_ =>
          this.apiService.liquidPegs$().pipe(
            filter((currentPegs) => currentPegs.lastBlockUpdate >= this.lastPegBlockUpdate),
            tap((currentPegs) => {
              this.lastPegBlockUpdate = currentPegs.lastBlockUpdate;
            })
          )
        ),
        share()
      );

      ////////// BTC Reserves historical data //////////
      this.auditUpdated$ = combineLatest([
        this.auditStatus$,
        this.currentPeg$
      ]).pipe(
        filter(([auditStatus, _]) => auditStatus.isAuditSynced === true),
        map(([auditStatus, currentPeg]) => ({
          lastBlockAudit: auditStatus.lastBlockAudit,
          currentPegAmount: currentPeg.amount
        })),
        switchMap(({ lastBlockAudit, currentPegAmount }) => {
          const blockAuditCheck = lastBlockAudit > this.lastReservesBlockUpdate;
          const amountCheck = currentPegAmount !== this.lastPegAmount;
          this.lastPegAmount = currentPegAmount;
          return of(blockAuditCheck || amountCheck);
        })
      );

      this.liquidReservesMonth$ = this.auditStatus$.pipe(
        throttleTime(60 * 60 * 1000),
        switchMap((auditStatus) => {
          return auditStatus.isAuditSynced ? this.apiService.listLiquidReservesMonth$() : EMPTY;
        }),
        map(reserves => {
          const labels = reserves.map(stats => stats.date);
          const series = reserves.map(stats => parseFloat(stats.amount) / 100000000);
          return {
            series,
            labels
          };
        }),
        share()
      );

      this.currentReserves$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ =>
          this.apiService.liquidReserves$().pipe(
            filter((currentReserves) => currentReserves.lastBlockUpdate >= this.lastReservesBlockUpdate),
            tap((currentReserves) => {
              this.lastReservesBlockUpdate = currentReserves.lastBlockUpdate;
            })
          )
        ),
        share()
      );

      this.fullHistory$ = combineLatest([this.liquidPegsMonth$, this.currentPeg$, this.liquidReservesMonth$.pipe(startWith(null)), this.currentReserves$.pipe(startWith(null))])
        .pipe(
          map(([liquidPegs, currentPeg, liquidReserves, currentReserves]) => {
            liquidPegs.series[liquidPegs.series.length - 1] = parseFloat(currentPeg.amount) / 100000000;

            if (liquidPegs.series.length === liquidReserves?.series.length) {
              liquidReserves.series[liquidReserves.series.length - 1] = parseFloat(currentReserves?.amount) / 100000000;
            } else if (liquidPegs.series.length === liquidReserves?.series.length + 1) {
              liquidReserves.series.push(parseFloat(currentReserves?.amount) / 100000000);
              liquidReserves.labels.push(liquidPegs.labels[liquidPegs.labels.length - 1]);
            } else {
              liquidReserves = {
                series: [],
                labels: []
              };
            }

            return {
              liquidPegs,
              liquidReserves
            };
          }),
          share()
        );
    }

    this.currencySubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
    });
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    return {
      labels: labels,
      series: [mempoolStats.map((stats) => [stats.added * 1000, stats.vbytes_per_second])],
    };
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }
}
