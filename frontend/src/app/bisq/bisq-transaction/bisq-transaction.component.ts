import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { BisqTransaction } from 'src/app/bisq/bisq.interfaces';
import { switchMap, map } from 'rxjs/operators';
import { of, Observable, Subscription } from 'rxjs';
import { StateService } from 'src/app/services/state.service';
import { Block } from 'src/app/interfaces/electrs.interface';
import { BisqApiService } from '../bisq-api.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-bisq-transaction',
  templateUrl: './bisq-transaction.component.html',
  styleUrls: ['./bisq-transaction.component.scss']
})
export class BisqTransactionComponent implements OnInit, OnDestroy {
  bisqTx: BisqTransaction;
  latestBlock$: Observable<Block>;
  txId: string;
  isLoading = true;
  subscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private bisqApiService: BisqApiService,
    private stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.subscription = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.isLoading = true;
        document.body.scrollTo(0, 0);
        this.txId = params.get('id') || '';
        this.seoService.setTitle('Transaction: ' + this.txId, true);
        if (history.state.data) {
          return of(history.state.data);
        }
        return this.bisqApiService.getTransaction$(this.txId);
      })
    )
    .subscribe((tx) => {
      this.isLoading = false;
      this.bisqTx = tx;
    });

    this.latestBlock$ = this.stateService.blocks$.pipe(map((([block]) => block)));
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
