import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { BisqTransaction } from '../../bisq/bisq.interfaces';
import { switchMap, map, catchError } from 'rxjs/operators';
import { of, Observable, Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { Block, Transaction } from '../../interfaces/electrs.interface';
import { BisqApiService } from '../bisq-api.service';
import { SeoService } from '../../services/seo.service';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-bisq-transaction',
  templateUrl: './bisq-transaction.component.html',
  styleUrls: ['./bisq-transaction.component.scss']
})
export class BisqTransactionComponent implements OnInit, OnDestroy {
  bisqTx: BisqTransaction;
  tx: Transaction;
  latestBlock$: Observable<Block>;
  txId: string;
  price: number;
  isLoading = true;
  isLoadingTx = true;
  error = null;
  subscription: Subscription;

  constructor(
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private bisqApiService: BisqApiService,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private seoService: SeoService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);

    this.subscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.isLoading = true;
        this.isLoadingTx = true;
        this.error = null;
        document.body.scrollTo(0, 0);
        this.txId = params.get('id') || '';
        this.seoService.setTitle($localize`:@@bisq.transaction.browser-title:Transaction: ${this.txId}:INTERPOLATION:`);
        if (history.state.data) {
          return of(history.state.data);
        }
        return this.bisqApiService.getTransaction$(this.txId)
          .pipe(
            catchError((bisqTxError: HttpErrorResponse) => {
              if (bisqTxError.status === 404) {
                return this.electrsApiService.getTransaction$(this.txId)
                  .pipe(
                    map((tx) => {
                      if (tx.status.confirmed) {
                        this.error = {
                          status: 200,
                          statusText: 'Transaction is confirmed but not available in the Bisq database, please try reloading this page.'
                        };
                        return null;
                      }
                      return tx;
                    }),
                    catchError((txError: HttpErrorResponse) => {
                      console.log(txError);
                      this.error = txError;
                      return of(null);
                    })
                  );
              }
              this.error = bisqTxError;
              return of(null);
            })
          );
      }),
      switchMap((tx) => {
        if (!tx) {
          return of(null);
        }

        if (tx.version) {
          if (this.stateService.env.BASE_MODULE === 'bisq') {
            window.location.replace('https://mempool.space/tx/' + this.txId);
          } else {
            this.router.navigate(['/tx/', this.txId], { state: { data: tx, bsqTx: true }});
          }
          return of(null);
        }

        this.bisqTx = tx;
        this.isLoading = false;

        return this.electrsApiService.getTransaction$(this.txId);
      }),
    )
    .subscribe((tx) => {
      this.isLoadingTx = false;

      if (!tx) {
        return;
      }

      this.tx = tx;
    },
    (error) => {
      this.error = error;
    });

    this.latestBlock$ = this.stateService.blocks$.pipe(map((([block]) => block)));

    this.stateService.bsqPrice$
      .subscribe((bsqPrice) => {
        this.price = bsqPrice;
      });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
