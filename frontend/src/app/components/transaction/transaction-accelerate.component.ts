import { Component, HostListener, Inject, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { of, merge, Subscription, Observable, Subject, throwError, combineLatest, BehaviorSubject } from 'rxjs';
import { catchError, delay, distinctUntilChanged, filter, map, mergeMap, retryWhen, startWith, switchMap, tap } from 'rxjs/operators';

import { ZONE_SERVICE } from '@app/injection-tokens';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { TransactionFlags } from '@app/shared/filters.utils';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { getTransactionFlags, getUnacceleratedFeeRate } from '@app/shared/transaction.utils';
import { ApiService } from '@app/services/api.service';
import { CacheService } from '@app/services/cache.service';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { EnterpriseService } from '@app/services/enterprise.service';
import { ETA, EtaService } from '@app/services/eta.service';
import { MiningService, MiningStats } from '@app/services/mining.service';
import { PartnerCodeService } from '@app/services/partner-code.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { Transaction } from '@interfaces/electrs.interface';
import { AccelerationPosition, CpfpInfo, DifficultyAdjustment, MempoolPosition } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-transaction-accelerate',
  templateUrl: './transaction-accelerate.component.html',
  styleUrls: ['./transaction.component.scss'],
  standalone: false,
})
export class TransactionAccelerateComponent implements OnInit, OnDestroy {
  network = '';
  tx: Transaction;
  txId: string;
  txInBlockIndex: number;
  mempoolPosition: MempoolPosition;
  accelerationPositions: AccelerationPosition[];
  isLoadingTx = true;
  loadingCachedTx = false;
  waitingForTransaction = false;
  error: any = undefined;
  isCached = false;
  replaced = false;
  miningStats: MiningStats;
  da$: Observable<DifficultyAdjustment>;
  ETA$: Observable<ETA | null>;
  eligibleForAcceleration = false;
  acceleratorAvailable: boolean = this.stateService.env.ACCELERATOR_BUTTON && this.stateService.network === '';
  isAcceleration = false;
  notAcceleratedOnLoad: boolean = null;
  showAccelerationDetails = false;
  hasAccelerationDetails = false;
  isMempoolSpaceBuild = this.stateService.isMempoolSpaceBuild;
  isMobile: boolean;
  partnerCode: string | undefined;

  private subscription: Subscription;
  private fetchCpfpSubscription: Subscription;
  private fetchCachedTxSubscription: Subscription;
  private mempoolPositionSubscription: Subscription;
  private networkChangedSubscription: Subscription;
  private txConfirmedSubscription: Subscription;
  private txReplacedSubscription: Subscription;
  private urlFragmentSubscription: Subscription;
  private partnerCodeSubscription: Subscription;
  private fetchCpfp$ = new Subject<string>();
  private fetchCachedTx$ = new Subject<string>();
  private txChanged$ = new BehaviorSubject<boolean>(false);
  private isAccelerated$ = new BehaviorSubject<boolean>(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private cacheService: CacheService,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private seoService: SeoService,
    private enterpriseService: EnterpriseService,
    private partnerCodeService: PartnerCodeService,
    private miningService: MiningService,
    private etaService: EtaService,
    @Inject(ZONE_SERVICE) private zoneService: any,
  ) {}

  ngOnInit(): void {
    this.onResize();
    this.setupPartnerCode();
    this.enterpriseService.page();
    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.consumePartnerCodeFragment(fragment);
    });

    if (!this.stateService.isLiquid()) {
      this.miningService.getMiningStats('1m').subscribe(stats => {
        this.miningStats = stats;
        this.isAccelerated$.next(this.isAcceleration);
      });
    }

    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.networkChangedSubscription = this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
      this.acceleratorAvailable = this.stateService.env.ACCELERATOR_BUTTON && this.stateService.network === '';
    });

    this.da$ = this.stateService.difficultyAdjustment$.pipe(
      tap(() => {
        this.txChanged$.next(!!this.tx);
      })
    );

    this.fetchCpfpSubscription = this.fetchCpfp$
      .pipe(
        switchMap((txId) =>
          this.apiService
            .getCpfpinfo$(txId)
            .pipe(retryWhen((errors) => errors.pipe(
              mergeMap((error) => {
                if (!this.tx?.status || this.tx.status.confirmed) {
                  return throwError(() => error);
                }
                return of(null);
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

    this.fetchCachedTxSubscription = this.fetchCachedTx$
      .pipe(
        tap(() => {
          this.loadingCachedTx = true;
        }),
        switchMap((txId) =>
          this.apiService
            .getRbfCachedTx$(txId)
            .pipe(catchError(() => {
              return of(null);
            }))
        )
      )
      .subscribe((tx) => {
        this.loadingCachedTx = false;
        if (!tx) {
          this.seoService.logSoft404();
          return;
        }
        this.seoService.clearSoft404();
        this.setTransaction(tx, true);
      });

    this.mempoolPositionSubscription = this.stateService.mempoolTxPosition$.subscribe(txPosition => {
      if (txPosition && txPosition.txid === this.txId && txPosition.position) {
        this.mempoolPosition = txPosition.position;
        this.accelerationPositions = txPosition.accelerationPositions;
        if (this.tx && !this.tx.status?.confirmed) {
          const txFeePerVSize = getUnacceleratedFeeRate(this.tx, this.tx.acceleration || this.mempoolPosition?.accelerated);
          this.stateService.markBlock$.next({
            txid: txPosition.txid,
            txFeePerVSize,
            mempoolPosition: this.mempoolPosition,
            accelerationPositions: this.accelerationPositions,
          });
          this.txInBlockIndex = this.mempoolPosition.block;

          if (txPosition.cpfp !== undefined) {
            this.setCpfpInfo(txPosition.cpfp);
          }

          if (txPosition.position.accelerated) {
            this.tx.acceleration = true;
            this.tx.acceleratedBy = txPosition.position.acceleratedBy;
            this.tx.acceleratedAt = txPosition.position.acceleratedAt;
            this.setIsAccelerated();
          } else {
            this.markAccelerationStateLoaded();
          }
        }
      } else {
        this.mempoolPosition = null;
        this.accelerationPositions = null;
      }
    });

    this.subscription = this.zoneService.wrapObservable(this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          const urlMatch = (params.get('id') || '').split(':');
          this.txId = urlMatch.length === 2 && urlMatch[1].length === 64 ? urlMatch[1] : urlMatch[0];
          this.seoService.setTitle(
            $localize`:@@transaction.accelerate.title:Accelerate Transaction: ${this.txId}:INTERPOLATION:`
          );
          this.seoService.setDescription($localize`:@@meta.description.bitcoin.transaction.accelerate:Accelerate Bitcoin transaction with txid ${this.txId} using Mempool Accelerator.`);
          this.resetTransaction();
          return merge(
            of(true),
            this.stateService.connectionState$.pipe(
              filter(
                (state) => state === 2 && this.tx && !this.tx.status?.confirmed
              )
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
              .pipe(
                catchError(this.handleLoadElectrsTransactionError.bind(this))
              );
          }
          return merge(
            transactionObservable$,
            this.stateService.mempoolTransactions$
          );
        }),
      ))
      .subscribe((tx: Transaction) => {
          if (!tx) {
            this.fetchCachedTx$.next(this.txId);
            this.seoService.logSoft404();
            return;
          }
          if (tx.txid && tx.txid !== this.txId) {
            return;
          }
          this.seoService.clearSoft404();
          this.setTransaction(tx, false);
        },
        (error) => {
          this.error = error;
          this.seoService.logSoft404();
          this.isLoadingTx = false;
        }
      );

    this.txConfirmedSubscription = this.stateService.txConfirmed$.subscribe(([txConfirmed, block]) => {
      if (txConfirmed && this.tx && !this.tx.status?.confirmed && txConfirmed === this.tx.txid) {
        this.tx.status = {
          confirmed: true,
          block_height: block.height,
          block_hash: block.id,
          block_time: block.timestamp,
        };
        this.txChanged$.next(true);
        this.stateService.markBlock$.next({ blockHeight: block.height });
      }
    });

    this.txReplacedSubscription = this.stateService.txReplaced$.subscribe((rbfTransaction) => {
      if (!this.tx) {
        this.error = new Error();
        this.loadingCachedTx = false;
        this.waitingForTransaction = false;
      }
      this.replaced = true;
      this.stateService.markBlock$.next({});

      if (rbfTransaction && !this.tx) {
        this.fetchCachedTx$.next(this.txId);
      }
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
      })
    );
  }

  private setTransaction(tx: Transaction, cached: boolean): void {
    this.tx = tx;
    this.isCached = cached;
    if (tx.fee === undefined) {
      this.tx.fee = 0;
    }
    this.tx.feePerVsize = tx.fee / (tx.weight / 4);
    this.checkAccelerationEligibility();
    this.txChanged$.next(true);
    this.isLoadingTx = false;
    this.error = undefined;
    this.loadingCachedTx = false;
    this.waitingForTransaction = false;

    if (!tx.status?.confirmed) {
      this.websocketService.startTrackTransaction(tx.txid);
      if (tx.cpfpChecked) {
        this.setCpfpInfo({
          ancestors: tx.ancestors,
          bestDescendant: tx.bestDescendant,
        });
      } else {
        this.fetchCpfp$.next(this.tx.txid);
      }
    } else {
      this.notAcceleratedOnLoad = false;
      this.stateService.markBlock$.next({
        blockHeight: tx.status.block_height,
      });
    }
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

  setCpfpInfo(cpfpInfo: CpfpInfo | null): void {
    if (!this.tx) {
      return;
    }
    if (!cpfpInfo) {
      this.markAccelerationStateLoaded();
      return;
    }

    const relatives = [...(cpfpInfo.ancestors || []), ...(cpfpInfo.descendants || [])];
    if (cpfpInfo.bestDescendant && !cpfpInfo.descendants?.length) {
      relatives.push(cpfpInfo.bestDescendant);
    }
    if (!cpfpInfo.effectiveFeePerVsize && relatives.length) {
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
      this.setIsAccelerated();
    } else {
      this.markAccelerationStateLoaded();
    }
    this.txChanged$.next(true);
  }

  private setIsAccelerated(): void {
    this.isAcceleration = !!(this.tx?.acceleration || this.mempoolPosition?.accelerated);
    if (this.isAcceleration) {
      this.miningService.getMiningStats('1m').subscribe(stats => {
        this.miningStats = stats;
        this.isAccelerated$.next(this.isAcceleration);
      });
    }
    this.isAccelerated$.next(this.isAcceleration);
    this.markAccelerationStateLoaded();
  }

  private markAccelerationStateLoaded(): void {
    if (this.notAcceleratedOnLoad === null) {
      this.notAcceleratedOnLoad = !this.isAcceleration;
    }
  }

  checkAccelerationEligibility(): void {
    if (this.tx) {
      const txHeight = this.tx.status?.block_height || (this.stateService.latestBlockHeight >= 0 ? this.stateService.latestBlockHeight + 1 : null);
      this.tx.flags = getTransactionFlags(this.tx, null, null, txHeight, this.stateService.network);
      const replaceableInputs = (this.tx.flags & (TransactionFlags.sighash_none | TransactionFlags.sighash_acp)) > 0n;
      const highSigop = (this.tx.sigops * 20) > this.tx.weight;
      this.eligibleForAcceleration = !replaceableInputs && !highSigop;
    } else {
      this.eligibleForAcceleration = false;
    }
  }

  onAcceleratorUnavailable(): void {
    this.eligibleForAcceleration = false;
    this.notAcceleratedOnLoad = false;
  }

  onAccelerationCompleted(): void {
    this.router.navigate([this.relativeUrlPipe.transform('/tx'), this.txId], { queryParamsHandling: 'merge' });
  }

  setHasAccelerationDetails(hasDetails: boolean): void {
    this.hasAccelerationDetails = hasDetails;
  }

  get showAccelerationSummary(): boolean {
    return (
      this.tx
      && !this.tx.status?.confirmed
      && !this.replaced
      && !this.isCached
      && this.acceleratorAvailable
      && this.eligibleForAcceleration
      && this.notAcceleratedOnLoad
    );
  }

  get acceleratorCheckoutLoading(): boolean {
    if (this.error || this.showAccelerationSummary) {
      return false;
    }

    return (
      this.isLoadingTx
      || this.loadingCachedTx
      || !!(
        this.tx
        && !this.tx.status?.confirmed
        && !this.replaced
        && !this.isCached
        && this.acceleratorAvailable
        && this.eligibleForAcceleration
        && this.notAcceleratedOnLoad === null
      )
    );
  }

  get acceleratorError(): string {
    if (!this.acceleratorAvailable) {
      return 'temporarily_unavailable';
    }
    if (this.tx?.status?.confirmed) {
      return 'transaction_confirmed';
    }
    if (this.isAcceleration) {
      return 'acceleration_duplicated';
    }
    return 'cannot_accelerate_tx';
  }

  private setupPartnerCode(): void {
    this.partnerCodeSubscription?.unsubscribe();
    this.partnerCodeSubscription = this.partnerCodeService.partnerCode$.subscribe((partnerCode) => {
      this.partnerCode = partnerCode;
    });
  }

  private consumePartnerCodeFragment(fragment: string | null): void {
    const fragmentParams = new URLSearchParams(fragment || '');
    if (!fragmentParams.has('partnerCode')) {
      return;
    }
    const partnerCode = fragmentParams.get('partnerCode');
    if (partnerCode) {
      this.partnerCodeService.setFragmentPartnerCode(partnerCode);
    }
    fragmentParams.delete('partnerCode');
    const anchor = Array.from(fragmentParams.entries()).find(([, value]) => value === '')?.[0] || null;
    this.router.navigate([], {
      relativeTo: this.route,
      fragment: this.formatFragment(fragmentParams, anchor),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private formatFragment(fragmentParams: URLSearchParams, anchor: string | null = null): string | null {
    const params = new URLSearchParams(fragmentParams);
    for (const [key, value] of Array.from(params.entries())) {
      if (value === '') {
        params.delete(key);
      }
    }
    if (anchor) {
      params.set(anchor, '');
    }
    return Array.from(params.entries()).map(([key, value]) => value ? `${key}=${value}` : key).join('&') || null;
  }

  resetTransaction(): void {
    this.error = undefined;
    this.tx = null;
    this.txChanged$.next(true);
    this.waitingForTransaction = false;
    this.isLoadingTx = true;
    this.loadingCachedTx = false;
    this.replaced = false;
    this.mempoolPosition = null;
    this.accelerationPositions = null;
    this.txInBlockIndex = null;
    this.isCached = false;
    this.isAcceleration = false;
    this.notAcceleratedOnLoad = null;
    this.eligibleForAcceleration = false;
    this.showAccelerationDetails = false;
    this.hasAccelerationDetails = false;
    this.isAccelerated$.next(this.isAcceleration);
    document.body.scrollTo(0, 0);
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
    this.subscription?.unsubscribe();
    this.fetchCpfpSubscription?.unsubscribe();
    this.fetchCachedTxSubscription?.unsubscribe();
    this.mempoolPositionSubscription?.unsubscribe();
    this.networkChangedSubscription?.unsubscribe();
    this.txConfirmedSubscription?.unsubscribe();
    this.txReplacedSubscription?.unsubscribe();
    this.urlFragmentSubscription?.unsubscribe();
    this.partnerCodeSubscription?.unsubscribe();
    this.leaveTransaction();
  }
}
