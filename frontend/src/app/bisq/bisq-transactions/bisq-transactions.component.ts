import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { BisqTransaction, BisqOutput } from '../bisq.interfaces';

import { merge, Observable, Subject } from 'rxjs';
import { switchMap, map, tap, filter } from 'rxjs/operators';
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
  itemsPerPage = 50;
  fiveItemsPxSize = 250;
  isLoading = true;
  loadingItems: number[];
  radioGroupForm: FormGroup;
  types: string[] = [];
  pageSubject$ = new Subject<any>();

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
  txTypesDefaultChecked = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Transactions', true);

    this.radioGroupForm = this.formBuilder.group({
      txTypes: [this.txTypesDefaultChecked],
    });

    this.loadingItems = Array(this.itemsPerPage);

    if (document.body.clientWidth < 768) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }

    this.transactions$ = merge(
      this.route.queryParams
        .pipe(
          filter((queryParams) => {
            const newPage = parseInt(queryParams.page, 10);
            const types = queryParams.types;
            if (newPage !== this.page || types !== this.types.map((type) => this.txTypes.indexOf(type) + 1).join(',')) {
              return true;
            }
            return false;
          }),
          tap((queryParams) => {
            if (queryParams.page) {
              const newPage = parseInt(queryParams.page, 10);
              this.page = newPage;
            } else {
              this.page = 1;
            }
            if (queryParams.types) {
              const types = queryParams.types.split(',').map((str: string) => parseInt(str, 10));
              this.types = types.map((id: number) => this.txTypes[id - 1]);
              this.radioGroupForm.get('txTypes').setValue(types, { emitEvent: false });
            } else {
              this.types = [];
              this.radioGroupForm.get('txTypes').setValue(this.txTypesDefaultChecked, { emitEvent: false });
            }
            this.cd.markForCheck();
          })
        ),
      this.radioGroupForm.valueChanges
        .pipe(
          tap((data) => {
            this.types = data.txTypes.map((id: number) => this.txTypes[id - 1]);
            if (this.types.length === this.txTypes.length) {
              this.types = [];
            }
            this.page = 1;
            this.typesChanged(data.txTypes);
            this.cd.markForCheck();
          })
        ),
        this.pageSubject$,
      )
      .pipe(
        switchMap(() => this.bisqApiService.listTransactions$((this.page - 1) * this.itemsPerPage, this.itemsPerPage, this.types)),
        map((response) =>  [response.body, parseInt(response.headers.get('x-total-count'), 10)])
      );

    this.radioGroupForm.valueChanges
      .subscribe((data) => {
        const types: string[] = [];
        for (const i in data) {
          if (data[i]) {
            types.push(i);
          }
        }
        this.types = types;
        if (this.page !== 1) {
          this.pageChange(1, true);
        }
        return 1;
      });
  }

  pageChange(page: number, noTrigger?: boolean) {
    this.page = page;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page },
      queryParamsHandling: 'merge',
    });

    if (!noTrigger) {
      this.pageSubject$.next();
    }
  }

  typesChanged(types: number[]) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { types: types.join(','), page: 1 },
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
