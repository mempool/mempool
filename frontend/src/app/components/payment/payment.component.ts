import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, Inject } from '@angular/core';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { switchMap, filter, catchError, map, startWith, distinctUntilChanged, tap, retryWhen, mergeMap, delay } from 'rxjs/operators';
import { Transaction } from '@interfaces/electrs.interface';
import { of, merge, Subscription, Observable, combineLatest, BehaviorSubject, Subject, throwError, timer, retry } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { CacheService } from '@app/services/cache.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { getUnacceleratedFeeRate, getTransactionFlags } from '@app/shared/transaction.utils';
import { BlockExtended, MempoolPosition, Acceleration, AccelerationPosition, RbfTree, CpfpInfo, DifficultyAdjustment } from '@interfaces/node-api.interface';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { ZONE_SERVICE } from '@app/injection-tokens';
import { MiningService, MiningStats } from '@app/services/mining.service';
import { ETA, EtaService } from '@app/services/eta.service';
import { getRegex } from '@app/shared/regex.utils';
import { TrackerStage } from '@components/tracker/tracker-bar.component';
import { ApiService } from '@app/services/api.service';
import { ServicesApiServices } from '@app/services/services-api.service';
import { StorageService } from '@app/services/storage.service';
import { TransactionFlags } from '@app/shared/filters.utils';
import { Pool } from '@components/transaction/transaction.component';

const DEFAULT_CONFS = 2;
const MAX_CONFS = 24;

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss'],
  standalone: false,
})
export class PaymentComponent implements OnInit, OnDestroy {
  network = '';
  tx: Transaction;
  txId: string;
  mempoolPosition: MempoolPosition;
  latestBlock: BlockExtended;
  isLoadingTx = true;
  error: any = undefined;
  waitingForTransaction = false;
  isMobile: boolean;
  isValidView = false;
  rbfTransaction: Transaction | null;

  fetchAccelerationSubscription: Subscription;
  fetchAcceleration$ = new Subject<number>();
  isAccelerated$ = new BehaviorSubject<boolean>(false);
  isAcceleration: boolean = false;
  accelerationInfo: Acceleration | null = null;
  accelerationPositions: AccelerationPosition[];
  acceleratorAvailable: boolean = this.stateService.env.ACCELERATOR_BUTTON && this.stateService.network === '';
  accelerateCtaType: 'alert' | 'button' = 'button';
  notAcceleratedOnLoad: boolean = null;
  waitingForAccelerationInfo: boolean = false;
  accelerationCanceled: boolean = false;
  eligibleForAcceleration = false;
  hideAccelerationSummary = false;
  accelerationFlowCompleted = false;
  forceAccelerationSummary = false;
  hasAccelerationDetails = false;
  showAccelerationDetails = false;
  isMempoolSpaceBuild = this.stateService.isMempoolSpaceBuild;
  da$: Observable<DifficultyAdjustment>;

  destination = '';
  confsRequired = DEFAULT_CONFS;
  amount = 0;
  confirmations = 0;
  settled = false;
  replaced = false;
  trackerStage: TrackerStage = 'waiting';

  miningStats: MiningStats;
  ETA$: Observable<ETA | null>;
  txChanged$ = new BehaviorSubject<boolean>(false);

  isCached: boolean;
  rbfInfo: RbfTree;
  fetchRbfHistory$ = new Subject<string>();
  fetchCachedTx$ = new Subject<string>();
  loadingCachedTx: boolean;

  subscription: Subscription;
  networkChangedSubscription: Subscription;
  blocksSubscription: Subscription;
  mempoolPositionSubscription: Subscription;
  txConfirmedSubscription: Subscription;
  txReplacedSubscription: Subscription;
  fetchRbfSubscription: Subscription;
  fetchCachedTxSubscription: Subscription;
  txRbfInfoSubscription: Subscription;
  urlFragmentSubscription: Subscription;
  latestReplacement: string;
  amountMode: string;
  viewAmountMode$: Observable<'btc' | 'sats' | 'fiat'>;

  cpfpInfo: CpfpInfo | null;
  hasCpfp: boolean = false;
  hasEffectiveFeeRate: boolean;
  sigops: number | null;
  adjustedVsize: number | null;


  pool: Pool | null;
  fetchCpfpSubscription: Subscription;
  fetchCpfp$ = new Subject<string>();
  miningSubscription: Subscription;
  fetchMiningInfo$ = new Subject<{ hash: string, height: number, txid: string }>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private apiService: ApiService,
    private servicesApiService: ServicesApiServices,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private audioService: AudioService,
    private cacheService: CacheService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private miningService: MiningService,
    private etaService: EtaService,
    private storageService: StorageService,
    private cd: ChangeDetectorRef,
    @Inject(ZONE_SERVICE) private zoneService: any,
  ) {}

  ngOnInit(): void {
    this.onResize();
    this.viewAmountMode$ = this.stateService.viewAmountMode$.asObservable();

    if (!this.stateService.isLiquid()) {
      this.miningService.getMiningStats('1m').subscribe(stats => {
        this.miningStats = stats;
      });
    }

    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.networkChangedSubscription = this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
      this.acceleratorAvailable = this.stateService.env.ACCELERATOR_BUTTON && this.stateService.network === '';
    });

    this.accelerateCtaType = (this.storageService.getValue('accel-cta-type') as 'alert' | 'button') ?? 'button';
    this.hideAccelerationSummary = this.stateService.isMempoolSpaceBuild ? this.storageService.getValue('hide-accelerator-pref') == 'true' : true;

    this.da$ = this.stateService.difficultyAdjustment$;

    this.fetchAccelerationSubscription = this.fetchAcceleration$.pipe(
      filter(() => this.stateService.env.ACCELERATOR === true),
      tap(() => {
        this.accelerationInfo = null;
        this.setIsAccelerated();
      }),
      switchMap((blockHeight: number) => {
        if (this.stateService.network === '' && this.stateService.env.ACCELERATOR && blockHeight >= 819500) {
          return this.servicesApiService.getAccelerationDataForTxid$(this.txId).pipe(
            switchMap((accelerationData: Acceleration) => {
              if (this.tx.acceleration && !accelerationData) { // If the just mined transaction was accelerated, but services backend did not return any acceleration data, retry
                return throwError(() => 'retry');
              }
              return of(accelerationData);
            }),
            retry({
              count: 3,
              delay: (error) => {
                if (error === 'retry') {
                  return timer(2000);
                }
                return throwError(() => error);
              }
            }),
            catchError(() => {
              return of(null);
            })
          );
        } else {
          return of(null);
        }
      }),
      filter((acceleration: Acceleration) => !!acceleration),
    ).subscribe((acceleration: Acceleration) => {
      if (acceleration.txid === this.txId && (acceleration.status === 'completed' || acceleration.status === 'completed_provisional') && acceleration.pools.includes(acceleration.minedByPoolUniqueId)) {
        const boostCost = acceleration.boostCost || acceleration.bidBoost;
        acceleration.acceleratedFeeRate = Math.max(acceleration.effectiveFee, acceleration.effectiveFee + boostCost) / acceleration.effectiveVsize;
        acceleration.boost = boostCost;
        this.tx.acceleratedAt = acceleration.added;
        this.accelerationInfo = acceleration;
      }
      if (acceleration.txid === this.txId && (acceleration.status === 'failed' || acceleration.status === 'failed_provisional')) {
        this.accelerationCanceled = true;
        this.tx.acceleratedAt = acceleration.added;
        this.accelerationInfo = acceleration;
      }
      this.waitingForAccelerationInfo = false;
      this.setIsAccelerated();
    });

    this.miningSubscription = this.fetchMiningInfo$.pipe(
      filter((target) => target.txid === this.txId && !this.pool),
      tap(() => {
        this.pool = null;
      }),
      switchMap(({ hash, height }) => {
        const foundBlock = this.cacheService.getCachedBlock(height) || null;
        return foundBlock ? of(foundBlock.extras.pool) : this.apiService.getBlock$(hash).pipe(
          map(block => block.extras.pool),
          retry({ count: 3, delay: 2000 }),
          catchError(() => of(null))
        );
      }),
      catchError(() => {
        return of(null);
      })
    ).subscribe(pool => {
      this.pool = pool;
    });

    this.blocksSubscription = this.stateService.blocks$.subscribe((blocks) => {
      this.latestBlock = blocks[0];
      this.updateConfirmations();
      this.cd.markForCheck();
    });

    this.mempoolPositionSubscription = this.stateService.mempoolTxPosition$.subscribe(txPosition => {
      if (txPosition && txPosition.txid === this.txId && txPosition.position) {
        this.mempoolPosition = txPosition.position;
        this.accelerationPositions = txPosition.accelerationPositions;
        this.isAccelerated$.next(!!(this.tx?.acceleration || txPosition.position?.accelerated));
        if (this.tx && !this.tx.status.confirmed) {
          const txFeePerVSize = getUnacceleratedFeeRate(this.tx, this.tx.acceleration || this.mempoolPosition?.accelerated);
          this.stateService.markBlock$.next({
            txid: txPosition.txid,
            txFeePerVSize,
            mempoolPosition: this.mempoolPosition,
            accelerationPositions: this.accelerationPositions,
          });

          if (txPosition.cpfp !== undefined) {
            if (txPosition.position.acceleratedBy) {
              txPosition.cpfp.acceleratedBy = txPosition.position.acceleratedBy;
            }
            if (txPosition.position.acceleratedAt) {
              txPosition.cpfp.acceleratedAt = txPosition.position.acceleratedAt;
            }
            if (txPosition.position.feeDelta) {
              txPosition.cpfp.feeDelta = txPosition.position.feeDelta;
            }
            this.setCpfpInfo(txPosition.cpfp);
          } else if ((this.tx?.acceleration)) {
            if (txPosition.position.acceleratedBy) {
              this.tx.acceleratedBy = txPosition.position.acceleratedBy;
            }
            if (txPosition.position.acceleratedAt) {
              this.tx.acceleratedAt = txPosition.position.acceleratedAt;
            }
            if (txPosition.position.feeDelta) {
              this.tx.feeDelta = txPosition.position.feeDelta;
            }
          }

          if (this.stateService.network === '') {
            if (!this.mempoolPosition.accelerated) {
              if (!this.accelerationFlowCompleted && !this.hideAccelerationSummary && !this.showAccelerationSummary) {
                this.miningService.getMiningStats('1m').subscribe(stats => {
                  this.miningStats = stats;
                });
              }
            }
          }
        }
      } else {
        this.mempoolPosition = null;
        this.accelerationPositions = null;
        this.isAccelerated$.next(false);
      }
    });

    this.fetchRbfSubscription = this.fetchRbfHistory$
    .pipe(
      switchMap((txId) =>
        this.apiService
          .getRbfHistory$(txId)
      ),
      catchError(() => {
        return of(null);
      })
    ).subscribe((rbfResponse) => {
      this.rbfInfo = rbfResponse?.replacements;
      if (this.rbfInfo) {
        // link to the latest pending version
        this.latestReplacement = this.rbfInfo.tx.txid;
        // or traverse the rbf tree to find a confirmed version
        if (this.rbfInfo.mined) {
          const stack = [this.rbfInfo];
          let found = false;
          while (stack.length && !found) {
            const top = stack.pop();
            if (top?.tx.mined) {
              found = true;
              this.latestReplacement = top.tx.txid;
              break;
            } else {
              stack.push(...top.replaces);
            }
          }
        }
      }
    });

    this.fetchCachedTxSubscription = this.fetchCachedTx$
    .pipe(
      tap(() => {
        this.loadingCachedTx = true;
      }),
      switchMap((txId) =>
        this.apiService
          .getRbfCachedTx$(txId)
      ),
      catchError(() => {
        return of(null);
      })
    ).subscribe((tx) => {
      this.loadingCachedTx = false;
      if (!tx) {
        this.seoService.logSoft404();
        return;
      }
      this.seoService.clearSoft404();

      if (!this.tx) {
        this.tx = tx;
        this.checkAccelerationEligibility();
        this.isCached = true;
        if (tx.fee === undefined) {
          this.tx.fee = 0;
        }
        this.tx.feePerVsize = tx.fee / (tx.weight / 4);
        this.isLoadingTx = false;
        this.error = undefined;
        this.waitingForTransaction = false;

        if (!this.isValidDestination(tx)) {
          this.viewFullDetails();
          return;
        }

        this.fetchRbfHistory$.next(this.tx.txid);
        this.txRbfInfoSubscription = this.stateService.txRbfInfo$.subscribe((rbfInfo) => {
          if (this.tx) {
            this.rbfInfo = rbfInfo;
          }
        });
        this.setAmount();
        this.txChanged$.next(true);
      }
    });

    this.subscription = this.zoneService.wrapObservable(this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.txId = params.get('id');
          this.seoService.setTitle($localize`:@@bisq.transaction.browser-title:Transaction: ${this.txId}:INTERPOLATION:`);
          const network = this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ? 'Liquid' : 'Bitcoin';
          const seoDescription = seoDescriptionNetwork(this.stateService.network);
          this.seoService.setDescription($localize`:@@meta.description.bitcoin.transaction:Get real-time status, addresses, fees, script info, and more for ${network}${seoDescription} transaction with txid ${this.txId}.`);
          this.resetTransaction();

          return merge(
            of(true),
            this.stateService.connectionState$.pipe(
              filter((state) => state === 2 && this.tx && !this.tx.status?.confirmed)
            )
          );
        }),
        switchMap(() => {
          let transactionObservable$: Observable<Transaction>;
          const cached = this.cacheService.getTxFromCache(this.txId);
          if (cached && cached.fee !== -1) {
            transactionObservable$ = of(cached);
          } else {
            transactionObservable$ = this.electrsApiService
              .getTransaction$(this.txId)
              .pipe(catchError(this.handleLoadElectrsTransactionError.bind(this)));
          }
          return merge(transactionObservable$, this.stateService.mempoolTransactions$);
        }),
      ))
      .subscribe((tx: Transaction) => {
        if (!tx) {
          this.fetchCachedTx$.next(this.txId);
          this.seoService.logSoft404();
          return;
        }
        this.seoService.clearSoft404();

        this.tx = tx;
        this.checkAccelerationEligibility();
        this.isCached = false;
        if (tx.fee === undefined) {
          this.tx.fee = 0;
        }
        if (this.tx.sigops != null) {
          this.sigops = this.tx.sigops;
          this.adjustedVsize = Math.max(this.tx.weight / 4, this.sigops * 5);
        }
        this.tx.feePerVsize = tx.fee / (tx.weight / 4);
        this.isLoadingTx = false;
        this.error = undefined;
        this.waitingForTransaction = false;

        // The payment view only makes sense for a real output of this transaction.
        // Otherwise fall back to the full transaction page.
        if (!this.isValidDestination(tx)) {
          this.viewFullDetails();
          return;
        }

        if (!tx.status.confirmed) {
          this.trackerStage = 'pending';
        } else {
          this.trackerStage = 'confirmed';
          this.fetchAcceleration$.next(tx.status.block_height);
          this.fetchMiningInfo$.next({ hash: tx.status.block_hash, height: tx.status.block_height, txid: tx.txid });
        }

        this.websocketService.startTrackTransaction(tx.txid);
        this.setAmount();
        this.updateConfirmations();
        this.txChanged$.next(true);
        this.markBlock();

        this.cd.detectChanges();
      },
      (error) => {
        this.error = error;
        this.seoService.logSoft404();
        this.isLoadingTx = false;
      });

    this.txConfirmedSubscription = this.stateService.txConfirmed$.subscribe(([txConfirmed, block]) => {
      if (txConfirmed && this.tx && !this.tx.status.confirmed && txConfirmed === this.tx.txid) {
        if (this.tx.acceleration) {
          this.waitingForAccelerationInfo = true;
        }
        this.tx.status = {
          confirmed: true,
          block_height: block.height,
          block_hash: block.id,
          block_time: block.timestamp,
        };
        this.pool = block.extras.pool;
        this.txChanged$.next(true);
        this.updateConfirmations();
        this.stateService.markBlock$.next({ blockHeight: block.height });
        this.trackerStage = 'confirmed';
        if (this.tx.acceleration || (this.accelerationInfo && ['accelerating', 'completed_provisional', 'completed'].includes(this.accelerationInfo.status))) {
          this.audioService.playSound('wind-chimes-harp-ascend');
        } else {
          this.audioService.playSound('magic');
        }
        this.fetchAcceleration$.next(block.height);
        this.fetchMiningInfo$.next({ hash: block.id, height: block.height, txid: this.tx.txid });
        this.cd.markForCheck();
      }
    });

    this.txReplacedSubscription = this.stateService.txReplaced$.subscribe((rbfTx) => {
      if (!this.tx) {
        this.error = new Error();
        this.loadingCachedTx = false;
        this.waitingForTransaction = false;
      }

      this.rbfTransaction = rbfTx;
      this.replaced = true;
      this.trackerStage = 'replaced';
      if (!this.rbfInfo && rbfTx) {
        this.latestReplacement = rbfTx.txid;
      }
      this.stateService.markBlock$.next({});

      if (rbfTx && !this.tx) {
        this.fetchCachedTx$.next(this.txId);
      }
      this.cd.markForCheck();
    });

    this.ETA$ = combineLatest([
      this.stateService.mempoolTxPosition$.pipe(startWith(null)),
      this.stateService.mempoolBlocks$.pipe(startWith(null)),
      this.stateService.difficultyAdjustment$.pipe(startWith(null)),
      this.isAccelerated$,
      this.txChanged$,
    ]).pipe(
      map(([position, mempoolBlocks, da, isAccelerated]) => {
        if (!this.tx || this.tx.status?.confirmed || !position || position.txid !== this.tx.txid) {
          return null;
        }
        return this.etaService.calculateETA(
          this.network,
          this.tx,
          mempoolBlocks,
          position,
          da,
          this.miningStats,
          isAccelerated,
          this.accelerationPositions,
        );
      }),
      distinctUntilChanged((prev: ETA | null, curr: ETA | null) => {
        return prev === curr || (prev && curr && prev.time === curr.time && prev.blocks === curr.blocks);
      }),
      tap((eta) => {
        if (this.replaced) {
          this.trackerStage = 'replaced';
        } else if (eta?.blocks === 0) {
          this.trackerStage = 'next';
        } else if (eta?.blocks < 3){
          this.trackerStage = 'soon';
        } else {
          this.trackerStage = 'pending';
        }
      })
    );

    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.updateFragmentParams(fragment);
    });

    this.fetchCpfpSubscription = this.fetchCpfp$
          .pipe(
            switchMap((txId) =>
              this.apiService
                .getCpfpinfo$(txId)
                .pipe(retryWhen((errors) => errors.pipe(
                  mergeMap((error) => {
                    if (!this.tx?.status || this.tx.status.confirmed) {
                      return throwError(error);
                    } else {
                      return of(null);
                    }
                  }),
                  delay(2000)
                )),
                catchError(() => {
                  return of(null);
                })
              )
            ),
            catchError(() => {
              return of(null);
            })
          )
          .subscribe((cpfpInfo) => {
            this.setCpfpInfo(cpfpInfo);
          });
  }

  private destinationMatches(address?: string): boolean {
    const isBech32 = /^(bc1|tb1|bcrt1|ex1|lq1|tex1|tlq1)/i.test(this.destination);
    return address === this.destination
      || (isBech32 && address?.toLowerCase() === this.destination.toLowerCase());
  }

  isValidDestination(tx: Transaction): boolean {
    const network = (this.network || 'mainnet') as any;
    if (!this.destination || !getRegex('address', network).test(this.destination)) {
      return false;
    }

    this.isValidView = tx?.vout?.some(vout => this.destinationMatches(vout.scriptpubkey_address));
    return this.isValidView;
  }

  setAmount(): void {
    this.amount = (this.tx?.vout || []).reduce((total, vout) => {
      return this.destinationMatches(vout.scriptpubkey_address) ? total + vout.value : total;
    }, 0);
  }

  updateConfirmations(): void {
    if (this.tx?.status?.confirmed && this.latestBlock?.height != null) {
      this.confirmations = Math.max(1, this.latestBlock.height - this.tx.status.block_height + 1);
    } else {
      this.confirmations = 0;
    }
    this.settled = this.confirmations >= this.confsRequired;
  }

  updateFragmentParams(fragment: string | null): void {
    const params = new URLSearchParams(fragment ?? '');

    if (params.has('confs')) {
      const confsRequired = Number(params.get('confs'));
      if (Number.isInteger(confsRequired) && confsRequired > 0) {
        this.confsRequired = Math.min(confsRequired, MAX_CONFS);
      } else {
        this.confsRequired = DEFAULT_CONFS;
      }
    } else {
      this.confsRequired = DEFAULT_CONFS;
    }
    this.updateConfirmations();

    if (params.has('accelerate')) {
      this.forceAccelerationSummary = true;
    }

    if (params.has('destination')) {
      this.destination = params.get('destination') || '';
      if (this.tx) {
        if (this.isValidDestination(this.tx)) {
          this.setAmount();
        } else {
          this.viewFullDetails();
        }
      }
    }
  }

  markBlock(): void {
    if (this.tx?.status?.confirmed) {
      this.stateService.markBlock$.next({ blockHeight: this.tx.status.block_height });
      this.fetchCpfp$.next(this.tx.txid);
    } else if (this.tx) {
      const txFeePerVSize = getUnacceleratedFeeRate(this.tx, this.tx.acceleration || this.mempoolPosition?.accelerated);
      if (this.tx.cpfpChecked) {
        this.stateService.markBlock$.next({
          txid: this.tx.txid,
          txFeePerVSize,
          mempoolPosition: this.mempoolPosition,
          accelerationPositions: this.accelerationPositions,
        });
        this.setCpfpInfo({
          ancestors: this.tx.ancestors,
          bestDescendant: this.tx.bestDescendant,
        });
        const hasRelatives = !!(this.tx.ancestors?.length || this.tx.bestDescendant || this.tx.descendants);
        this.hasEffectiveFeeRate = hasRelatives || (this.tx.effectiveFeePerVsize && this.tx.effectiveFeePerVsize !== (this.tx.fee / (this.tx.weight / 4)) && this.tx.effectiveFeePerVsize !== (this.tx.fee / Math.ceil(this.tx.weight / 4)));
      } else {
        this.fetchCpfp$.next(this.tx.txid);
      }
    }
  }

  viewFullDetails(): void {
    this.router.navigate([this.relativeUrlPipe.transform('/tx'), this.txId]);
  }

  get confsRequiredArr(): number[] {
    return Array(this.confsRequired);
  }

  handleLoadElectrsTransactionError(error: any): Observable<any> {
    if (error.status === 404 && /^[a-fA-F0-9]{64}$/.test(this.txId)) {
      this.websocketService.startMultiTrackTransaction(this.txId);
      this.waitingForTransaction = true;
    }
    this.error = error;
    this.seoService.logSoft404();
    this.isLoadingTx = false;
    return of(false);
  }

  resetTransaction(): void {
    const fragmentParams = new URLSearchParams(this.route.snapshot.fragment || '');
    this.destination = fragmentParams.get('destination') || '';
    const parsedConfs = Math.min(Math.ceil(parseInt((fragmentParams.get('confs') || DEFAULT_CONFS.toString()), 10)), MAX_CONFS);
    this.confsRequired = (!isNaN(parsedConfs) && parsedConfs >= 1) ? parsedConfs : DEFAULT_CONFS;

    this.error = undefined;
    this.tx = null;
    this.txChanged$.next(true);
    this.waitingForTransaction = false;
    this.isLoadingTx = true;
    this.isValidView = false;
    this.replaced = false;
    this.rbfTransaction = null;
    this.rbfInfo = null;
    this.latestReplacement = '';
    this.isCached = false;
    this.loadingCachedTx = false;
    this.trackerStage = 'waiting';
    this.amount = 0;
    this.confirmations = 0;
    this.settled = false;
    this.mempoolPosition = null;
    this.accelerationPositions = null;
    this.notAcceleratedOnLoad = null;
    this.accelerationInfo = null;
    this.isAcceleration = false;
    this.accelerationCanceled = false;
    this.waitingForAccelerationInfo = false;
    this.accelerationFlowCompleted = false;
    this.showAccelerationDetails = false;
    this.hasAccelerationDetails = false;
    this.pool = null;
    this.isAccelerated$.next(false);
    this.checkAccelerationEligibility();
    this.leaveTransaction();
  }

  leaveTransaction(): void {
    this.websocketService.stopTrackingTransaction();
    this.stateService.markBlock$.next({});
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth < 850;
  }

  ngOnDestroy(): void {
    this.fetchRbfSubscription?.unsubscribe();
    this.fetchCachedTxSubscription?.unsubscribe();
    this.subscription?.unsubscribe();
    this.networkChangedSubscription?.unsubscribe();
    this.blocksSubscription?.unsubscribe();
    this.mempoolPositionSubscription?.unsubscribe();
    this.txConfirmedSubscription?.unsubscribe();
    this.txReplacedSubscription?.unsubscribe();
    this.urlFragmentSubscription?.unsubscribe();
    this.txRbfInfoSubscription?.unsubscribe();
    this.fetchCpfpSubscription?.unsubscribe();
    this.fetchAccelerationSubscription?.unsubscribe();
    this.miningSubscription?.unsubscribe();
    this.leaveTransaction();
  }

  changeMode(mode: 'btc' | 'sats'): boolean {
    this.storageService.setValue('view-amount-mode', mode);
    this.stateService.viewAmountMode$.next(mode);
    this.amountMode = mode;
    return false;
  }

  get showAccelerationSummary(): boolean {
    return (
      this.tx
      && !this.replaced
      && !this.isCached
      && this.acceleratorAvailable
      && this.eligibleForAcceleration
      && (
        (!this.hideAccelerationSummary && !this.accelerationFlowCompleted)
        || this.forceAccelerationSummary
      )
      && this.notAcceleratedOnLoad // avoid briefly showing accelerator checkout on already accelerated txs
    );
  }

  onAccelerateClicked() {
    if (!this.txId) {
      return;
    }

    this.openAccelerator();
    return false;
  }

  setHasAccelerationDetails(hasDetails: boolean): void {
    this.hasAccelerationDetails = hasDetails;
  }

  onAccelerationCompleted(): void {
    this.router.navigate([], { fragment: this.paymentFragment(), queryParamsHandling: 'merge' });
    this.accelerationFlowCompleted = true;
    this.forceAccelerationSummary = false;
  }

  closeAccelerator(): void {
    this.router.navigate([], { fragment: this.paymentFragment(), queryParamsHandling: 'merge' });
    this.hideAccelerationSummary = true;
    this.forceAccelerationSummary = false;
    this.storageService.setValue('hide-accelerator-pref', 'true');
  }

  checkAccelerationEligibility(): void {
    if (this.tx) {
      const txHeight = this.tx.status?.block_height || (this.stateService.latestBlockHeight >= 0 ? this.stateService.latestBlockHeight + 1 : null);
      this.tx.flags = getTransactionFlags(this.tx, null, null, txHeight, this.stateService.network);
    }

    if (this.tx && this.tx.flags) {
      const replaceableInputs = (this.tx.flags & (TransactionFlags.sighash_none | TransactionFlags.sighash_acp)) > 0n;
      const highSigop = (this.tx.sigops * 20) > this.tx.weight;
      this.eligibleForAcceleration = !replaceableInputs && !highSigop;
    } else {
      this.eligibleForAcceleration = false;
    }
  }

  dismissAccelAlert(): void {
    this.storageService.setValue('accel-cta-type', 'button');
    this.accelerateCtaType = 'button';
  }

  openAccelerator(): void {
    this.router.navigate([], { fragment: this.paymentFragment('accelerate'), queryParamsHandling: 'merge' });
    this.accelerationFlowCompleted = false;
    this.hideAccelerationSummary = false;
    this.storageService.setValue('hide-accelerator-pref', 'false');
  }

  private paymentFragment(anchor?: string): string {
    const parts = [`destination=${this.destination}`];
    if (this.confsRequired !== DEFAULT_CONFS) {
      parts.push(`confs=${this.confsRequired}`);
    }
    if (anchor) {
      parts.push(anchor);
    }
    return parts.join('&');
  }

  setIsAccelerated(initialState: boolean = false) {
    this.isAcceleration =
      (
        (this.tx.acceleration && (!this.tx.status.confirmed || this.waitingForAccelerationInfo)) ||
        (this.accelerationInfo && this.pool && this.accelerationInfo.pools.some(pool => (pool === this.pool.id)))
      ) &&
      !this.accelerationCanceled;
    if (this.isAcceleration) {
      if (initialState) {
        this.accelerationFlowCompleted = true;
      }
    }
    if (this.isAcceleration) {
      // this immediately returns cached stats if we fetched them recently
      this.miningService.getMiningStats('1m').subscribe(stats => {
        this.miningStats = stats;
        this.isAccelerated$.next(this.isAcceleration); // hack to trigger recalculation of ETA without adding another source observable
      });
    }
    this.isAccelerated$.next(this.isAcceleration);
  }

  setCpfpInfo(cpfpInfo: CpfpInfo): void {
    if (!cpfpInfo || !this.tx) {
      this.cpfpInfo = null;
      this.hasCpfp = false;
      this.hasEffectiveFeeRate = false;
      return;
    }
    const firstCpfp = this.cpfpInfo == null;
    // merge ancestors/descendants
    const relatives = [...(cpfpInfo.ancestors || []), ...(cpfpInfo.descendants || [])];
    if (cpfpInfo.bestDescendant && !cpfpInfo.descendants?.length) {
      relatives.push(cpfpInfo.bestDescendant);
    }
    const hasRelatives = !!relatives.length;
    if (!cpfpInfo.effectiveFeePerVsize && hasRelatives) {
      const totalWeight =
        this.tx.weight +
        relatives.reduce((prev, val) => prev + val.weight, 0);
      const totalFees =
        this.tx.fee +
        relatives.reduce((prev, val) => prev + val.fee, 0);
      this.tx.effectiveFeePerVsize = totalFees / (totalWeight / 4);
    } else {
      this.tx.effectiveFeePerVsize = cpfpInfo.effectiveFeePerVsize || this.tx.effectiveFeePerVsize || this.tx.feePerVsize || (this.tx.fee / (this.tx.weight / 4));
    }
    if (cpfpInfo.acceleration) {
      this.tx.acceleration = cpfpInfo.acceleration;
      this.tx.acceleratedBy = cpfpInfo.acceleratedBy;
      this.tx.acceleratedAt = cpfpInfo.acceleratedAt;
      this.tx.feeDelta = cpfpInfo.feeDelta;
      this.accelerationCanceled = false;
      this.setIsAccelerated(firstCpfp);
    } else if (cpfpInfo.acceleratedAt) { // Acceleration was cancelled: reset acceleration state
      this.tx.acceleratedBy = cpfpInfo.acceleratedBy;
      this.tx.acceleratedAt = cpfpInfo.acceleratedAt;
      this.tx.feeDelta = cpfpInfo.feeDelta;
      this.accelerationCanceled = true;
      this.setIsAccelerated(firstCpfp);
    }

    if (this.notAcceleratedOnLoad === null) {
      this.notAcceleratedOnLoad = !this.isAcceleration;
    }

    this.txChanged$.next(true);

    this.cpfpInfo = cpfpInfo;
    if (this.cpfpInfo.adjustedVsize && this.cpfpInfo.sigops != null) {
      this.sigops = this.cpfpInfo.sigops;
      this.adjustedVsize = this.cpfpInfo.adjustedVsize;
    }
    this.hasCpfp =!!(this.cpfpInfo && relatives.length);
    this.hasEffectiveFeeRate = hasRelatives || (this.tx.effectiveFeePerVsize && this.tx.effectiveFeePerVsize !== (this.tx.fee / (this.tx.weight / 4)) && this.tx.effectiveFeePerVsize !== (this.tx.fee / Math.ceil(this.tx.weight / 4)));
  }
}
