import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, filter, catchError } from 'rxjs/operators';
import { Transaction, Block } from '../../interfaces/electrs.interface';
import { of, merge, Subscription, Observable } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { AudioService } from 'src/app/services/audio.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-transaction',
  templateUrl: './transaction.component.html',
  styleUrls: ['./transaction.component.scss']
})
export class TransactionComponent implements OnInit, OnDestroy {
  network = '';
  tx: Transaction;
  txId: string;
  txInBlockIndex: number;
  isLoadingTx = true;
  error: any = undefined;
  waitingForTransaction = false;
  latestBlock: Block;
  transactionTime = -1;
  subscription: Subscription;
  rbfTransaction: undefined | Transaction;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private websocketService: WebsocketService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService,
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    this.subscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.txId = params.get('id') || '';
        this.seoService.setTitle('Transaction: ' + this.txId, true);
        this.resetTransaction();
        return merge(
          of(true),
          this.stateService.connectionState$.pipe(
            filter((state) => state === 2 && this.tx && !this.tx.status.confirmed)
          ),
        );
      }),
      switchMap(() => {
        let transactionObservable$: Observable<Transaction>;
        if (history.state.data) {
          transactionObservable$ = of(history.state.data);
        } else {
          transactionObservable$ = this.electrsApiService.getTransaction$(this.txId).pipe(
            catchError(this.handleLoadElectrsTransactionError.bind(this))
          );
        }
        return merge(
          transactionObservable$,
          this.stateService.mempoolTransactions$
        );
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
      this.isLoadingTx = false;
      this.error = undefined;
      this.waitingForTransaction = false;
      this.setMempoolBlocksSubscription();

      if (!tx.status.confirmed) {
        this.websocketService.startTrackTransaction(tx.txid);

        if (tx.firstSeen) {
          this.transactionTime = tx.firstSeen;
        } else {
          this.getTransactionTime();
        }
      }
      if (this.tx.status.confirmed) {
        this.stateService.markBlock$.next({ blockHeight: tx.status.block_height });
      } else {
        this.stateService.markBlock$.next({ txFeePerVSize: tx.fee / (tx.weight / 4) });
      }
    },
    (error) => {
      this.error = error;
      this.isLoadingTx = false;
    });

    this.stateService.blocks$
      .subscribe(([block, txConfirmed]) => {
        this.latestBlock = block;

        if (txConfirmed) {
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

    this.stateService.txReplaced$
      .subscribe((rbfTransaction) => this.rbfTransaction = rbfTransaction);
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
    this.stateService.mempoolBlocks$
      .subscribe((mempoolBlocks) => {
        if (!this.tx) {
          return;
        }

        const txFeePerVSize = this.tx.fee / (this.tx.weight / 4);

        for (const block of mempoolBlocks) {
          for (let i = 0; i < block.feeRange.length - 1; i++) {
            if (txFeePerVSize <= block.feeRange[i + 1] && txFeePerVSize >= block.feeRange[i]) {
              this.txInBlockIndex = mempoolBlocks.indexOf(block);
            }
          }
        }
      });
  }

  getTransactionTime() {
    this.apiService.getTransactionTimes$([this.tx.txid])
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
    document.body.scrollTo(0, 0);
    this.leaveTransaction();
  }

  leaveTransaction() {
    this.websocketService.stopTrackingTransaction();
    this.stateService.markBlock$.next({});
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.leaveTransaction();
  }
}
