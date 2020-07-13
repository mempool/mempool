import { Component, OnInit } from '@angular/core';
import { BisqTransaction, BisqOutput } from '../bisq.interfaces';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BisqApiService } from '../bisq-api.service';

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

  pageSubject$ = new Subject<number>();

  constructor(
    private bisqApiService: BisqApiService,
  ) { }

  ngOnInit(): void {
    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);

    this.pageSubject$
      .pipe(
        switchMap((page) => this.bisqApiService.listTransactions$((page - 1) * 10, this.itemsPerPage))
      )
      .subscribe((response) => {
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
