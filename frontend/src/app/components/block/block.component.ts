import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap, tap, debounceTime, catchError } from 'rxjs/operators';
import { Block, Transaction, Vout } from '../../interfaces/electrs.interface';
import { of } from 'rxjs';
import { StateService } from '../../services/state.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss']
})
export class BlockComponent implements OnInit, OnDestroy {
  block: Block;
  blockHeight: number;
  blockHash: string;
  isLoadingBlock = true;
  latestBlock: Block;
  transactions: Transaction[];
  isLoadingTransactions = true;
  error: any;
  blockSubsidy: number;
  fees: number;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit() {
    this.route.paramMap
    .pipe(
      switchMap((params: ParamMap) => {
        const blockHash: string = params.get('id') || '';
        this.error = undefined;
        this.fees = undefined;

        if (history.state.data && history.state.data.blockHeight) {
          this.blockHeight = history.state.data.blockHeight;
        }

        this.blockHash = blockHash;
        document.body.scrollTo(0, 0);

        if (history.state.data && history.state.data.block) {
          this.blockHeight = history.state.data.block.height;
          return of(history.state.data.block);
        } else {
          this.isLoadingBlock = true;
          return this.electrsApiService.getBlock$(blockHash);
        }
      }),
      tap((block: Block) => {
        this.block = block;
        this.blockHeight = block.height;
        this.seoService.setTitle('Block: #' + block.height + ': ' + block.id);
        this.isLoadingBlock = false;
        this.setBlockSubsidy();
        if (block.reward) {
          this.fees = block.reward / 100000000 - this.blockSubsidy;
        }
        this.stateService.markBlock$.next({ blockHeight: this.blockHeight });
        this.isLoadingTransactions = true;
        this.transactions = null;
      }),
      debounceTime(300),
      switchMap((block) => this.electrsApiService.getBlockTransactions$(block.id)
        .pipe(
          catchError((err) => {
            console.log(err);
            return of([]);
        }))
      ),
    )
    .subscribe((transactions: Transaction[]) => {
      if (this.fees === undefined && transactions[0]) {
        this.fees = transactions[0].vout.reduce((acc: number, curr: Vout) => acc + curr.value, 0) / 100000000 - this.blockSubsidy;
      }
      this.transactions = transactions;
      this.isLoadingTransactions = false;
    },
    (error) => {
      this.error = error;
      this.isLoadingBlock = false;
    });

    this.stateService.blocks$
      .subscribe((block) => this.latestBlock = block);
  }

  ngOnDestroy() {
    this.stateService.markBlock$.next({});
  }

  setBlockSubsidy() {
    this.blockSubsidy = 50;
    let halvenings = Math.floor(this.block.height / 210000);
    while (halvenings > 0) {
      this.blockSubsidy = this.blockSubsidy / 2;
      halvenings--;
    }
  }

  loadMore() {
    if (this.isLoadingTransactions || !this.transactions.length || this.transactions.length === this.block.tx_count) {
      return;
    }

    this.isLoadingTransactions = true;
    this.electrsApiService.getBlockTransactions$(this.block.id, this.transactions.length)
      .subscribe((transactions) => {
        this.transactions = this.transactions.concat(transactions);
        this.isLoadingTransactions = false;
      });
  }

}
