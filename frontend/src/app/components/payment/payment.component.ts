import { Component, OnInit, OnDestroy, HostListener, ChangeDetectorRef, Inject } from '@angular/core';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { switchMap, filter, catchError, map, startWith, distinctUntilChanged, tap } from 'rxjs/operators';
import { Transaction } from '@interfaces/electrs.interface';
import { of, merge, Subscription, Observable, combineLatest, BehaviorSubject, Subject } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { CacheService } from '@app/services/cache.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { getUnacceleratedFeeRate } from '@app/shared/transaction.utils';
import { BlockExtended, MempoolPosition, AccelerationPosition, RbfTree } from '@interfaces/node-api.interface';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';
import { ZONE_SERVICE } from '@app/injection-tokens';
import { MiningService, MiningStats } from '@app/services/mining.service';
import { ETA, EtaService } from '@app/services/eta.service';
import { getRegex } from '@app/shared/regex.utils';
import { TrackerStage } from '@components/tracker/tracker-bar.component';
import { ApiService } from '@app/services/api.service';

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
  accelerationPositions: AccelerationPosition[];
  latestBlock: BlockExtended;
  isLoadingTx = true;
  error: any = undefined;
  waitingForTransaction = false;
  isMobile: boolean;
  isValidView = false;
  rbfTransaction: Transaction | null;

  destination = '';
  confsRequired = 1;
  amount = 0;
  confirmations = 0;
  settled = false;
  replaced = false;
  trackerStage: TrackerStage = 'waiting';

  miningStats: MiningStats;
  ETA$: Observable<ETA | null>;
  txChanged$ = new BehaviorSubject<boolean>(false);
  isAccelerated$ = new BehaviorSubject<boolean>(false);

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
  latestReplacement: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private apiService: ApiService,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private audioService: AudioService,
    private cacheService: CacheService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private miningService: MiningService,
    private etaService: EtaService,
    private cd: ChangeDetectorRef,
    @Inject(ZONE_SERVICE) private zoneService: any,
  ) {}

  ngOnInit(): void {
    this.onResize();

    if (!this.stateService.isLiquid()) {
      this.miningService.getMiningStats('1m').subscribe(stats => {
        this.miningStats = stats;
      });
    }

    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.networkChangedSubscription = this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
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
          this.markBlock();
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
        this.isCached = false;
        this.isAccelerated$.next(!!(tx.acceleration || this.mempoolPosition?.accelerated));
        if (tx.fee === undefined) {
          this.tx.fee = 0;
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
        this.tx.status = {
          confirmed: true,
          block_height: block.height,
          block_hash: block.id,
          block_time: block.timestamp,
        };
        this.txChanged$.next(true);
        this.updateConfirmations();
        this.stateService.markBlock$.next({ blockHeight: block.height });
        this.trackerStage = 'confirmed';
        this.audioService.playSound('magic');
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
  }

  isValidDestination(tx: Transaction): boolean {
    const network = (this.network || 'mainnet') as any;
    if (!this.destination || !getRegex('address', network).test(this.destination)) {
      return false;
    }

    this.isValidView = tx?.vout?.some(vout => vout.scriptpubkey_address === this.destination);
    return this.isValidView;
  }

  setAmount(): void {
    this.amount = (this.tx?.vout || []).reduce((total, vout) => {
      return vout.scriptpubkey_address === this.destination ? total + vout.value : total;
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

  markBlock(): void {
    if (this.tx?.status?.confirmed) {
      this.stateService.markBlock$.next({ blockHeight: this.tx.status.block_height });
    } else if (this.tx) {
      const txFeePerVSize = getUnacceleratedFeeRate(this.tx, this.tx.acceleration || this.mempoolPosition?.accelerated);
      this.stateService.markBlock$.next({
        txid: this.tx.txid,
        txFeePerVSize,
        mempoolPosition: this.mempoolPosition,
        accelerationPositions: this.accelerationPositions,
      });
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

  getFragment(destination: string, confs: number = 1): string {
    return `destination=${destination}&confs=${confs}`;
  }

  resetTransaction(): void {
    const fragmentParams = new URLSearchParams(this.route.snapshot.fragment || '');
    this.destination = fragmentParams.get('destination') || '';
    const parsedConfs = Math.min(Math.ceil(parseInt((fragmentParams.get('confs') || '1'), 10)), 6); // Capped to 6 confs
    this.confsRequired = (!isNaN(parsedConfs) && parsedConfs >= 1) ? parsedConfs : 1;

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
    this.isAccelerated$.next(false);
    this.txRbfInfoSubscription?.unsubscribe();
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
    this.leaveTransaction();
  }
}
