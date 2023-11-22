import { Component, OnInit, AfterViewInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  switchMap,
  filter,
  catchError,
  retryWhen,
  delay,
  map,
  mergeMap,
  tap
} from 'rxjs/operators';
import { Transaction } from '../../interfaces/electrs.interface';
import { of, merge, Subscription, Observable, Subject, from, throwError } from 'rxjs';
import { StateService } from '../../services/state.service';
import { CacheService } from '../../services/cache.service';
import { WebsocketService } from '../../services/websocket.service';
import { AudioService } from '../../services/audio.service';
import { ApiService } from '../../services/api.service';
import { SeoService } from '../../services/seo.service';
import { StorageService } from '../../services/storage.service';
import { seoDescriptionNetwork } from '../../shared/common.utils';
import { BlockExtended, CpfpInfo, RbfTree, MempoolPosition, DifficultyAdjustment } from '../../interfaces/node-api.interface';
import { LiquidUnblinding } from './liquid-ublinding';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { Price, PriceService } from '../../services/price.service';
import { isFeatureActive } from '../../bitcoin.utils';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss'],
})
export class TransactionComponent implements OnInit, AfterViewInit, OnDestroy {
  network = '';
  tx: Transaction;
  txId: string;
  txInBlockIndex: number;
  mempoolPosition: MempoolPosition;
  isLoadingTx = true;
  error: any = undefined;
  errorUnblinded: any = undefined;
  loadingCachedTx = false;
  waitingForTransaction = false;
  latestBlock: BlockExtended;
  transactionTime = -1;
  subscription: Subscription;
  fetchCpfpSubscription: Subscription;
  fetchRbfSubscription: Subscription;
  fetchCachedTxSubscription: Subscription;
  txReplacedSubscription: Subscription;
  txRbfInfoSubscription: Subscription;
  mempoolPositionSubscription: Subscription;
  queryParamsSubscription: Subscription;
  urlFragmentSubscription: Subscription;
  mempoolBlocksSubscription: Subscription;
  blocksSubscription: Subscription;
  fragmentParams: URLSearchParams;
  rbfTransaction: undefined | Transaction;
  replaced: boolean = false;
  rbfReplaces: string[];
  rbfInfo: RbfTree;
  cpfpInfo: CpfpInfo | null;
  sigops: number | null;
  adjustedVsize: number | null;
  showCpfpDetails = false;
  fetchCpfp$ = new Subject<string>();
  fetchRbfHistory$ = new Subject<string>();
  fetchCachedTx$ = new Subject<string>();
  isCached: boolean = false;
  now = Date.now();
  da$: Observable<DifficultyAdjustment>;
  liquidUnblinding = new LiquidUnblinding();
  inputIndex: number;
  outputIndex: number;
  graphExpanded: boolean = false;
  graphWidth: number = 1000;
  graphHeight: number = 360;
  inOutLimit: number = 150;
  maxInOut: number = 0;
  flowPrefSubscription: Subscription;
  hideFlow: boolean = this.stateService.hideFlow.value;
  overrideFlowPreference: boolean = null;
  flowEnabled: boolean;
  blockConversion: Price;
  tooltipPosition: { x: number, y: number };
  isMobile: boolean;

  featuresEnabled: boolean;
  segwitEnabled: boolean;
  rbfEnabled: boolean;
  taprootEnabled: boolean;
  hasEffectiveFeeRate: boolean;
  accelerateCtaType: 'alert' | 'button' = 'button';
  acceleratorAvailable: boolean = this.stateService.env.OFFICIAL_MEMPOOL_SPACE && this.stateService.env.ACCELERATOR && this.stateService.network === '';
  showAccelerationSummary = false;
  scrollIntoAccelPreview = false;

  @ViewChild('graphContainer')
  graphContainer: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private cacheService: CacheService,
    private websocketService: WebsocketService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService,
    private priceService: PriceService,
    private storageService: StorageService
  ) {}

  ngOnInit() {
    this.acceleratorAvailable = this.stateService.env.OFFICIAL_MEMPOOL_SPACE && this.stateService.env.ACCELERATOR && this.stateService.network === '';

    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.stateService.networkChanged$.subscribe(
      (network) => {
        this.network = network;
        this.acceleratorAvailable = this.stateService.env.OFFICIAL_MEMPOOL_SPACE && this.stateService.env.ACCELERATOR && this.stateService.network === '';
      }
    );

    this.accelerateCtaType = (this.storageService.getValue('accel-cta-type') as 'alert' | 'button') ?? 'button';

    this.setFlowEnabled();
    this.flowPrefSubscription = this.stateService.hideFlow.subscribe((hide) => {
      this.hideFlow = !!hide;
      this.setFlowEnabled();
    });

    this.da$ = this.stateService.difficultyAdjustment$.pipe(
      tap(() => {
        this.now = Date.now();
      })
    );

    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.fragmentParams = new URLSearchParams(fragment || '');
      const vin = parseInt(this.fragmentParams.get('vin'), 10);
      const vout = parseInt(this.fragmentParams.get('vout'), 10);
      this.inputIndex = (!isNaN(vin) && vin >= 0) ? vin : null;
      this.outputIndex = (!isNaN(vout) && vout >= 0) ? vout : null;
    });

    this.blocksSubscription = this.stateService.blocks$.subscribe((blocks) => {
      this.latestBlock = blocks[0];
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
      this.rbfReplaces = rbfResponse?.replaces || null;
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
        this.setFeatures();
        this.isCached = true;
        if (tx.fee === undefined) {
          this.tx.fee = 0;
        }
        this.tx.feePerVsize = tx.fee / (tx.weight / 4);
        this.isLoadingTx = false;
        this.error = undefined;
        this.waitingForTransaction = false;
        this.graphExpanded = false;
        this.transactionTime = tx.firstSeen || 0;
        this.setupGraph();

        this.fetchRbfHistory$.next(this.tx.txid);
        this.txRbfInfoSubscription = this.stateService.txRbfInfo$.subscribe((rbfInfo) => {
          if (this.tx) {
            this.rbfInfo = rbfInfo;
          }
        });
      }
    });

    this.mempoolPositionSubscription = this.stateService.mempoolTxPosition$.subscribe(txPosition => {
      this.now = Date.now();
      if (txPosition && txPosition.txid === this.txId && txPosition.position) {
        this.mempoolPosition = txPosition.position;
        if (this.tx && !this.tx.status.confirmed) {
          this.stateService.markBlock$.next({
            txid: txPosition.txid,
            mempoolPosition: this.mempoolPosition
          });
          this.txInBlockIndex = this.mempoolPosition.block;

          if (txPosition.cpfp !== undefined) {
            this.setCpfpInfo(txPosition.cpfp);
          }
        }
      } else {
        this.mempoolPosition = null;
      }
    });

    this.subscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          const urlMatch = (params.get('id') || '').split(':');
          if (urlMatch.length === 2 && urlMatch[1].length === 64) {
            const vin = parseInt(urlMatch[0], 10);
            this.txId = urlMatch[1];
            // rewrite legacy vin syntax
            if (!isNaN(vin)) {
              this.fragmentParams.set('vin', vin.toString());
              this.fragmentParams.delete('vout');
            }
            this.router.navigate([this.relativeUrlPipe.transform('/tx'), this.txId], {
              queryParamsHandling: 'merge',
              fragment: this.fragmentParams.toString(),
            });
          } else {
            this.txId = urlMatch[0];
            const vout = parseInt(urlMatch[1], 10);
            if (urlMatch.length > 1 && !isNaN(vout)) {
              // rewrite legacy vout syntax
              this.fragmentParams.set('vout', vout.toString());
              this.fragmentParams.delete('vin');
              this.router.navigate([this.relativeUrlPipe.transform('/tx'), this.txId], {
                queryParamsHandling: 'merge',
                fragment: this.fragmentParams.toString(),
              });
            }
          }
          this.seoService.setTitle(
            $localize`:@@bisq.transaction.browser-title:Transaction: ${this.txId}:INTERPOLATION:`
          );
          this.seoService.setDescription($localize`:@@meta.description.bitcoin.transaction:Get real-time status, addresses, fees, script info, and more for ${this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet'?'Liquid':'Bitcoin'}${seoDescriptionNetwork(this.stateService.network)} transaction with txid {txid}.`);
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
        switchMap((tx) => {
          if (this.network === 'liquid' || this.network === 'liquidtestnet') {
            return from(this.liquidUnblinding.checkUnblindedTx(tx))
              .pipe(
                catchError((error) => {
                  this.errorUnblinded = error;
                  return of(tx);
                })
              );
          }
          return of(tx);
        })
      )
      .subscribe((tx: Transaction) => {
          if (!tx) {
            this.fetchCachedTx$.next(this.txId);
            this.seoService.logSoft404();
            return;
          }
          this.seoService.clearSoft404();

          this.tx = tx;
          this.setFeatures();
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
          this.loadingCachedTx = false;
          this.waitingForTransaction = false;
          this.websocketService.startTrackTransaction(tx.txid);
          this.graphExpanded = false;
          this.setupGraph();

          if (!tx.status?.confirmed) {
            if (tx.firstSeen) {
              this.transactionTime = tx.firstSeen;
            } else {
              this.getTransactionTime();
            }
          } else {
            this.transactionTime = 0;
          }

          if (this.tx?.status?.confirmed) {
            this.stateService.markBlock$.next({
              blockHeight: tx.status.block_height,
            });
            this.fetchCpfp$.next(this.tx.txid);
          } else {
            if (tx.cpfpChecked) {
              this.stateService.markBlock$.next({
                txid: tx.txid,
                txFeePerVSize: tx.effectiveFeePerVsize,
                mempoolPosition: this.mempoolPosition,
              });
              this.cpfpInfo = {
                ancestors: tx.ancestors,
                bestDescendant: tx.bestDescendant,
              };
              const hasRelatives = !!(tx.ancestors?.length || tx.bestDescendant);
              this.hasEffectiveFeeRate = hasRelatives || (tx.effectiveFeePerVsize && (Math.abs(tx.effectiveFeePerVsize - tx.feePerVsize) > 0.01));
            } else {
              this.fetchCpfp$.next(this.tx.txid);
            }
          }
          this.fetchRbfHistory$.next(this.tx.txid);

          this.priceService.getBlockPrice$(tx.status?.block_time, true).pipe(
            tap((price) => {
              this.blockConversion = price;
            })
          ).subscribe();

          setTimeout(() => { this.applyFragment(); }, 0);
        },
        (error) => {
          this.error = error;
          this.seoService.logSoft404();
          this.isLoadingTx = false;
        }
      );

    this.stateService.txConfirmed$.subscribe(([txConfirmed, block]) => {
      if (txConfirmed && this.tx && !this.tx.status.confirmed && txConfirmed === this.tx.txid) {
        this.tx.status = {
          confirmed: true,
          block_height: block.height,
          block_hash: block.id,
          block_time: block.timestamp,
        };
        this.stateService.markBlock$.next({ blockHeight: block.height });
        this.audioService.playSound('magic');
      }
    });

    this.txReplacedSubscription = this.stateService.txReplaced$.subscribe((rbfTransaction) => {
      if (!this.tx) {
        this.error = new Error();
        this.loadingCachedTx = false;
        this.waitingForTransaction = false;
      }
      this.rbfTransaction = rbfTransaction;
      this.replaced = true;
      this.stateService.markBlock$.next({});

      if (rbfTransaction && !this.tx) {
        this.fetchCachedTx$.next(this.txId);
      }
    });

    this.txRbfInfoSubscription = this.stateService.txRbfInfo$.subscribe((rbfInfo) => {
      if (this.tx) {
        this.rbfInfo = rbfInfo;
      }
    });

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      if (params.showFlow === 'false') {
        this.overrideFlowPreference = false;
      } else if (params.showFlow === 'true') {
        this.overrideFlowPreference = true;
      } else {
        this.overrideFlowPreference = null;
      }
      this.setFlowEnabled();
      this.setGraphSize();
    });

    this.mempoolBlocksSubscription = this.stateService.mempoolBlocks$.subscribe((mempoolBlocks) => {
      this.now = Date.now();

      if (!this.tx || this.mempoolPosition) {
        return;
      }

      const txFeePerVSize =
        this.tx.effectiveFeePerVsize || this.tx.fee / (this.tx.weight / 4);

      let found = false;
      this.txInBlockIndex = 0;
      for (const block of mempoolBlocks) {
        for (let i = 0; i < block.feeRange.length - 1 && !found; i++) {
          if (
            txFeePerVSize <= block.feeRange[i + 1] &&
            txFeePerVSize >= block.feeRange[i]
          ) {
            this.txInBlockIndex = mempoolBlocks.indexOf(block);
            found = true;
          }
        }
      }
      if (!found && txFeePerVSize < mempoolBlocks[mempoolBlocks.length - 1].feeRange[0]) {
        this.txInBlockIndex = 7;
      }
    });
  }

  ngAfterViewInit(): void {
    this.setGraphSize();
  }

  dismissAccelAlert(): void {
    this.storageService.setValue('accel-cta-type', 'button');
    this.accelerateCtaType = 'button';
  }

  onAccelerateClicked() {
    if (!this.txId) {
      return;
    }
    this.showAccelerationSummary = true && this.acceleratorAvailable;
    this.scrollIntoAccelPreview = !this.scrollIntoAccelPreview;
    return false;
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

  getTransactionTime() {
    this.apiService
      .getTransactionTimes$([this.tx.txid])
      .subscribe((transactionTimes) => {
        if (transactionTimes?.length) {
          this.transactionTime = transactionTimes[0];
        }
      });
  }

  setCpfpInfo(cpfpInfo: CpfpInfo): void {
    if (!cpfpInfo || !this.tx) {
      this.cpfpInfo = null;
      this.hasEffectiveFeeRate = false;
      return;
    }
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
      this.tx.effectiveFeePerVsize = cpfpInfo.effectiveFeePerVsize;
    }
    if (cpfpInfo.acceleration) {
      this.tx.acceleration = cpfpInfo.acceleration;
    }

    this.cpfpInfo = cpfpInfo;
    if (this.cpfpInfo.adjustedVsize && this.cpfpInfo.sigops != null) {
      this.sigops = this.cpfpInfo.sigops;
      this.adjustedVsize = this.cpfpInfo.adjustedVsize;
    }
    this.hasEffectiveFeeRate = hasRelatives || (this.tx.effectiveFeePerVsize && (Math.abs(this.tx.effectiveFeePerVsize - this.tx.feePerVsize) > 0.01));
  }

  setFeatures(): void {
    if (this.tx) {
      this.segwitEnabled = !this.tx.status.confirmed || isFeatureActive(this.stateService.network, this.tx.status.block_height, 'segwit');
      this.taprootEnabled = !this.tx.status.confirmed || isFeatureActive(this.stateService.network, this.tx.status.block_height, 'taproot');
      this.rbfEnabled = !this.tx.status.confirmed || isFeatureActive(this.stateService.network, this.tx.status.block_height, 'rbf');
    } else {
      this.segwitEnabled = false;
      this.taprootEnabled = false;
      this.rbfEnabled = false;
    }
    this.featuresEnabled = this.segwitEnabled || this.taprootEnabled || this.rbfEnabled;
  }

  resetTransaction() {
    this.error = undefined;
    this.tx = null;
    this.setFeatures();
    this.waitingForTransaction = false;
    this.isLoadingTx = true;
    this.rbfTransaction = undefined;
    this.replaced = false;
    this.transactionTime = -1;
    this.cpfpInfo = null;
    this.adjustedVsize = null;
    this.sigops = null;
    this.hasEffectiveFeeRate = false;
    this.rbfInfo = null;
    this.rbfReplaces = [];
    this.showCpfpDetails = false;
    this.txInBlockIndex = null;
    this.mempoolPosition = null;
    document.body.scrollTo(0, 0);
    this.leaveTransaction();
  }

  leaveTransaction() {
    this.websocketService.stopTrackingTransaction();
    this.stateService.markBlock$.next({});
  }

  roundToOneDecimal(cpfpTx: any): number {
    return +(cpfpTx.fee / (cpfpTx.weight / 4)).toFixed(1);
  }

  setupGraph() {
    this.maxInOut = Math.min(this.inOutLimit, Math.max(this.tx?.vin?.length || 1, this.tx?.vout?.length + 1 || 1));
    this.graphHeight = this.graphExpanded ? this.maxInOut * 15 : Math.min(360, this.maxInOut * 80);
  }

  toggleGraph() {
    const showFlow = !this.flowEnabled;
    this.stateService.hideFlow.next(!showFlow);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { showFlow: showFlow },
      queryParamsHandling: 'merge',
      fragment: 'flow'
    });
  }

  setFlowEnabled() {
    this.flowEnabled = (this.overrideFlowPreference != null ? this.overrideFlowPreference : !this.hideFlow);
  }

  expandGraph() {
    this.graphExpanded = true;
    this.graphHeight = this.maxInOut * 15;
  }

  collapseGraph() {
    this.graphExpanded = false;
    this.graphHeight = Math.min(360, this.maxInOut * 80);
  }

  // simulate normal anchor fragment behavior
  applyFragment(): void {
    const anchor = Array.from(this.fragmentParams.entries()).find(([frag, value]) => value === '');
    if (anchor?.length) {
      if (anchor[0] === 'accelerate') {
        setTimeout(this.onAccelerateClicked.bind(this), 100);
      } else {
        const anchorElement = document.getElementById(anchor[0]);
        if (anchorElement) {
          anchorElement.scrollIntoView();
        }
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  setGraphSize(): void {
    this.isMobile = window.innerWidth < 850;
    if (this.graphContainer?.nativeElement) {
      setTimeout(() => {
        if (this.graphContainer?.nativeElement) {
          this.graphWidth = this.graphContainer.nativeElement.clientWidth;
        } else {
          setTimeout(() => { this.setGraphSize(); }, 1);
        }
      }, 1);
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.fetchCpfpSubscription.unsubscribe();
    this.fetchRbfSubscription.unsubscribe();
    this.fetchCachedTxSubscription.unsubscribe();
    this.txReplacedSubscription.unsubscribe();
    this.txRbfInfoSubscription.unsubscribe();
    this.queryParamsSubscription.unsubscribe();
    this.flowPrefSubscription.unsubscribe();
    this.urlFragmentSubscription.unsubscribe();
    this.mempoolBlocksSubscription.unsubscribe();
    this.mempoolPositionSubscription.unsubscribe();
    this.mempoolBlocksSubscription.unsubscribe();
    this.blocksSubscription.unsubscribe();
    this.leaveTransaction();
  }
}
