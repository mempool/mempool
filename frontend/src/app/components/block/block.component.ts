import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { switchMap, tap, throttleTime, catchError, map, shareReplay, startWith, filter, take } from 'rxjs/operators';
import { Observable, of, Subscription, asyncScheduler, EMPTY, combineLatest, forkJoin } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { WebsocketService } from '@app/services/websocket.service';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { Acceleration, BlockAudit, BlockExtended, TransactionStripped } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { BlockOverviewGraphComponent } from '@components/block-overview-graph/block-overview-graph.component';
import { detectWebGL } from '@app/shared/graphs.utils';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { PriceService, Price } from '@app/services/price.service';
import { CacheService } from '@app/services/cache.service';
import { ServicesApiServices } from '@app/services/services-api.service';
import { PreloadService } from '@app/services/preload.service';
import { identifyPrioritizedTransactions } from '@app/shared/transaction.utils';

interface ComparisonStats {
  totalFees: number;
  totalWeight: number;
  txCount: number;
  feeDelta: number;
  weightDelta: number;
  txDelta: number;
}

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss'],
  styles: [`
    .loadingGraphs {
      position: absolute;
      top: 50%;
      left: calc(50% - 15px);
      z-index: 100;
    }
  `],
})
export class BlockComponent implements OnInit, OnDestroy {
  network = '';
  block: BlockExtended;
  blockAudit: BlockAudit = undefined;
  blockHeight: number;
  lastBlockHeight: number;
  nextBlockHeight: number;
  blockHash: string;
  isLoadingBlock = true;
  latestBlock: BlockExtended;
  latestBlocks: BlockExtended[] = [];
  oobFees: number = 0;
  strippedTransactions: TransactionStripped[];
  accelerations: Acceleration[];
  overviewTransitionDirection: string;
  isLoadingOverview = true;
  error: any;
  blockSubsidy: number;
  fees: number;
  block$: Observable<any>;
  showDetails = false;
  showPreviousBlocklink = true;
  showNextBlocklink = true;
  overviewError: any = null;
  webGlEnabled = true;
  auditParamEnabled: boolean = false;
  auditSupported: boolean = this.stateService.env.AUDIT && this.stateService.env.BASE_MODULE === 'mempool' && this.stateService.env.MINING_DASHBOARD === true;
  auditModeEnabled: boolean = !this.stateService.hideAudit.value;
  auditAvailable = true;
  showAudit: boolean;
  isMobile = window.innerWidth <= 767.98;
  hoverTx: string;
  numMissing: number = 0;
  paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;
  numUnexpected: number = 0;
  mode: 'projected' | 'actual' | 'stale' = 'projected';
  currentQueryParams: Params;

  overviewSubscription: Subscription;
  canonicalSubscription: Subscription;
  accelerationsSubscription: Subscription;
  keyNavigationSubscription: Subscription;
  blocksSubscription: Subscription;
  cacheBlocksSubscription: Subscription;
  networkChangedSubscription: Subscription;
  queryParamsSubscription: Subscription;
  timeLtrSubscription: Subscription;
  timeLtr: boolean;
  childChangeSubscription: Subscription;
  auditPrefSubscription: Subscription;
  isAuditEnabledSubscription: Subscription;
  oobSubscription: Subscription;
  priceSubscription: Subscription;
  blockConversion: Price;
  canonicalBlock: BlockExtended;
  canonicalTransactions: TransactionStripped[];
  staleTransactions: TransactionStripped[];
  staleStats: ComparisonStats | null = null;
  canonicalStats: ComparisonStats | null = null;

  @ViewChildren('blockGraphProjected') blockGraphProjected: QueryList<BlockOverviewGraphComponent>;
  @ViewChildren('blockGraphActual') blockGraphActual: QueryList<BlockOverviewGraphComponent>;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private seoService: SeoService,
    private websocketService: WebsocketService,
    private relativeUrlPipe: RelativeUrlPipe,
    private apiService: ApiService,
    private priceService: PriceService,
    private cacheService: CacheService,
    private servicesApiService: ServicesApiServices,
    private cd: ChangeDetectorRef,
    private preloadService: PreloadService,
  ) {
    this.webGlEnabled = this.stateService.isBrowser && detectWebGL();
  }

  get showComparison() {
    return this.showAudit || this.block?.stale;
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.network = this.stateService.network;

    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });

    this.setAuditAvailable(this.auditSupported);

    if (this.auditSupported) {
      this.isAuditEnabledSubscription = this.isAuditEnabledFromParam().subscribe(auditParam => {
        if (this.auditParamEnabled) {
          this.auditModeEnabled = auditParam;
        }
      });
    }
    this.auditPrefSubscription = this.stateService.hideAudit.subscribe((hide) => {
      this.auditModeEnabled = !hide;
      this.showAudit = this.auditSupported && this.auditAvailable && this.auditModeEnabled;
      if (this.block?.stale) {
        this.setupBlockGraphs();
      }
    });

    this.cacheBlocksSubscription = this.cacheService.loadedBlocks$.subscribe((block) => {
      this.loadedCacheBlock(block);
    });

    this.blocksSubscription = this.stateService.blocks$
      .subscribe((blocks) => {
        this.latestBlock = blocks[0];
        this.latestBlocks = blocks;
        this.setNextAndPreviousBlockLink();

        for (const block of blocks) {
          if (block.id === this.blockHash) {
            this.block = block;
            if (block.extras) {
              block.extras.minFee = this.getMinBlockFee(block);
              block.extras.maxFee = this.getMaxBlockFee(block);
              if (block?.extras?.reward != undefined) {
                this.fees = block.extras.reward / 100000000 - this.blockSubsidy;
              }
            }
          } else if (block.height === this.block?.height) {
            this.block.stale = true;
            this.block.canonical = block.id;
            this.fetchCanonicalBlock();
          }
        }
      });

    this.block$ = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const blockHash: string = params.get('id') || '';
        this.block = undefined;
        this.error = undefined;
        this.fees = undefined;
        this.oobFees = 0;

        if (history.state.data && history.state.data.blockHeight) {
          this.blockHeight = history.state.data.blockHeight;
          this.updateAuditAvailableFromBlockHeight(this.blockHeight);
        }

        let isBlockHeight = false;
        if (/^[0-9]+$/.test(blockHash)) {
          isBlockHeight = true;
          this.stateService.markBlock$.next({ blockHeight: parseInt(blockHash, 10)});
        } else {
          this.blockHash = blockHash;
        }
        document.body.scrollTo(0, 0);

        if (history.state.data && history.state.data.block) {
          this.blockHeight = history.state.data.block.height;
          this.updateAuditAvailableFromBlockHeight(this.blockHeight);
          return of(history.state.data.block);
        } else {
          this.isLoadingBlock = true;
          this.isLoadingOverview = true;
          this.strippedTransactions = undefined;
          this.blockAudit = undefined;
          this.accelerations = undefined;

          let blockInCache: BlockExtended;
          if (isBlockHeight) {
            blockInCache = this.latestBlocks.find((block) => block.height === parseInt(blockHash, 10));
            if (blockInCache) {
              return of(blockInCache);
            }
            return this.electrsApiService.getBlockHashFromHeight$(parseInt(blockHash, 10))
              .pipe(
                switchMap((hash) => {
                  this.blockHash = hash;
                  this.location.replaceState(
                    this.router.createUrlTree([(this.network ? '/' + this.network : '') + '/block/', hash]).toString()
                  );
                  this.seoService.updateCanonical(this.location.path());
                  return this.apiService.getBlock$(hash).pipe(
                    catchError((err) => {
                      this.error = err;
                      this.isLoadingBlock = false;
                      this.isLoadingOverview = false;
                      this.seoService.logSoft404();
                      return EMPTY;
                    })
                  );
                }),
                catchError((err) => {
                  this.error = err;
                  this.isLoadingBlock = false;
                  this.isLoadingOverview = false;
                  this.seoService.logSoft404();
                  return EMPTY;
                }),
              );
          }

          blockInCache = this.latestBlocks.find((block) => block.id === this.blockHash);
          if (blockInCache) {
            return of(blockInCache);
          }

          return this.apiService.getBlock$(blockHash).pipe(
            catchError((err) => {
              this.error = err;
              this.isLoadingBlock = false;
              this.isLoadingOverview = false;
              this.seoService.logSoft404();
              return EMPTY;
            })
          );
        }
      }),
      tap((block: BlockExtended) => {
        if (block.previousblockhash) {
          this.preloadService.block$.next(block.previousblockhash);
          if (this.auditSupported) {
            this.preloadService.blockAudit$.next(block.previousblockhash);
          }
        }
        this.updateAuditAvailableFromBlockHeight(block.height);
        this.block = block;
        if (block.extras) {
          block.extras.minFee = this.getMinBlockFee(block);
          block.extras.maxFee = this.getMaxBlockFee(block);
        }
        this.blockHeight = block.height;
        this.lastBlockHeight = this.blockHeight;
        this.nextBlockHeight = block.height + 1;
        this.setNextAndPreviousBlockLink();

        this.seoService.setTitle($localize`:@@block.component.browser-title:Block ${block.height}:BLOCK_HEIGHT:: ${block.id}:BLOCK_ID:`);
        if( this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ) {
          this.seoService.setDescription($localize`:@@meta.description.liquid.block:See size, weight, fee range, included transactions, and more for Liquid${seoDescriptionNetwork(this.stateService.network)} block ${block.height}:BLOCK_HEIGHT: (${block.id}:BLOCK_ID:).`);
        } else {
          this.seoService.setDescription($localize`:@@meta.description.bitcoin.block:See size, weight, fee range, included transactions, audit (expected v actual), and more for Bitcoin${seoDescriptionNetwork(this.stateService.network)} block ${block.height}:BLOCK_HEIGHT: (${block.id}:BLOCK_ID:).`);
        }
        this.isLoadingBlock = false;
        this.setBlockSubsidy();
        if (block?.extras?.reward !== undefined) {
          this.fees = block.extras.reward / 100000000 - this.blockSubsidy;
        }
        this.isLoadingOverview = true;
        this.overviewError = null;

        if (!block.stale) {
          this.stateService.markBlock$.next({ blockHeight: this.blockHeight });
          const cachedBlock = this.cacheService.getCachedBlock(block.height);
          if (!cachedBlock) {
            this.cacheService.loadBlock(block.height);
          } else {
            this.loadedCacheBlock(cachedBlock);
          }
        }
      }),
      throttleTime(300, asyncScheduler, { leading: true, trailing: true }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.overviewSubscription = this.block$.pipe(
      switchMap((block) => {
        return forkJoin([
          of(block),
          this.apiService.getStrippedBlockTransactions$(block.id)
            .pipe(
              catchError((err) => {
                this.overviewError = err;
                return of(null);
              })
            ),
          !this.isAuditAvailableFromBlockHeight(block.height) ? of(null) : this.apiService.getBlockAudit$(block.id)
            .pipe(
              catchError((err) => {
                this.overviewError = err;
                return of(null);
              })
            ),
          block.stale ? this.electrsApiService.getBlockHashFromHeight$(block.height)
            .pipe(
              switchMap((hash) => {
                return forkJoin([
                  this.apiService.getBlock$(hash).pipe(
                    catchError((err) => {
                      console.error('Error fetching canonical block:', err);
                      this.overviewError = err;
                      return of(null);
                    })
                  ),
                  this.apiService.getStrippedBlockTransactions$(hash).pipe(
                    catchError((err) => {
                      console.error('Error fetching canonical transactions:', err);
                      this.overviewError = err;
                      return of(null);
                    })
                  )
                ]);
              }),
              catchError((err) => {
                console.error('Error fetching canonical block:', err);
                return of([null, null]);
              })
            ) : of([null, null]),
        ]);
      })
    )
    .subscribe(([block, transactions, blockAudit, [canonicalBlock, canonicalTransactions]]) => {
      if (transactions) {
        this.strippedTransactions = transactions;
      } else {
        this.strippedTransactions = [];
      }
      this.blockAudit = blockAudit;

      // Handle canonical block data from the overviewSubscription (when block.stale is true from backend)
      if (block.stale && canonicalBlock && canonicalTransactions) {
        this.canonicalBlock = canonicalBlock;
        this.canonicalTransactions = canonicalTransactions;
        this.staleTransactions = JSON.parse(JSON.stringify(transactions));
        this.setupStaleComparison();
        this.setAuditMode(false);
      } else if (!block.stale) {
        // Clear stale-related data when viewing a non-stale block
        this.staleTransactions = null;
        this.canonicalBlock = null;
        this.canonicalTransactions = null;
      }

      this.setupBlockAudit();
      this.isLoadingOverview = false;
    });

    this.accelerationsSubscription = this.block$.pipe(
      switchMap((block) => {
        return this.stateService.env.ACCELERATOR === true && block.height > 819500
          ? this.servicesApiService.getAllAccelerationHistory$({ blockHeight: block.height })
            .pipe(catchError(() => {
              return of([]);
            }))
          : of([]);
      })
    ).subscribe((accelerations) => {
      this.accelerations = accelerations;
      if (accelerations.length && this.strippedTransactions) { // Don't call setupBlockAudit if we don't have transactions yet; it will be called later in overviewSubscription
        this.setupBlockAudit();
      }
    });

    this.oobSubscription = this.block$.pipe(
      filter(() => this.stateService.env.PUBLIC_ACCELERATIONS === true && this.stateService.network === ''),
      switchMap((block) => this.apiService.getAccelerationsByHeight$(block.height)
        .pipe(
          map(accelerations => {
            return { block, accelerations };
          }),
          catchError(() => {
            return of({ block, accelerations: [] });
        }))
      ),
    ).subscribe(({ block, accelerations}) => {
      let totalFees = 0;
      for (const acc of accelerations) {
        totalFees += acc.boost_cost;
      }
      this.oobFees = totalFees;
      if (block && this.block && this.blockAudit && block?.height === this.block?.height) {
        this.blockAudit.feeDelta = this.blockAudit.expectedFees > 0 ? (this.blockAudit.expectedFees - (this.block.extras.totalFees + this.oobFees)) / this.blockAudit.expectedFees : 0;
      }
    },
    (error) => {
      this.error = error;
      this.isLoadingBlock = false;
      this.isLoadingOverview = false;
    });

    this.networkChangedSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      this.currentQueryParams = params;
      if (params.showDetails === 'true') {
        this.showDetails = true;
      } else {
        this.showDetails = false;
      }
      switch (params.view) {
        case 'stale':
          this.mode = 'stale';
          break;
        case 'projected':
          this.mode = 'projected';
          break;
        default:
          this.mode = 'actual';
          break;
      }
      this.setupBlockGraphs();
    });

    this.keyNavigationSubscription = this.stateService.keyNavigation$.subscribe((event) => {
      const prevKey = this.timeLtr ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.timeLtr ? 'ArrowRight' : 'ArrowLeft';
      if (this.showPreviousBlocklink && event.key === prevKey && this.nextBlockHeight - 2 >= 0) {
        this.navigateToPreviousBlock();
      }
      if (event.key === nextKey) {
        if (this.showNextBlocklink) {
          this.navigateToNextBlock();
        } else {
          this.router.navigate([this.relativeUrlPipe.transform('/mempool-block'), '0']);
        }
      }
    });

    if (this.priceSubscription) {
      this.priceSubscription.unsubscribe();
    }
    this.priceSubscription = combineLatest([this.stateService.fiatCurrency$, this.block$]).pipe(
      switchMap(([currency, block]) => {
        return this.priceService.getBlockPrice$(block.timestamp, true, currency).pipe(
          tap((price) => {
            this.blockConversion = price;
          })
        );
      })
    ).subscribe();
  }

  ngAfterViewInit(): void {
    this.childChangeSubscription = combineLatest([this.blockGraphProjected.changes.pipe(startWith(null)), this.blockGraphActual.changes.pipe(startWith(null))]).subscribe(() => {
      this.setupBlockGraphs();
    });
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
    this.overviewSubscription?.unsubscribe();
    this.canonicalSubscription?.unsubscribe();
    this.accelerationsSubscription?.unsubscribe();
    this.keyNavigationSubscription?.unsubscribe();
    this.blocksSubscription?.unsubscribe();
    this.cacheBlocksSubscription?.unsubscribe();
    this.networkChangedSubscription?.unsubscribe();
    this.queryParamsSubscription?.unsubscribe();
    this.timeLtrSubscription?.unsubscribe();
    this.childChangeSubscription?.unsubscribe();
    this.auditPrefSubscription?.unsubscribe();
    this.isAuditEnabledSubscription?.unsubscribe();
    this.oobSubscription?.unsubscribe();
    this.priceSubscription?.unsubscribe();
    this.blockGraphProjected.forEach(graph => {
      graph.destroy();
    });
    this.blockGraphActual.forEach(graph => {
      graph.destroy();
    });
  }

  // TODO - Refactor this.fees/this.reward for liquid because it is not
  // used anymore on Bitcoin networks (we use block.extras directly)
  setBlockSubsidy(): void {
    this.blockSubsidy = 0;
  }

  toggleShowDetails(): void {
    if (this.showDetails) {
      this.showDetails = false;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { showDetails: false, view: this.mode },
        queryParamsHandling: 'merge',
        fragment: 'block'
      });
    } else {
      this.showDetails = true;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { showDetails: true, view: this.mode },
        queryParamsHandling: 'merge',
        fragment: 'details'
      });
    }
  }

  hasTaproot(version: number): boolean {
    const versionBit = 2; // Taproot
    return (Number(version) & (1 << versionBit)) === (1 << versionBit);
  }

  displayTaprootStatus(): boolean {
    if (this.stateService.network !== '') {
      return false;
    }
    return this.block && this.block.height > 681393 && (new Date().getTime() / 1000) < 1628640000;
  }

  navigateToPreviousBlock(): void  {
    if (!this.block) {
      return;
    }
    const block = this.latestBlocks.find((b) => b.height === this.nextBlockHeight - 2);
    this.router.navigate([this.relativeUrlPipe.transform('/block/'),
      block ? block.id : this.block.previousblockhash], { state: { data: { block, blockHeight: this.nextBlockHeight - 2 } } });
  }

  navigateToNextBlock(): void  {
    const block = this.latestBlocks.find((b) => b.height === this.nextBlockHeight);
    this.router.navigate([this.relativeUrlPipe.transform('/block/'),
      block ? block.id : this.nextBlockHeight], { state: { data: { block, blockHeight: this.nextBlockHeight } } });
  }

  setNextAndPreviousBlockLink(): void {
    if (this.latestBlock) {
      if (!this.blockHeight){
        this.showPreviousBlocklink = false;
      } else {
        this.showPreviousBlocklink = true;
      }
      if (this.latestBlock.height && this.latestBlock.height === this.blockHeight) {
        this.showNextBlocklink = false;
      } else {
        this.showNextBlocklink = true;
      }
    }
  }

  fetchCanonicalBlock(): void {
    if (!this.block?.stale || !this.block?.height) {
      return;
    }

    this.electrsApiService.getBlockHashFromHeight$(this.block.height)
      .pipe(
        switchMap((hash) => {
          return forkJoin([
            this.apiService.getBlock$(hash).pipe(
              catchError((err) => {
                console.error('Error fetching canonical block:', err);
                this.overviewError = err;
                return of(null);
              })
            ),
            this.apiService.getStrippedBlockTransactions$(hash).pipe(
              catchError((err) => {
                console.error('Error fetching canonical transactions:', err);
                this.overviewError = err;
                return of(null);
              })
            )
          ]);
        }),
        catchError((err) => {
          console.error('Error fetching canonical block hash:', err);
          return of([null, null]);
        })
      )
      .subscribe(([canonicalBlock, canonicalTransactions]) => {
        this.canonicalBlock = canonicalBlock;
        this.canonicalTransactions = canonicalTransactions;

        if (canonicalBlock && canonicalTransactions && this.strippedTransactions) {
          this.staleTransactions = JSON.parse(JSON.stringify(this.strippedTransactions));
          this.setupStaleComparison();
          this.setAuditMode(false);
          this.setupBlockGraphs();
        }
      });
  }

  setupStaleComparison(): void {
    this.staleStats = {
      totalFees: 0,
      totalWeight: 0,
      txCount: 0,
      feeDelta: 0,
      weightDelta: 0,
      txDelta: 0,
    };
    this.canonicalStats = {
      totalFees: 0,
      totalWeight: 0,
      txCount: 0,
      feeDelta: 0,
      weightDelta: 0,
      txDelta: 0,
    };
    const staleTransactions = this.staleTransactions || [];
    const canonicalTransactions = this.canonicalTransactions || [];

    const inStale = {};
    const inCanonical = {};

    for (const tx of staleTransactions) {
      inStale[tx.txid] = tx;
      this.staleStats.totalFees += tx.fee;
      this.staleStats.totalWeight += tx.vsize * 4;
      this.staleStats.txCount++;
    }
    for (const tx of canonicalTransactions) {
      inCanonical[tx.txid] = tx;
      this.canonicalStats.totalFees += tx.fee;
      this.canonicalStats.totalWeight += tx.vsize * 4;
      this.canonicalStats.txCount++;
    }

    for (const tx of staleTransactions) {
      tx.context = 'stale';
      if (inCanonical[tx.txid]) {
        tx.status = 'matched';
        // opportunistically fix missing timestamps
        if (inCanonical[tx.txid].time && (!tx.time || tx.time > inCanonical[tx.txid].time)) {
          tx.time = inCanonical[tx.txid].time;
        }
      } else {
        tx.status = 'unmatched';
      }
    }

    for (const tx of canonicalTransactions) {
      tx.context = 'canonical';
      if (inStale[tx.txid]) {
        tx.status = 'matched';
        // opportunistically fix missing timestamps
        if (inStale[tx.txid].time && (!tx.time || tx.time > inStale[tx.txid].time)) {
          tx.time = inStale[tx.txid].time;
        }
      } else {
        tx.status = 'unmatched';
      }
    }

    this.staleStats.feeDelta = this.staleStats.totalFees > 0 ? (this.staleStats.totalFees - this.canonicalStats.totalFees) / this.staleStats.totalFees : 0;
    this.staleStats.weightDelta = this.staleStats.totalWeight > 0 ? (this.staleStats.totalWeight - this.canonicalStats.totalWeight) / this.staleStats.totalWeight : 0;
    this.staleStats.txDelta = this.staleStats.txCount > 0 ? (this.staleStats.txCount - this.canonicalStats.txCount) / this.staleStats.txCount : 0;

    this.canonicalStats.feeDelta = this.canonicalStats.totalFees > 0 ? (this.canonicalStats.totalFees - this.staleStats.totalFees) / this.canonicalStats.totalFees : 0;
    this.canonicalStats.weightDelta = this.canonicalStats.totalWeight > 0 ? (this.canonicalStats.totalWeight - this.staleStats.totalWeight) / this.canonicalStats.totalWeight : 0;
    this.canonicalStats.txDelta = this.canonicalStats.txCount > 0 ? (this.canonicalStats.txCount - this.staleStats.txCount) / this.canonicalStats.txCount : 0;
  }

  setupBlockAudit(): void {
    const transactions = this.strippedTransactions || [];
    const blockAudit = this.blockAudit;
    const accelerations = this.accelerations || [];

    const acceleratedInBlock = {};
    for (const acc of accelerations) {
      if (acc.pools?.some(pool => pool === this.block?.extras?.pool.id)) {
        acceleratedInBlock[acc.txid] = acc;
      }
    }

    for (const tx of transactions) {
      if (acceleratedInBlock[tx.txid]) {
        tx.acc = true;
        const acceleration = acceleratedInBlock[tx.txid];
        const boostCost = acceleration.boostCost || acceleration.bidBoost;
        const acceleratedFeeRate = Math.max(acceleration.effectiveFee, acceleration.effectiveFee + boostCost) / acceleration.effectiveVsize;
        if (acceleratedFeeRate > tx.rate) {
          tx.rate = acceleratedFeeRate;
        }
      } else {
        tx.acc = false;
      }
    }

    if (transactions && blockAudit) {
      const inTemplate = {};
      const inBlock = {};
      const isUnseen = {};
      const isAdded = {};
      const isPrioritized = {};
      const isDeprioritized = {};
      const isCensored = {};
      const isMissing = {};
      const isSelected = {};
      const isFresh = {};
      const isSigop = {};
      const isRbf = {};
      const isAccelerated = {};
      this.numMissing = 0;
      this.numUnexpected = 0;

      if (blockAudit?.template) {
        // augment with locally calculated *de*prioritized transactions if possible
        const { prioritized, deprioritized } = identifyPrioritizedTransactions(transactions);
        // but if the local calculation produces returns unexpected results, don't use it
        let useLocalDeprioritized = deprioritized.length < (transactions.length * 0.1);
        for (const tx of prioritized) {
          if (!isPrioritized[tx] && !isAccelerated[tx]) {
            useLocalDeprioritized = false;
            break;
          }
        }

        for (const tx of blockAudit.template) {
          inTemplate[tx.txid] = true;
          if (tx.acc) {
            isAccelerated[tx.txid] = true;
          }
        }
        for (const tx of transactions) {
          inBlock[tx.txid] = true;
        }
        for (const txid of blockAudit.unseenTxs || []) {
          isUnseen[txid] = true;
        }
        for (const txid of blockAudit.addedTxs) {
          isAdded[txid] = true;
        }
        for (const txid of blockAudit.prioritizedTxs) {
          isPrioritized[txid] = true;
        }
        if (useLocalDeprioritized) {
          for (const txid of deprioritized || []) {
            isDeprioritized[txid] = true;
          }
        }
        for (const txid of blockAudit.missingTxs) {
          isCensored[txid] = true;
        }
        for (const txid of blockAudit.freshTxs || []) {
          isFresh[txid] = true;
        }
        for (const txid of blockAudit.sigopTxs || []) {
          isSigop[txid] = true;
        }
        for (const txid of blockAudit.fullrbfTxs || []) {
          isRbf[txid] = true;
        }
        for (const txid of blockAudit.acceleratedTxs || []) {
          isAccelerated[txid] = true;
        }
        // set transaction statuses
        for (const tx of blockAudit.template) {
          tx.context = 'projected';
          if (isCensored[tx.txid] && tx.rate >= 1) {
            tx.status = 'censored';
          } else if (inBlock[tx.txid]) {
            tx.status = 'found';
          } else {
            if (isFresh[tx.txid]) {
              if (tx.rate - (tx.fee / tx.vsize) >= 0.1) {
                tx.status = 'freshcpfp';
              } else {
                tx.status = 'fresh';
              }
            } else if (isSigop[tx.txid]) {
              tx.status = 'sigop';
            } else if (isRbf[tx.txid]) {
              tx.status = 'rbf';
            } else {
              tx.status = 'missing';
            }
            isMissing[tx.txid] = true;
            this.numMissing++;
          }
          if (isAccelerated[tx.txid]) {
            tx.status = 'accelerated';
          }
        }
        let anySeen = false;
        for (let index = transactions.length - 1; index >= 0; index--) {
          const tx = transactions[index];
          tx.context = 'actual';
          if (index === 0) {
            tx.status = null;
          } else if (isPrioritized[tx.txid]) {
            if (isAdded[tx.txid] || (blockAudit.version > 0 && isUnseen[tx.txid])) {
              tx.status = 'added_prioritized';
            } else {
              tx.status = 'prioritized';
            }
          } else if (isDeprioritized[tx.txid]) {
            if (isAdded[tx.txid] || (blockAudit.version > 0 && isUnseen[tx.txid])) {
              tx.status = 'added_deprioritized';
            } else {
              tx.status = 'deprioritized';
            }
          } else if (isAdded[tx.txid] && (blockAudit.version === 0 || isUnseen[tx.txid])) {
            tx.status = 'added';
          } else if (inTemplate[tx.txid]) {
            anySeen = true;
            tx.status = 'found';
          } else if (isRbf[tx.txid]) {
            tx.status = 'rbf';
          } else if (isUnseen[tx.txid] && anySeen) {
            tx.status = 'added';
          } else {
            tx.status = 'selected';
            isSelected[tx.txid] = true;
            this.numUnexpected++;
          }
          if (isAccelerated[tx.txid]) {
            tx.status = 'accelerated';
          }
        }
        for (const tx of transactions) {
          inBlock[tx.txid] = true;
        }

        blockAudit.feeDelta = blockAudit.expectedFees > 0 ? (blockAudit.expectedFees - (this.block?.extras.totalFees + this.oobFees)) / blockAudit.expectedFees : 0;
        blockAudit.weightDelta = blockAudit.expectedWeight > 0 ? (blockAudit.expectedWeight - this.block?.weight) / blockAudit.expectedWeight : 0;
        blockAudit.txDelta = blockAudit.template.length > 0 ? (blockAudit.template.length - this.block?.tx_count) / blockAudit.template.length : 0;
        this.blockAudit = blockAudit;
        this.setAuditAvailable(true);
      } else {
        this.setAuditAvailable(false);
      }
    } else {
      this.setAuditAvailable(false);
    }

    this.setupBlockGraphs();
    this.cd.markForCheck();
  }

  setupBlockGraphs(): void {
    if (this.block?.stale && !this.showAudit && this.staleTransactions && this.canonicalTransactions) {
      this.blockGraphProjected.forEach(graph => {
        graph.destroy();
        if (this.isMobile && this.mode === 'actual') {
          graph.setup(this.canonicalTransactions || []);
        } else {
          graph.setup(this.staleTransactions || []);
        }
      });
      this.blockGraphActual.forEach(graph => {
        graph.destroy();
        graph.setup(this.canonicalTransactions || []);
      });
    } else if (this.blockAudit || this.strippedTransactions) {
      this.blockGraphProjected.forEach(graph => {
        graph.destroy();
        if (this.isMobile && this.mode === 'actual') {
          graph.setup(this.blockAudit?.transactions || this.strippedTransactions ||  []);
        } else {
          graph.setup(this.blockAudit?.template || []);
        }
      });
      this.blockGraphActual.forEach(graph => {
        graph.destroy();
        graph.setup(this.blockAudit?.transactions || this.strippedTransactions || []);
      });
    }
  }

  onResize(event: Event): void {
    const target = event.target as Window;
    const isMobile = target.innerWidth <= 767.98;
    const changed = isMobile !== this.isMobile;
    this.isMobile = isMobile;
    this.paginationMaxSize = target.innerWidth < 670 ? 3 : 5;

    if (changed) {
      this.changeMode(this.mode);
    }
  }

  changeMode(mode: 'projected' | 'actual' | 'stale'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { showDetails: this.showDetails, view: mode },
      queryParamsHandling: 'merge',
      fragment: 'overview'
    });
  }

  onTxClick(event: { tx: TransactionStripped, keyModifier: boolean }): void {
    const url = new RelativeUrlPipe(this.stateService).transform(`/tx/${event.tx.txid}`);
    if (!event.keyModifier) {
      this.router.navigate([url]);
    } else {
      window.open(url, '_blank');
    }
  }

  onTxHover(txid: string): void {
    if (txid && txid.length) {
      this.hoverTx = txid;
    } else {
      this.hoverTx = null;
    }
  }

  setAuditAvailable(available: boolean): void {
    this.auditAvailable = available;
    this.showAudit = this.auditAvailable && this.auditModeEnabled && this.auditSupported;
  }

  toggleAuditMode(): void {
    this.stateService.hideAudit.next(this.auditModeEnabled);

    const queryParams = { ...this.currentQueryParams };
    delete queryParams['audit'];

    let newUrl = this.router.url.split('?')[0];
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      newUrl += '?' + queryString;
    }
    this.location.replaceState(newUrl);
  }

  setAuditMode(mode: boolean): void {
    this.auditModeEnabled = mode;
    this.showAudit = this.auditAvailable && this.auditModeEnabled;
    if (this.block?.stale) {
      this.setupBlockGraphs();
    }
  }

  updateAuditAvailableFromBlockHeight(blockHeight: number): void {
    if (!this.isAuditAvailableFromBlockHeight(blockHeight)) {
      this.setAuditAvailable(false);
    }
  }

  isAuditEnabledFromParam(): Observable<boolean> {
    return this.route.queryParams.pipe(
      map(params => {
        this.auditParamEnabled = 'audit' in params;

        return this.auditParamEnabled ? !(params['audit'] === 'false') : true;
      })
    );
  }

  isAuditAvailableFromBlockHeight(blockHeight: number): boolean {
    if (!this.auditSupported) {
      return false;
    }
    switch (this.stateService.network) {
      case 'testnet':
        if (blockHeight < this.stateService.env.TESTNET_BLOCK_AUDIT_START_HEIGHT) {
          return false;
        }
        break;
      case 'signet':
        if (blockHeight < this.stateService.env.SIGNET_BLOCK_AUDIT_START_HEIGHT) {
          return false;
        }
        break;
      default:
        if (blockHeight < this.stateService.env.MAINNET_BLOCK_AUDIT_START_HEIGHT) {
          return false;
        }
    }
    return true;
  }

  getMinBlockFee(block: BlockExtended): number {
    if (block?.extras?.feeRange) {
      // heuristic to check if feeRange is adjusted for effective rates
      if (block.extras.medianFee === block.extras.feeRange[3]) {
        return block.extras.feeRange[1];
      } else {
        return block.extras.feeRange[0];
      }
    }
    return 0;
  }

  getMaxBlockFee(block: BlockExtended): number {
    if (block?.extras?.feeRange) {
      return block.extras.feeRange[block.extras.feeRange.length - 1];
    }
    return 0;
  }

  loadedCacheBlock(block: BlockExtended): void {
    if (this.block && block.height === this.block.height && block.id !== this.block.id) {
      this.block.stale = true;
      this.block.canonical = block.id;
      this.fetchCanonicalBlock();
    }
  }

  updateBlockReward(blockReward: number): void {
    if (this.fees === undefined) {
       this.fees = blockReward;
    }
  }
}
