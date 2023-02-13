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
  mergeMap
} from 'rxjs/operators';
import { Transaction } from '../../interfaces/electrs.interface';
import { of, merge, Subscription, Observable, Subject, timer, combineLatest, from, throwError } from 'rxjs';
import { StateService } from '../../services/state.service';
import { CacheService } from '../../services/cache.service';
import { WebsocketService } from '../../services/websocket.service';
import { AudioService } from '../../services/audio.service';
import { ApiService } from '../../services/api.service';
import { SeoService } from '../../services/seo.service';
import { BlockExtended, CpfpInfo } from '../../interfaces/node-api.interface';
import { LiquidUnblinding } from './liquid-ublinding';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';

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
  isLoadingTx = true;
  error: any = undefined;
  errorUnblinded: any = undefined;
  waitingForTransaction = false;
  latestBlock: BlockExtended;
  transactionTime = -1;
  subscription: Subscription;
  fetchCpfpSubscription: Subscription;
  fetchRbfSubscription: Subscription;
  fetchCachedTxSubscription: Subscription;
  txReplacedSubscription: Subscription;
  txPurgedSubscription: Subscription;
  blocksSubscription: Subscription;
  queryParamsSubscription: Subscription;
  urlFragmentSubscription: Subscription;
  fragmentParams: URLSearchParams;
  rbfTransaction: undefined | Transaction;
  replaced: boolean = false;
  rbfReplaces: string[];
  cpfpInfo: CpfpInfo | null;
  showCpfpDetails = false;
  fetchCpfp$ = new Subject<string>();
  fetchRbfHistory$ = new Subject<string>();
  fetchCachedTx$ = new Subject<string>();
  isPurged: boolean = false;
  now = new Date().getTime();
  timeAvg$: Observable<number>;
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

  tooltipPosition: { x: number, y: number };

  @ViewChild('graphContainer')
  graphContainer: ElementRef;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private relativeUrlPipe: RelativeUrlPipe,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private cacheService: CacheService,
    private websocketService: WebsocketService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService
  ) {}

  ngOnInit() {
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.stateService.networkChanged$.subscribe(
      (network) => (this.network = network)
    );

    this.setFlowEnabled();
    this.flowPrefSubscription = this.stateService.hideFlow.subscribe((hide) => {
      this.hideFlow = !!hide;
      this.setFlowEnabled();
    });

    this.timeAvg$ = timer(0, 1000)
      .pipe(
        switchMap(() => this.stateService.difficultyAdjustment$),
        map((da) => da.timeAvg)
      );

    this.urlFragmentSubscription = this.route.fragment.subscribe((fragment) => {
      this.fragmentParams = new URLSearchParams(fragment || '');
      const vin = parseInt(this.fragmentParams.get('vin'), 10);
      const vout = parseInt(this.fragmentParams.get('vout'), 10);
      this.inputIndex = (!isNaN(vin) && vin >= 0) ? vin : null;
      this.outputIndex = (!isNaN(vout) && vout >= 0) ? vout : null;
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
        if (!cpfpInfo || !this.tx) {
          this.cpfpInfo = null;
          return;
        }
        // merge ancestors/descendants
        const relatives = [...(cpfpInfo.ancestors || []), ...(cpfpInfo.descendants || [])];
        if (cpfpInfo.bestDescendant && !cpfpInfo.descendants?.length) {
          relatives.push(cpfpInfo.bestDescendant);
        }
        let totalWeight =
          this.tx.weight +
          relatives.reduce((prev, val) => prev + val.weight, 0);
        let totalFees =
          this.tx.fee +
          relatives.reduce((prev, val) => prev + val.fee, 0);

        this.tx.effectiveFeePerVsize = totalFees / (totalWeight / 4);

        if (!this.tx.status.confirmed) {
          this.stateService.markBlock$.next({
            txFeePerVSize: this.tx.effectiveFeePerVsize,
          });
        }
        this.cpfpInfo = cpfpInfo;
      });

    this.fetchRbfSubscription = this.fetchRbfHistory$
    .pipe(
      switchMap((txId) =>
        this.apiService
          .getRbfHistory$(txId)
      ),
      catchError(() => {
        return of([]);
      })
    ).subscribe((replaces) => {
      this.rbfReplaces = replaces;
    });

    this.fetchCachedTxSubscription = this.fetchCachedTx$
    .pipe(
      switchMap((txId) =>
        this.apiService
          .getRbfCachedTx$(txId)
      ),
      catchError(() => {
        return of(null);
      })
    ).subscribe((tx) => {
      if (!tx) {
        return;
      }

      this.tx = tx;
      if (tx.fee === undefined) {
        this.tx.fee = 0;
      }
      this.tx.feePerVsize = tx.fee / (tx.weight / 4);
      this.isLoadingTx = false;
      this.error = undefined;
      this.waitingForTransaction = false;
      this.graphExpanded = false;
      this.setupGraph();

      if (!this.tx?.status?.confirmed) {
        this.fetchRbfHistory$.next(this.tx.txid);
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
          this.resetTransaction();
          return merge(
            of(true),
            this.stateService.connectionState$.pipe(
              filter(
                (state) => state === 2 && this.tx && !this.tx.status.confirmed
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
            return;
          }

          this.tx = tx;
          if (tx.fee === undefined) {
            this.tx.fee = 0;
          }
          this.tx.feePerVsize = tx.fee / (tx.weight / 4);
          this.isLoadingTx = false;
          this.error = undefined;
          this.waitingForTransaction = false;
          this.setMempoolBlocksSubscription();
          this.websocketService.startTrackTransaction(tx.txid);
          this.graphExpanded = false;
          this.setupGraph();

          if (!tx.status.confirmed && tx.firstSeen) {
            this.transactionTime = tx.firstSeen;
          } else {
            this.getTransactionTime();
          }

          if (this.tx.status.confirmed) {
            this.stateService.markBlock$.next({
              blockHeight: tx.status.block_height,
            });
            this.fetchCpfp$.next(this.tx.txid);
          } else {
            if (tx.cpfpChecked) {
              this.stateService.markBlock$.next({
                txFeePerVSize: tx.effectiveFeePerVsize,
              });
              this.cpfpInfo = {
                ancestors: tx.ancestors,
                bestDescendant: tx.bestDescendant,
              };
            } else {
              this.fetchCpfp$.next(this.tx.txid);
            }
            this.fetchRbfHistory$.next(this.tx.txid);
          }
          setTimeout(() => { this.applyFragment(); }, 0);
        },
        (error) => {
          this.error = error;
          this.isLoadingTx = false;
        }
      );

    this.blocksSubscription = this.stateService.blocks$.subscribe(([block, txConfirmed]) => {
      this.latestBlock = block;

      if (txConfirmed && this.tx) {
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
        this.waitingForTransaction = false;
      }
      this.rbfTransaction = rbfTransaction;
      this.cacheService.setTxCache([this.rbfTransaction]);
      this.replaced = true;
      if (rbfTransaction && !this.tx) {
        this.fetchCachedTx$.next(this.txId);
      }
    });

    this.txPurgedSubscription = this.stateService.txPurged$.subscribe((isPurged) => {
      this.isPurged = isPurged;
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
  }

  ngAfterViewInit(): void {
    this.setGraphSize();
  }

  handleLoadElectrsTransactionError(error: any): Observable<any> {
    if (error.status === 404 && /^[a-fA-F0-9]{64}$/.test(this.txId)) {
      this.websocketService.startMultiTrackTransaction(this.txId);
      this.waitingForTransaction = true;
    }
    this.error = error;
    this.isLoadingTx = false;
    return of(false);
  }

  setMempoolBlocksSubscription() {
    this.stateService.mempoolBlocks$.subscribe((mempoolBlocks) => {
      if (!this.tx) {
        return;
      }

      const txFeePerVSize =
        this.tx.effectiveFeePerVsize || this.tx.fee / (this.tx.weight / 4);

      for (const block of mempoolBlocks) {
        for (let i = 0; i < block.feeRange.length - 1; i++) {
          if (
            txFeePerVSize <= block.feeRange[i + 1] &&
            txFeePerVSize >= block.feeRange[i]
          ) {
            this.txInBlockIndex = mempoolBlocks.indexOf(block);
          }
        }
      }
    });
  }

  getTransactionTime() {
    this.apiService
      .getTransactionTimes$([this.tx.txid])
      .subscribe((transactionTimes) => {
        this.transactionTime = transactionTimes[0];
      });
  }

  resetTransaction() {
    this.error = undefined;
    this.tx = null;
    this.waitingForTransaction = false;
    this.isLoadingTx = true;
    this.rbfTransaction = undefined;
    this.replaced = false;
    this.transactionTime = -1;
    this.cpfpInfo = null;
    this.rbfReplaces = [];
    this.showCpfpDetails = false;
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
    if (anchor) {
      const anchorElement = document.getElementById(anchor[0]);
      if (anchorElement) {
        anchorElement.scrollIntoView();
      }
    }
  }

  @HostListener('window:resize', ['$event'])
  setGraphSize(): void {
    if (this.graphContainer) {
      this.graphWidth = this.graphContainer.nativeElement.clientWidth;
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.fetchCpfpSubscription.unsubscribe();
    this.fetchRbfSubscription.unsubscribe();
    this.fetchCachedTxSubscription.unsubscribe();
    this.txReplacedSubscription.unsubscribe();
    this.txPurgedSubscription.unsubscribe();
    this.blocksSubscription.unsubscribe();
    this.queryParamsSubscription.unsubscribe();
    this.flowPrefSubscription.unsubscribe();
    this.urlFragmentSubscription.unsubscribe();
    this.leaveTransaction();
  }
}
