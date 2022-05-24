import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import {
  switchMap,
  filter,
  catchError,
  retryWhen,
  delay,
  map
} from 'rxjs/operators';
import { Transaction } from '../../interfaces/electrs.interface';
import { of, merge, Subscription, Observable, Subject, timer, combineLatest, from } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { AudioService } from 'src/app/services/audio.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { BlockExtended, CpfpInfo } from 'src/app/interfaces/node-api.interface';
import { LiquidUnblinding } from './liquid-ublinding';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss'],
})
export class TransactionComponent implements OnInit, OnDestroy {
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
  txReplacedSubscription: Subscription;
  blocksSubscription: Subscription;
  rbfTransaction: undefined | Transaction;
  cpfpInfo: CpfpInfo | null;
  showCpfpDetails = false;
  fetchCpfp$ = new Subject<string>();
  now = new Date().getTime();
  timeAvg$: Observable<number>;
  liquidUnblinding = new LiquidUnblinding();
  outputIndex: number;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
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

    this.timeAvg$ = timer(0, 1000)
      .pipe(
        switchMap(() => this.stateService.difficultyAdjustment$),
        map((da) => da.timeAvg)
      );

    this.fetchCpfpSubscription = this.fetchCpfp$
      .pipe(
        switchMap((txId) =>
          this.apiService
            .getCpfpinfo$(txId)
            .pipe(retryWhen((errors) => errors.pipe(delay(2000))))
        )
      )
      .subscribe((cpfpInfo) => {
        if (!this.tx) {
          return;
        }
        const lowerFeeParents = cpfpInfo.ancestors.filter(
          (parent) => parent.fee / (parent.weight / 4) < this.tx.feePerVsize
        );
        let totalWeight =
          this.tx.weight +
          lowerFeeParents.reduce((prev, val) => prev + val.weight, 0);
        let totalFees =
          this.tx.fee +
          lowerFeeParents.reduce((prev, val) => prev + val.fee, 0);

        if (cpfpInfo.bestDescendant) {
          totalWeight += cpfpInfo.bestDescendant.weight;
          totalFees += cpfpInfo.bestDescendant.fee;
        }

        this.tx.effectiveFeePerVsize = totalFees / (totalWeight / 4);
        this.stateService.markBlock$.next({
          txFeePerVSize: this.tx.effectiveFeePerVsize,
        });
        this.cpfpInfo = cpfpInfo;
      });

    this.subscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          const urlMatch = (params.get('id') || '').split(':');
          this.txId = urlMatch[0];
          this.outputIndex = urlMatch[1] === undefined ? null : parseInt(urlMatch[1], 10);
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
          if (history.state.data && history.state.data.fee !== -1) {
            transactionObservable$ = of(history.state.data);
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

          if (!tx.status.confirmed && tx.firstSeen) {
            this.transactionTime = tx.firstSeen;
          } else {
            this.getTransactionTime();
          }

          if (this.tx.status.confirmed) {
            this.stateService.markBlock$.next({
              blockHeight: tx.status.block_height,
            });
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
          }
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
    });
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
    this.transactionTime = -1;
    this.cpfpInfo = null;
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

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.fetchCpfpSubscription.unsubscribe();
    this.txReplacedSubscription.unsubscribe();
    this.blocksSubscription.unsubscribe();
    this.leaveTransaction();
  }
}
