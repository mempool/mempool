import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { BisqTransaction, BisqOutput } from '../bisq.interfaces';
import { Subject, merge, Observable, of } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { BisqApiService } from '../bisq-api.service';
import { SeoService } from 'src/app/services/seo.service';
import { FormGroup, FormBuilder } from '@angular/forms';

@Component({
  selector: 'app-bisq-transactions',
  templateUrl: './bisq-transactions.component.html',
  styleUrls: ['./bisq-transactions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqTransactionsComponent implements OnInit {
  transactions$: Observable<[BisqTransaction[], number]>;
  page = 1;
  itemsPerPage: number;
  contentSpace = window.innerHeight - (165 + 75);
  fiveItemsPxSize = 250;
  isLoading = true;
  loadingItems: number[];
  pageSubject$ = new Subject<number>();
  radioGroupForm: FormGroup;
  types: string[] = [];

  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 10;

  constructor(
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Transactions', true);

    this.radioGroupForm = this.formBuilder.group({
      UNVERIFIED: false,
      INVALID: false,
      GENESIS: false,
      TRANSFER_BSQ: false,
      PAY_TRADE_FEE: false,
      PROPOSAL: false,
      COMPENSATION_REQUEST: false,
      REIMBURSEMENT_REQUEST: false,
      BLIND_VOTE: false,
      VOTE_REVEAL: false,
      LOCKUP: false,
      UNLOCK: false,
      ASSET_LISTING_FEE: false,
      PROOF_OF_BURN: false,
    });

    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);
    this.loadingItems = Array(this.itemsPerPage);

    if (document.body.clientWidth < 768) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }

    this.transactions$ = merge(
      of(1),
      this.pageSubject$,
      this.radioGroupForm.valueChanges
        .pipe(
          map((data) => {
            const types: string[] = [];
            for (const i in data) {
              if (data[i]) {
                types.push(i);
              }
            }
            this.types = types;
            return 1;
          })
        )
      )
      .pipe(
        switchMap((page) => this.bisqApiService.listTransactions$((page - 1) * this.itemsPerPage, this.itemsPerPage, this.types)),
        map((response) =>  [response.body, parseInt(response.headers.get('x-total-count'), 10)])
      );
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
