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
import { Transaction, Vout } from '../../interfaces/electrs.interface';
import { of, merge, Subscription, Observable, Subject, timer, combineLatest, from } from 'rxjs';
import { StateService } from '../../services/state.service';
import { OpenGraphService } from 'src/app/services/opengraph.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { CpfpInfo } from 'src/app/interfaces/node-api.interface';
import { LiquidUnblinding } from './liquid-ublinding';

@Component({
  selector: 'app-transaction-preview',
  templateUrl: './transaction-preview.component.html',
  styleUrls: ['./transaction-preview.component.scss'],
})
export class TransactionPreviewComponent implements OnInit, OnDestroy {
  network = '';
  tx: Transaction;
  txId: string;
  isLoadingTx = true;
  error: any = undefined;
  errorUnblinded: any = undefined;
  transactionTime = -1;
  subscription: Subscription;
  fetchCpfpSubscription: Subscription;
  cpfpInfo: CpfpInfo | null;
  showCpfpDetails = false;
  fetchCpfp$ = new Subject<string>();
  liquidUnblinding = new LiquidUnblinding();

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private apiService: ApiService,
    private seoService: SeoService,
    private openGraphService: OpenGraphService,
  ) {}

  ngOnInit() {
    this.stateService.networkChanged$.subscribe(
      (network) => (this.network = network)
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
        this.openGraphService.waitOver('cpfp-data');
      });

    this.subscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.openGraphService.waitFor('tx-data');
          const urlMatch = (params.get('id') || '').split(':');
          this.txId = urlMatch[0];
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
                catchError(error => {
                  this.error = error;
                  this.isLoadingTx = false;
                  return of(null);
                })
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
            this.openGraphService.fail('tx-data');
            return;
          }

          this.tx = tx;
          if (tx.fee === undefined) {
            this.tx.fee = 0;
          }
          this.tx.feePerVsize = tx.fee / (tx.weight / 4);
          this.isLoadingTx = false;
          this.error = undefined;

          if (!tx.status.confirmed && tx.firstSeen) {
            this.transactionTime = tx.firstSeen;
          } else {
            this.getTransactionTime();
          }

          if (!this.tx.status.confirmed) {
            if (tx.cpfpChecked) {
              this.cpfpInfo = {
                ancestors: tx.ancestors,
                bestDescendant: tx.bestDescendant,
              };
            } else {
              this.openGraphService.waitFor('cpfp-data');
              this.fetchCpfp$.next(this.tx.txid);
            }
          }

          this.openGraphService.waitOver('tx-data');
        },
        (error) => {
          this.openGraphService.fail('tx-data');
          this.error = error;
          this.isLoadingTx = false;
        }
      );
  }

  getTransactionTime() {
    this.openGraphService.waitFor('tx-time');
    this.apiService
      .getTransactionTimes$([this.tx.txid])
      .pipe(
        catchError((err) => {
          return of(0);
        })
      )
      .subscribe((transactionTimes) => {
        this.transactionTime = transactionTimes[0];
        this.openGraphService.waitOver('tx-time');
      });
  }

  resetTransaction() {
    this.error = undefined;
    this.tx = null;
    this.isLoadingTx = true;
    this.transactionTime = -1;
    this.cpfpInfo = null;
    this.showCpfpDetails = false;
  }

  isCoinbase(tx: Transaction): boolean {
    return tx.vin.some((v: any) => v.is_coinbase === true);
  }

  haveBlindedOutputValues(tx: Transaction): boolean {
    return tx.vout.some((v: any) => v.value === undefined);
  }

  getTotalTxOutput(tx: Transaction) {
    return tx.vout.map((v: Vout) => v.value || 0).reduce((a: number, b: number) => a + b);
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.fetchCpfpSubscription.unsubscribe();
  }
}
