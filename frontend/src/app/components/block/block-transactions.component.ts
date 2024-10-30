import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { Transaction, Vout } from '@interfaces/electrs.interface';
import { Observable, Subscription, catchError, combineLatest, map, of, startWith, switchMap, tap } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { PreloadService } from '@app/services/preload.service';

@Component({
  selector: 'app-block-transactions',
  templateUrl: './block-transactions.component.html',
  styleUrl: './block-transactions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockTransactionsComponent implements OnInit {
  @Input() txCount: number;
  @Input() timestamp: number;
  @Input() blockHash: string;
  @Input() previousBlockHash: string;
  @Input() block$: Observable<any>;
  @Input() paginationMaxSize: number;
  @Output() blockReward = new EventEmitter<number>();

  itemsPerPage = this.stateService.env.ITEMS_PER_PAGE;
  page = 1;

  transactions$: Observable<Transaction[]>;
  isLoadingTransactions = true;
  transactionsError: any = null;
  transactionSubscription: Subscription;
  txsLoadingStatus$: Observable<number>;
  nextBlockTxListSubscription: Subscription;

  constructor(
    private stateService: StateService,
    private route: ActivatedRoute,
    private router: Router,
    private electrsApiService: ElectrsApiService,
  ) { }

  ngOnInit(): void {
    this.transactions$ = combineLatest([this.block$, this.route.queryParams]).pipe(
      tap(([_, queryParams]) => {
        this.page = +queryParams['page'] || 1;
      }),
      switchMap(([block, _]) => this.electrsApiService.getBlockTransactions$(block.id, (this.page - 1) * this.itemsPerPage)
        .pipe(
          startWith(null),
          catchError((err) => {
            this.transactionsError = err;
            return of([]);
        }))
      ),
      tap((transactions: Transaction[]) => {
        // The block API doesn't contain the block rewards on Liquid
        if (this.stateService.isLiquid() && transactions && transactions[0] && transactions[0].vin[0].is_coinbase) {
          const blockReward = transactions[0].vout.reduce((acc: number, curr: Vout) => acc + curr.value, 0) / 100000000;
          this.blockReward.emit(blockReward);
        }
      })
    );

    this.txsLoadingStatus$ = this.route.paramMap
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['blocktxs-' + this.blockHash] !== undefined ? indicators['blocktxs-' + this.blockHash] : 0)
      );
  }

  pageChange(page: number, target: HTMLElement): void {
    target.scrollIntoView(); // works for chrome
    this.router.navigate([], { queryParams: { page: page }, queryParamsHandling: 'merge' });
  }
}
