import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { BisqTransaction, BisqOutput } from '../bisq.interfaces';
import { merge, Observable } from 'rxjs';
import { switchMap, map } from 'rxjs/operators';
import { BisqApiService } from '../bisq-api.service';
import { SeoService } from 'src/app/services/seo.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IMultiSelectOption, IMultiSelectSettings, IMultiSelectTexts } from 'ngx-bootrap-multiselect';

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
  radioGroupForm: FormGroup;
  types: string[] = [];

  txTypeOptions: IMultiSelectOption[] = [
      { id: 1, name: 'Asset listing fee' },
      { id: 2, name: 'Blind vote' },
      { id: 3, name: 'Compensation request' },
      { id: 4, name: 'Genesis' },
      { id: 5, name: 'Lockup' },
      { id: 6, name: 'Pay trade fee' },
      { id: 7, name: 'Proof of burn' },
      { id: 8, name: 'Proposal' },
      { id: 9, name: 'Reimbursement request' },
      { id: 10, name: 'Transfer BSQ' },
      { id: 11, name: 'Unlock' },
      { id: 12, name: 'Vote reveal' },
  ];

  txTypeDropdownSettings: IMultiSelectSettings = {
    buttonClasses: 'btn btn-primary btn-sm',
    displayAllSelectedText: true,
    showCheckAll: true,
    showUncheckAll: true,
    maxHeight: '500px',
    fixedTitle: true,
  };

  txTypeDropdownTexts: IMultiSelectTexts = {
    defaultTitle: 'Filter',
  };

  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 10;

  txTypes = ['ASSET_LISTING_FEE', 'BLIND_VOTE', 'COMPENSATION_REQUEST', 'GENESIS', 'LOCKUP', 'PAY_TRADE_FEE',
    'PROOF_OF_BURN', 'PROPOSAL', 'REIMBURSEMENT_REQUEST', 'TRANSFER_BSQ', 'UNLOCK', 'VOTE_REVEAL'];

  constructor(
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Transactions', true);

    this.radioGroupForm = this.formBuilder.group({
      txTypes: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    });

    this.itemsPerPage = Math.max(Math.round(this.contentSpace / this.fiveItemsPxSize) * 5, 10);
    this.loadingItems = Array(this.itemsPerPage);

    if (document.body.clientWidth < 768) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }

    this.transactions$ = merge(
      this.route.queryParams
        .pipe(
          map((queryParams) => {
            if (queryParams.page) {
              this.page = parseInt(queryParams.page, 10);
              return parseInt(queryParams.page, 10);
            }
            return 1;
          })
        ),
      this.radioGroupForm.valueChanges
        .pipe(
          map((data) => {
            this.types = data.txTypes.map((id: number) => this.txTypes[id - 1]);
            if (this.types.length === this.txTypes.length) {
              this.types = [];
            }
            if (this.page !== 1) {
              this.pageChange(1);
            }
            return 1;
          })
        )
      )
      .pipe(
        switchMap(() => this.bisqApiService.listTransactions$((this.page - 1) * this.itemsPerPage, this.itemsPerPage, this.types)),
        map((response) =>  [response.body, parseInt(response.headers.get('x-total-count'), 10)])
      );
  }

  pageChange(page: number) {
    this.router.navigate([], {
      queryParams: { page: page },
      replaceUrl: true,
      queryParamsHandling: 'merge',
    });
  }

  calculateTotalOutput(outputs: BisqOutput[]): number {
    return outputs.reduce((acc: number, output: BisqOutput) => acc + output.bsqAmount, 0);
  }

  trackByFn(index: number) {
    return index;
  }
}
