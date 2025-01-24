import { AfterViewInit, ChangeDetectionStrategy, Component, HostListener, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { combineLatest, EMPTY, fromEvent, interval, merge, Observable, of, Subject, Subscription, timer } from 'rxjs';
import { catchError, delayWhen, distinctUntilChanged, filter, map, scan, share, shareReplay, startWith, switchMap, takeUntil, tap, throttleTime } from 'rxjs/operators';
import { AuditStatus, BlockExtended, CurrentPegs, FederationAddress, FederationUtxo, OptimizedMempoolStats, PegsVolume, RecentPeg, TransactionStripped } from '@interfaces/node-api.interface';
import { MempoolInfo, ReplacementInfo } from '@interfaces/websocket.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { ActiveFilter, FilterMode, GradientMode, toFlags } from '@app/shared/filters.utils';
import { detectWebGL } from '@app/shared/graphs.utils';

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
  recentPegsList$: Observable<RecentPeg[]>;
  pegsVolume$: Observable<PegsVolume[]>;
  federationAddresses$: Observable<FederationAddress[]>;
  federationAddressesNumber$: Observable<number>;
  federationUtxosNumber$: Observable<number>;
  expiredUtxos$: Observable<FederationUtxo[]>;
  emergencySpentUtxosStats$: Observable<any>;
  fullHistory$: Observable<any>;
  isLoad: boolean = true;
  filterSubscription: Subscription;
  mempoolInfoSubscription: Subscription;
  currencySubscription: Subscription;
  currency: string;
  incomingGraphHeight: number = 300;
  lbtcPegGraphHeight: number = 360;
  webGlEnabled = true;
  private lastPegBlockUpdate: number = 0;
  private lastPegAmount: string = '';
  private lastReservesBlockUpdate: number = 0;

  goggleResolution = 82;
  goggleCycle: { index: number, name: string, mode: FilterMode, filters: string[], gradient: GradientMode }[] = [
    { index: 0, name: $localize`:@@dfc3c34e182ea73c5d784ff7c8135f087992dac1:All`, mode: 'and', filters: [], gradient: 'age' },
    { index: 1, name: $localize`Consolidation`, mode: 'and', filters: ['consolidation'], gradient: 'fee' },
    { index: 2, name: $localize`Coinjoin`, mode: 'and', filters: ['coinjoin'], gradient: 'fee' },
    { index: 3, name: $localize`Data`, mode: 'or', filters: ['inscription', 'fake_pubkey', 'fake_scripthash', 'op_return'], gradient: 'fee' },
  ];
  goggleFlags = 0n;
  goggleMode: FilterMode = 'and';
  gradientMode: GradientMode = 'age';
  goggleIndex = 0;

  private destroy$ = new Subject();

  constructor(
    public stateService: StateService,
    private apiService: ApiService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.webGlEnabled = this.stateService.isBrowser && detectWebGL();
  }

  ngAfterViewInit(): void {
    this.stateService.focusSearchInputDesktop();
  }

  ngOnDestroy(): void {
    this.filterSubscription.unsubscribe();
    this.mempoolInfoSubscription.unsubscribe();
    this.currencySubscription.unsubscribe();
    this.websocketService.stopTrackRbfSummary();
    this.destroy$.next(1);
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.onResize();
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

    this.filterSubscription = this.stateService.activeGoggles$.subscribe((active: ActiveFilter) => {
      const activeFilters = active.filters.sort().join(',');
      for (const goggle of this.goggleCycle) {
        if (goggle.mode === active.mode) {
          const goggleFilters = goggle.filters.sort().join(',');
          if (goggleFilters === activeFilters) {
            this.goggleIndex = goggle.index;
            this.goggleFlags = toFlags(goggle.filters);
            this.goggleMode = goggle.mode;
            this.gradientMode = active.gradient;
            return;
          }
        }
      }
      this.goggleCycle.push({
        index: this.goggleCycle.length,
        name: 'Custom',
        mode: active.mode,
        filters: active.filters,
        gradient: active.gradient,
      });
      this.goggleIndex = this.goggleCycle.length - 1;
      this.goggleFlags = toFlags(active.filters);
      this.goggleMode = active.mode;
    });

    this.mempoolInfoData$ = combineLatest([
      this.stateService.mempoolInfo$,
      this.stateService.vbytesPerSecond$
    ]).pipe(
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

    this.mempoolInfoSubscription = this.mempoolInfoData$.subscribe();

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

    this.transactions$ = this.stateService.transactions$;

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
                  const now = Date.now() / 1000;
                  const start = now - (2 * 60 * 60);
                  acc.unshift(stats);
                  acc = acc.filter(p => p.added >= start);
                  return acc;
                }, (mempoolStats || []))
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
        shareReplay(1),
      );

    if (this.stateService.network === 'liquid') {
      this.auditStatus$ = this.stateService.blocks$.pipe(
        takeUntil(this.destroy$),
        throttleTime(40000),
        delayWhen(_ => this.isLoad ? timer(0) : timer(2000)),
        tap(() => this.isLoad = false),
        switchMap(() => this.apiService.federationAuditSynced$()),
        shareReplay(1)
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

      this.recentPegsList$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.recentPegsList$()),
        share()
      );
  
      this.pegsVolume$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.pegsVolume$()),
        share()
      );
  
      this.federationAddresses$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.federationAddresses$()),
        share()
      );
  
      this.federationAddressesNumber$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.federationAddressesNumber$()),
        map(count => count.address_count),
        share()
      );
  
      this.federationUtxosNumber$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.federationUtxosNumber$()),
        map(count => count.utxo_count),
        share()
      );

      this.expiredUtxos$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.expiredUtxos$()),
        share()
      );

      this.emergencySpentUtxosStats$ = this.auditUpdated$.pipe(
        filter(auditUpdated => auditUpdated === true),
        throttleTime(40000),
        switchMap(_ => this.apiService.emergencySpentUtxosStats$()),
        share()
      );
  
      this.liquidPegsMonth$ = interval(60 * 60 * 1000)
        .pipe(
          startWith(0),
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
  
      this.liquidReservesMonth$ = interval(60 * 60 * 1000).pipe(
        startWith(0),
        switchMap(() => this.apiService.listLiquidReservesMonth$()),
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
  
      this.fullHistory$ = combineLatest([this.liquidPegsMonth$, this.currentPeg$, this.liquidReservesMonth$, this.currentReserves$])
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

  getArrayFromNumber(num: number): number[] {
    return Array.from({ length: num }, (_, i) => i + 1);
  }
  
  setFilter(index): void {
    const selected = this.goggleCycle[index];
    this.stateService.activeGoggles$.next(selected);
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 992) {
      this.incomingGraphHeight = 300;
      this.goggleResolution = 82;
      this.lbtcPegGraphHeight = 360;
    } else if (window.innerWidth >= 768) {
      this.incomingGraphHeight = 215;
      this.goggleResolution = 80;
      this.lbtcPegGraphHeight = 270;
    } else {
      this.incomingGraphHeight = 180;
      this.goggleResolution = 86;
      this.lbtcPegGraphHeight = 270;
    }
  }
}
