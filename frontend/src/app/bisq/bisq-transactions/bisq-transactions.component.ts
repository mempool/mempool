import { Component, OnInit } from '@angular/core';
import { BisqTransaction, BisqOutput } from '../bisq.interfaces';
import { Subject } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { BisqApiService } from '../bisq-api.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-bisq-transactions',
  templateUrl: './bisq-transactions.component.html',
  styleUrls: ['./bisq-transactions.component.scss']
})
export class BisqTransactionsComponent implements OnInit {
  transactions: BisqTransaction[];
  totalCount: number;
  page = 1;
  itemsPerPage: number;
  contentSpace = window.innerHeight - (165 + 75);
  fiveItemsPxSize = 250;
  isLoading = true;
  loadingItems: number[];
  pageSubject$ = new Subject<number>();

  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 10;

  constructor(
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Transactions', true);

    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);
    this.loadingItems = Array(this.itemsPerPage);

    if (document.body.clientWidth < 768) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }

    this.pageSubject$
      .pipe(
        tap(() => this.isLoading = true),
        switchMap((page) => this.bisqApiService.listTransactions$((page - 1) * this.itemsPerPage, this.itemsPerPage))
      )
      .subscribe((response) => {
        this.isLoading = false;
        this.transactions = response.body;
        this.totalCount = parseInt(response.headers.get('x-total-count'), 10);
      }, (error) => {
        console.log(error);
      });

    this.pageSubject$.next(1);
  }

  pageChange(page: number) {
    this.pageSubject$.next(page);
  }

  calculateTotalOutput(outputs: BisqOutput[]): number {
    return outputs.reduce((acc: number, output: BisqOutput) => acc + output.bsqAmount, 0);
  }

  trackByFn(index: number) {
    return index;
  }
}
