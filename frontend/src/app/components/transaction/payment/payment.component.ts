import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, Inject } from '@angular/core';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { switchMap, filter, catchError, map, startWith, distinctUntilChanged, tap, retryWhen, mergeMap, delay, repeat, take } from 'rxjs/operators';
import { Transaction, Vout } from '@interfaces/electrs.interface';
import { of, from, merge, Subscription, Observable, combineLatest, BehaviorSubject, Subject, throwError, timer, retry } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { CacheService } from '@app/services/cache.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { getUnacceleratedFeeRate, getTransactionFlags, netAmountForAddress, normalizeAddressCase, voutPaysAddress } from '@app/shared/transaction.utils';
import { isUnconfidentialAddress } from '@app/shared/address-utils';
import { BlockExtended, MempoolPosition, Acceleration, AccelerationPosition, RbfTree, CpfpInfo, DifficultyAdjustment } from '@interfaces/node-api.interface';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { ZONE_SERVICE } from '@app/injection-tokens';
import { MiningService, MiningStats } from '@app/services/mining.service';
import { ETA, EtaService } from '@app/services/eta.service';
import { TrackerStage } from '@components/tracker/tracker-bar.component';
import { ApiService } from '@app/services/api.service';
import { ServicesApiServices } from '@app/services/services-api.service';
import { StorageService } from '@app/services/storage.service';
import { TransactionFlags } from '@app/shared/filters.utils';
import { Pool } from '@components/transaction/transaction.component';
import { LiquidUnblinding } from '@components/transaction/liquid-ublinding';
import { AssetsService } from '@app/services/assets.service';
import { PriceService } from '@app/services/price.service';
import { PartnerCodeService } from '@app/services/partner-code.service';
import { environment } from '@environments/environment';

const DEFAULT_CONFS = 6;
const LIQUID_DEFAULT_CONFS = 2;
const MAX_CONFS = 1024;

export type PaymentKind = 'received' | 'sent' | 'self-transfer';

type AssetMinimal = [string | null, string, string, number];

interface AssetDisplay {
  ticker: string;
  name: string;
  divisor: number;
  digitsInfo: string;
}

@Component({
  selector: 'app-payment',
  templateUrl: './payment.component.html',
  styleUrls: ['./payment.component.scss'],
  standalone: false,
})
export class PaymentComponent implements OnInit, OnDestroy {
  isLiquid = this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet';

  network = '';
  tx: Transaction;
  txId: string;
  mempoolPosition: MempoolPosition;
  latestBlock: BlockExtended;
  isLoadingTx = true;
  error: any = undefined;
  waitingForTransaction = false;
  isMobile: boolean;

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
  hasBlindingData = false;
  currencyChangeSubscription: Subscription;
  assetsSubscription: Subscription;
  liquidUnblinding = new LiquidUnblinding();
  errorUnblinded: Error | undefined = undefined;
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
  asset: string | null = null;
  assetsMinimal: Record<string, AssetMinimal> = {};
  assetDisplay: AssetDisplay | null = null;
  confsRequired = DEFAULT_CONFS;
  amount = 0;
  paymentKind: PaymentKind = 'received';
  confirmations = 0;
  transactionTime = -1;
  settled = false;
  replaced = false;
  trackerStage: TrackerStage = 'waiting';

  miningStats: MiningStats;
  ETA$: Observable<ETA | null>;
  txChanged$ = new BehaviorSubject<boolean>(false);

  isCached: boolean;
  rbfInfo: RbfTree;
  rbfChecked = false;
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
  partnerCodeSubscription: Subscription;
  partnerCode: string | undefined;
  transactionTimesSubscription: Subscription;
  transactionTimes$ = new Subject<string>();
  latestReplacement: string;
  viewAmountMode$: Observable<'btc' | 'sats' | 'fiat'>;

  cpfpInfo: CpfpInfo | null;

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
    private assetsService: AssetsService,
    private priceService: PriceService,
    private partnerCodeService: PartnerCodeService,
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
      this.isLiquid = network === 'liquid' || network === 'liquidtestnet';
      this.acceleratorAvailable = this.stateService.env.ACCELERATOR_BUTTON && this.stateService.network === '';
    });

    this.accelerateCtaType = (this.storageService.getValue('accel-cta-type') as 'alert' | 'button') ?? 'button';
    this.hideAccelerationSummary = this.stateService.isMempoolSpaceBuild ? this.storageService.getValue('hide-accelerator-pref') == 'true' : true;

    this.da$ = this.stateService.difficultyAdjustment$;

    if (this.isLiquid) {
      this.assetsSubscription = this.assetsService.getAssetsMinimalJson$.pipe(
        catchError(() => of({})),
      ).subscribe((assetsMinimal: Record<string, AssetMinimal>) => {
        this.assetsMinimal = assetsMinimal;
        this.updateAssetDisplay();
        this.cd.markForCheck();
      });
    }

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
      filter(() => !this.isLiquid),
      filter((target) => target.txid === this.txId && !this.pool),
      tap(() => {
        this.pool = null;
      }),
      switchMap(({ hash, height }) => {
        const foundBlock = this.cacheService.getCachedBlock(height) || null;
        return foundBlock ? of(foundBlock.extras?.pool) : this.apiService.getBlock$(hash).pipe(
          map(block => block.extras?.pool),
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

          if (this.stateService.network === '' &&
              !this.mempoolPosition.accelerated &&
              !this.accelerationFlowCompleted &&
              !this.hideAccelerationSummary &&
              !this.showAccelerationSummary) {
            this.miningService.getMiningStats('1m').subscribe(stats => {
              this.miningStats = stats;
            });
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
          .pipe(
            retry({ count: 2, delay: 2000 }),
            catchError(() => {
              return of(null);
            }),
            map((rbfResponse) => ({ txId, rbfResponse })),
          )
      ),
    ).subscribe(({ txId, rbfResponse }) => {
      if (txId !== this.tx?.txid || !rbfResponse) {
        return;
      }
      this.rbfChecked = true;
      this.setRbfInfo(rbfResponse.replacements);
      this.cd.markForCheck();
    });

    this.txRbfInfoSubscription = this.stateService.txRbfInfo$.subscribe((rbfInfo) => {
      if (this.tx) {
        this.setRbfInfo(rbfInfo);
        this.cd.markForCheck();
      }
    });

    this.partnerCodeSubscription = this.partnerCodeService.partnerCode$.subscribe((partnerCode) => {
      this.partnerCode = partnerCode;
    });

    this.transactionTimesSubscription = this.transactionTimes$.pipe(
      switchMap((txid) => this.apiService.getTransactionTimes$([txid]).pipe(
        retry({ count: 2, delay: 2000 }),
        // Try again until we either get a valid response, or the transaction is confirmed
        repeat({ delay: 2000 }),
        filter((transactionTimes) => transactionTimes?.[0] > 0 || this.tx?.txid !== txid || this.tx.status?.confirmed),
        take(1),
        map((transactionTimes) => this.tx?.txid === txid ? transactionTimes?.[0] : 0),
        catchError(() => {
          return of(0);
        })
      )),
    ).subscribe((transactionTime) => {
      if (transactionTime > 0) {
        this.transactionTime = transactionTime;
        this.cd.markForCheck();
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
          .pipe(
            catchError(() => {
              return of(null);
            }),
            map(tx => ({ txId, tx })),
          )
      ),
    ).subscribe(({ txId, tx }) => {
      if (txId !== this.txId) {
        return;
      }
      this.loadingCachedTx = false;
      if (!tx) {
        this.seoService.logSoft404();
        if (!this.replaced && !this.tx && !this.waitingForTransaction) {
          this.fallbackToTxView();
        }
        return;
      }
      this.seoService.clearSoft404();

      if (!this.tx) {
        this.setTransaction(tx, true);

        if (!this.isValidDestination(tx)) {
          this.fallbackToTxView();
          return;
        }

        this.fetchRbfHistory$.next(this.tx.txid);
        this.setAmount();
        this.txChanged$.next(true);
      }
    });

    this.fetchCpfpSubscription = this.fetchCpfp$.pipe(
      switchMap((txId) =>
        this.apiService.getCpfpinfo$(txId).pipe(
          retryWhen((errors) => errors.pipe(
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
    ).subscribe((cpfpInfo) => {
      this.setCpfpInfo(cpfpInfo);
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
          return merge(
            transactionObservable$,
            this.stateService.mempoolTransactions$.pipe(
              filter((tx) => tx.txid?.toLowerCase() === this.txId?.toLowerCase())
            )
          );
        }),
        switchMap((tx) => {
          if (this.isLiquid) {
            return from(this.liquidUnblinding.checkUnblindedTx(tx)).pipe(
              catchError((error) => {
                this.errorUnblinded = error;
                return of(tx);
              })
            );
          }
          return of(tx);
        }),
      ))
      .subscribe((tx: Transaction) => {
        if (!tx) {
          this.fetchCachedTx$.next(this.txId);
          this.seoService.logSoft404();
          return;
        }
        this.seoService.clearSoft404();

        this.setTransaction(tx, false);

        if (!this.isValidDestination(tx)) {
          this.fallbackToTxView();
          return;
        }

        if (!tx.status.confirmed) {
          this.trackerStage = 'pending';
          if (tx.firstSeen) {
            this.transactionTime = tx.firstSeen;
          } else {
            this.transactionTimes$.next(tx.txid);
          }
        } else {
          this.trackerStage = 'confirmed';
          this.replaced = false;
          this.fetchAcceleration$.next(tx.status.block_height);
          this.fetchMiningInfo$.next({ hash: tx.status.block_hash, height: tx.status.block_height, txid: tx.txid });
          this.transactionTime = 0;
        }

        this.websocketService.startTrackTransaction(tx.txid);
        this.fetchRbfHistory$.next(tx.txid);
        this.currencyChangeSubscription?.unsubscribe();
        this.currencyChangeSubscription = this.stateService.fiatCurrency$.pipe(
          switchMap((currency) => {
            return tx.status.block_time ? this.priceService.getBlockPrice$(tx.status.block_time, true, currency).pipe(
              tap((price) => tx['price'] = price),
            ) : of(undefined);
          })
        ).subscribe();
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
        this.pool = block.extras?.pool;
        this.replaced = false;
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

      this.replaced = true;
      this.trackerStage = 'replaced';
      if (rbfTx && !this.rbfInfo) {
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
        } else if (this.tx?.status?.confirmed) {
          this.trackerStage = 'confirmed';
        } else if (eta?.blocks === 0) {
          this.trackerStage = 'next';
        } else if (eta?.blocks != null && eta?.blocks < 3) {
          this.trackerStage = 'soon';
        } else {
          this.trackerStage = 'pending';
        }
      })
    );

    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.consumePartnerCode(fragment);
      this.updateFragmentParams(fragment);
    });
  }

  private setRbfInfo(rbfInfo: RbfTree | undefined): void {
    this.rbfInfo = rbfInfo;
    if (!rbfInfo) {
      return;
    }
    // link to the latest pending version
    this.latestReplacement = rbfInfo.tx.txid;
    // or traverse the rbf tree to find a confirmed version
    if (rbfInfo.mined) {
      const stack = [rbfInfo];
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
    if (!this.tx?.status?.confirmed && this.latestReplacement && this.latestReplacement !== this.txId) {
      this.replaced = true;
      this.trackerStage = 'replaced';
    }
  }

  private consumePartnerCode(fragment: string | null): void {
    const params = new URLSearchParams(fragment ?? '');
    if (!params.has('partnerCode')) {
      return;
    }
    const partnerCode = params.get('partnerCode');
    if (partnerCode) {
      this.partnerCodeService.setFragmentPartnerCode(partnerCode);
    }
    params.delete('partnerCode');
    this.router.navigate([], {
      relativeTo: this.route,
      fragment: this.formatFragment(params) || undefined,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private formatFragment(params: URLSearchParams): string {
    return Array.from(params.entries()).map(([key, value]) => value ? `${key}=${value}` : key).join('&');
  }

  private setTransaction(tx: Transaction, isCached: boolean): void {
    this.tx = tx;
    this.checkAccelerationEligibility();
    this.isCached = isCached;
    if (tx.fee === undefined) {
      this.tx.fee = 0;
    }
    this.tx.feePerVsize = tx.fee / (tx.weight / 4);
    this.isLoadingTx = false;
    this.error = undefined;
    this.waitingForTransaction = false;
  }

  private destinationMatches(vout?: Vout): boolean {
    return voutPaysAddress(vout, this.destination);
  }

  private destinationIsAddress(): boolean {
    return isUnconfidentialAddress(this.destination, this.network);
  }

  private destinationInOutputs(tx: Transaction): boolean {
    return !!tx?.vout?.some(vout => this.destinationMatches(vout));
  }

  private destinationInInputs(tx: Transaction): boolean {
    return !!tx?.vin?.some(vin => this.destinationMatches(vin.prevout));
  }

  private destinationValueUnknown(tx: Transaction): boolean {
    return !!tx?.vout?.some(vout => this.destinationMatches(vout) && vout.value == null)
      || !!tx?.vin?.some(vin => this.destinationMatches(vin.prevout) && vin.prevout.value == null);
  }

  private destinationAssets(tx: Transaction): string[] {
    const assets = new Set<string>();
    for (const vout of tx?.vout || []) {
      if (vout.asset && this.destinationMatches(vout)) {
        assets.add(vout.asset);
      }
    }
    for (const vin of tx?.vin || []) {
      if (vin.prevout?.asset && this.destinationMatches(vin.prevout)) {
        assets.add(vin.prevout.asset);
      }
    }
    return Array.from(assets);
  }

  isValidDestination(tx: Transaction): boolean {
    if (!this.destinationIsAddress() || this.destinationAssets(tx).length > 1) {
      return false;
    }
    if (this.destinationValueUnknown(tx)) {
      return !(this.destinationInInputs(tx) && this.destinationInOutputs(tx));
    }
    return netAmountForAddress(tx, this.destination) !== 0;
  }

  setAmount(): void {
    this.amount = this.destinationValueUnknown(this.tx) ? null : netAmountForAddress(this.tx, this.destination);
    this.paymentKind = this.getPaymentKind();
    this.asset = this.destinationAssets(this.tx)[0] ?? null;
    this.updateAssetDisplay();
  }

  private updateAssetDisplay(): void {
    const assetMinimal = this.asset ? this.assetsMinimal[this.asset] : undefined;
    if (!assetMinimal) {
      this.assetDisplay = null;
      return;
    }
    const [, ticker, name, precision] = assetMinimal;
    this.assetDisplay = {
      ticker,
      name,
      divisor: Math.pow(10, precision),
      digitsInfo: `1.${precision}-${precision}`,
    };
  }

  private getPaymentKind(): PaymentKind {
    if (!this.destinationInInputs(this.tx)) {
      return 'received';
    }
    const spendsOnlyDestination = this.tx.vin.every(vin => this.destinationMatches(vin.prevout));
    const paysOnlyDestination = !!this.tx.vout?.length && this.tx.vout.every(vout => vout.scriptpubkey_type === 'fee' || this.destinationMatches(vout));
    if (spendsOnlyDestination && paysOnlyDestination) {
      return 'self-transfer';
    }
    return this.amount > 0 ? 'received' : 'sent';
  }

  updateConfirmations(): void {
    if (!this.tx?.status?.confirmed) {
      this.confirmations = 0;
    } else if (this.latestBlock?.height != null) {
      this.confirmations = Math.max(1, this.latestBlock.height - this.tx.status.block_height + 1);
    } else {
      this.confirmations = 1;
    }
    this.settled = this.confirmations >= this.confsRequired;
  }

  updateFragmentParams(fragment: string | null): void {
    const params = new URLSearchParams(fragment ?? '');

    if (params.has('destination')) {
      this.destination = normalizeAddressCase(params.get('destination') || '');
    }

    this.hasBlindingData = params.has('blinded');

    if (params.has('confs')) {
      const confsRequired = Number(params.get('confs'));
      if (Number.isInteger(confsRequired) && confsRequired > 0) {
        this.confsRequired = Math.min(confsRequired, MAX_CONFS);
      } else {
        this.confsRequired = this.defaultConfs;
      }
    } else {
      this.confsRequired = this.defaultConfs;
    }

    this.forceAccelerationSummary = params.has('accelerate');

    if (this.tx && this.route.snapshot.paramMap.get('id') === this.txId) {
      this.applyDestination();
    }
  }

  private applyDestination(): void {
    if (!this.isValidDestination(this.tx)) {
      this.fallbackToTxView();
      return;
    }

    this.setAmount();
    this.updateConfirmations();
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
      } else {
        this.fetchCpfp$.next(this.tx.txid);
      }
    }
  }

  viewFullDetails(): void {
    const baseRoute = [this.relativeUrlPipe.transform('/tx'), this.txId];
    this.router.navigate(baseRoute, {
      queryParams: {
        mode: 'details',
      },
      fragment: this.formatFragment(this.detailsFragment()) || undefined,
    });
  }

  fallbackToTxView(): void {
    const baseRoute = [this.relativeUrlPipe.transform('/tx'), this.txId];
    const fragment = this.detailsFragment();
    if (this.tx && this.destinationIsAddress() && !this.destinationInOutputs(this.tx)) {
      fragment.set('destinationAlert', this.destination);
    }
    this.router.navigate(baseRoute, {
      queryParams: {
        mode: 'details',
      },
      fragment: this.formatFragment(fragment) || undefined,
      replaceUrl: true,
    });
  }

  private detailsFragment(): URLSearchParams {
    const params = new URLSearchParams(this.route.snapshot.fragment ?? '');
    params.delete('destination');
    params.delete('confs');
    params.delete('accelerate');
    return params;
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
    this.tx = null;
    this.updateFragmentParams(this.route.snapshot.fragment);

    this.error = undefined;
    this.txChanged$.next(true);
    this.waitingForTransaction = false;
    this.isLoadingTx = true;
    this.replaced = false;
    this.rbfInfo = null;
    this.rbfChecked = false;
    this.latestReplacement = '';
    this.isCached = false;
    this.loadingCachedTx = false;
    this.trackerStage = 'waiting';
    this.amount = 0;
    this.asset = null;
    this.assetDisplay = null;
    this.errorUnblinded = undefined;
    this.paymentKind = 'received';
    this.confirmations = 0;
    this.transactionTime = -1;
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
    this.currencyChangeSubscription?.unsubscribe();
    this.assetsSubscription?.unsubscribe();
    this.txRbfInfoSubscription?.unsubscribe();
    this.partnerCodeSubscription?.unsubscribe();
    this.transactionTimesSubscription?.unsubscribe();
    this.fetchCpfpSubscription?.unsubscribe();
    this.fetchAccelerationSubscription?.unsubscribe();
    this.miningSubscription?.unsubscribe();
    this.leaveTransaction();
  }

  changeMode(mode: 'btc' | 'sats'): boolean {
    this.storageService.setValue('view-amount-mode', mode);
    this.stateService.viewAmountMode$.next(mode);
    return false;
  }

  get removed(): boolean {
    return !!this.tx && this.isCached && this.rbfChecked && !this.replaced && !this.tx.status?.confirmed;
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

  get showAccelerateButton(): boolean {
    return !this.tx?.acceleration && this.acceleratorAvailable && this.accelerateCtaType === 'button' && !this.showAccelerationSummary && this.notAcceleratedOnLoad;
  }

  private get defaultConfs(): number {
    return this.isLiquid ? LIQUID_DEFAULT_CONFS : DEFAULT_CONFS;
  }

  onAccelerateClicked(): boolean {
    if (this.txId) {
      this.openAccelerator();
    }
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

  openAccelerator(): void {
    this.router.navigate([], { fragment: this.paymentFragment('accelerate'), queryParamsHandling: 'merge' });
    this.accelerationFlowCompleted = false;
    this.hideAccelerationSummary = false;
    this.storageService.setValue('hide-accelerator-pref', 'false');
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

  paymentFragment(anchor?: string): string {
    const params = new URLSearchParams(this.route.snapshot.fragment);

    for (const [key, value] of Array.from(params.entries())) {
      if (value === '') {
        params.delete(key);
      }
    }
    if (anchor) {
      params.set(anchor, '');
    }

    return this.formatFragment(params);
  }

  setIsAccelerated(initialState: boolean = false): void {
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
      return;
    }
    const firstCpfp = this.cpfpInfo == null;
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
  }
}
