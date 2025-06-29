import { Component, OnInit, OnDestroy } from '@angular/core';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { ActivatedRoute, ParamMap } from '@angular/router';
import {
  switchMap,
  filter,
  catchError,
  retryWhen,
  delay,
} from 'rxjs/operators';
import { Transaction, Vout } from '@interfaces/electrs.interface';
import { of, merge, Subscription, Observable, Subject, from } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { CacheService } from '@app/services/cache.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { CpfpInfo } from '@interfaces/node-api.interface';
import { LiquidUnblinding } from '@components/transaction/liquid-ublinding';

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
  isLiquid = false;
  totalValue: number;
  opReturns: Vout[];
  extraData: 'none' | 'coinbase' | 'opreturn';

  ogSession: number;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private cacheService: CacheService,
    private apiService: ApiService,
    private seoService: SeoService,
    private openGraphService: OpenGraphService,
  ) {}

  ngOnInit() {
    this.stateService.networkChanged$.subscribe(
      (network) => {
        this.network = network;
        if (this.network === 'liquid' || this.network == 'liquidtestnet') {
          this.isLiquid = true;
        }
      }
    );

    this.fetchCpfpSubscription = this.fetchCpfp$
      .pipe(
        switchMap((txId) =>
          this.apiService.getCpfpinfo$(txId).pipe(
            catchError((err) => {
              return of(null);
            })
          )
        )
      )
      .subscribe((cpfpInfo) => {
        this.cpfpInfo = cpfpInfo;
        this.openGraphService.waitOver({ event: 'cpfp-data-' + this.txId, sessionId: this.ogSession });
      });

    this.subscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          const urlMatch = (params.get('id') || '').split(':');
          this.txId = urlMatch[0];
          this.ogSession = this.openGraphService.waitFor('tx-data-' + this.txId);
          this.ogSession = this.openGraphService.waitFor('tx-time-' + this.txId);
          this.seoService.setTitle(
            $localize`:@@bisq.transaction.browser-title:Transaction: ${this.txId}:INTERPOLATION:`
          );
          const network = this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ? 'Liquid' : 'Bitcoin';
          const seoDescription = seoDescriptionNetwork(this.stateService.network);
          this.seoService.setDescription($localize`:@@meta.description.bitcoin.transaction:Get real-time status, addresses, fees, script info, and more for ${network}${seoDescription} transaction with txid ${this.txId}.`);
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
            this.seoService.logSoft404();
            this.openGraphService.fail({ event: 'tx-data-' + this.txId, sessionId: this.ogSession });
            return;
          }

          this.tx = tx;
          if (tx.fee === undefined) {
            this.tx.fee = 0;
          }
          this.tx.feePerVsize = tx.fee / (tx.weight / 4);
          this.isLoadingTx = false;
          this.error = undefined;
          this.totalValue = this.tx.vout.reduce((acc, v) => v.value + acc, 0);
          this.opReturns = this.getOpReturns(this.tx);
          this.extraData = this.chooseExtraData();

          if (tx.status.confirmed) {
            this.transactionTime = tx.status.block_time;
            this.openGraphService.waitOver({ event: 'tx-time-' + this.txId, sessionId: this.ogSession });
          } else if (!tx.status.confirmed && tx.firstSeen) {
            this.transactionTime = tx.firstSeen;
            this.openGraphService.waitOver({ event: 'tx-time-' + this.txId, sessionId: this.ogSession });
          } else {
            this.getTransactionTime();
          }

          if (this.tx.status.confirmed) {
            this.stateService.markBlock$.next({
              blockHeight: tx.status.block_height,
            });
            this.openGraphService.waitFor('cpfp-data-' + this.txId);
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
              this.openGraphService.waitFor('cpfp-data-' + this.txId);
              this.fetchCpfp$.next(this.tx.txid);
            }
          }

          this.openGraphService.waitOver({ event: 'tx-data-' + this.txId, sessionId: this.ogSession });
        },
        (error) => {
          this.seoService.logSoft404();
          this.openGraphService.fail({ event: 'tx-data-' + this.txId, sessionId: this.ogSession });
          this.error = error;
          this.isLoadingTx = false;
        }
      );
  }

  getTransactionTime() {
    this.apiService
      .getTransactionTimes$([this.tx.txid])
      .pipe(
        catchError((err) => {
          return of(0);
        })
      )
      .subscribe((transactionTimes) => {
        this.transactionTime = transactionTimes[0];
        this.openGraphService.waitOver({ event: 'tx-time-' + this.txId, sessionId: this.ogSession });
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

  getOpReturns(tx: Transaction): Vout[] {
    return tx.vout.filter((v) => v.scriptpubkey_type === 'op_return' && v.scriptpubkey_asm !== 'OP_RETURN');
  }

  chooseExtraData(): 'none' | 'opreturn' | 'coinbase' {
    if (this.isCoinbase(this.tx)) {
      return 'coinbase';
    } else if (this.opReturns?.length) {
      return 'opreturn';
    } else {
      return 'none';
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
    this.fetchCpfpSubscription.unsubscribe();
  }
}
