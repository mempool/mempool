import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { BisqTransaction, BisqOutput } from '../bisq.interfaces';

import { Observable, Subscription } from 'rxjs';
import { switchMap, map, tap } from 'rxjs/operators';
import { BisqApiService } from '../bisq-api.service';
import { SeoService } from '../../services/seo.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { IMultiSelectOption, IMultiSelectSettings, IMultiSelectTexts } from '../../components/ngx-bootstrap-multiselect/types'
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-bisq-transactions',
  templateUrl: './bisq-transactions.component.html',
  styleUrls: ['./bisq-transactions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqTransactionsComponent implements OnInit, OnDestroy {
  transactions$: Observable<[BisqTransaction[], number]>;
  page = 1;
  itemsPerPage = 50;
  fiveItemsPxSize = 250;
  isLoading = true;
  loadingItems: number[];
  radioGroupForm: FormGroup;
  types: string[] = [];
  radioGroupSubscription: Subscription;

  txTypeOptions: IMultiSelectOption[] = [
      { id: 1, name: $localize`Asset listing fee` },
      { id: 2, name: $localize`Blind vote` },
      { id: 3, name: $localize`Compensation request` },
      { id: 4, name: $localize`Genesis` },
      { id: 13, name: $localize`Irregular` },
      { id: 5, name: $localize`Lockup` },
      { id: 6, name: $localize`Pay trade fee` },
      { id: 7, name: $localize`Proof of burn` },
      { id: 8, name: $localize`Proposal` },
      { id: 9, name: $localize`Reimbursement request` },
      { id: 10, name: $localize`Transfer BSQ` },
      { id: 11, name: $localize`Unlock` },
      { id: 12, name: $localize`Vote reveal` },
  ];
  txTypesDefaultChecked = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  txTypeDropdownSettings: IMultiSelectSettings = {
    buttonClasses: 'btn btn-primary btn-sm',
    displayAllSelectedText: true,
    showCheckAll: true,
    showUncheckAll: true,
    maxHeight: '500px',
    fixedTitle: true,
  };

  txTypeDropdownTexts: IMultiSelectTexts = {
    defaultTitle: $localize`:@@bisq-transactions.filter:Filter`,
    checkAll: $localize`:@@bisq-transactions.selectall:Select all`,
    uncheckAll: $localize`:@@bisq-transactions.unselectall:Unselect all`,
  };

  // @ts-ignore
  paginationSize: 'sm' | 'lg' = 'md';
  paginationMaxSize = 5;

  txTypes = ['ASSET_LISTING_FEE', 'BLIND_VOTE', 'COMPENSATION_REQUEST', 'GENESIS', 'LOCKUP', 'PAY_TRADE_FEE',
    'PROOF_OF_BURN', 'PROPOSAL', 'REIMBURSEMENT_REQUEST', 'TRANSFER_BSQ', 'UNLOCK', 'VOTE_REVEAL', 'IRREGULAR'];

  constructor(
    private websocketService: WebsocketService,
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);
    this.seoService.setTitle($localize`:@@add4cd82e3e38a3110fe67b3c7df56e9602644ee:Transactions`);

    this.radioGroupForm = this.formBuilder.group({
      txTypes: [this.txTypesDefaultChecked],
    });

    this.loadingItems = Array(this.itemsPerPage);

    if (document.body.clientWidth < 670) {
      this.paginationSize = 'sm';
      this.paginationMaxSize = 3;
    }

    this.transactions$ = this.route.queryParams
      .pipe(
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
            this.radioGroupForm.get('txTypes').setValue([], { emitEvent: false });
          }
          this.cd.markForCheck();
        }),
        switchMap(() => this.bisqApiService.listTransactions$((this.page - 1) * this.itemsPerPage, this.itemsPerPage, this.types)),
        map((response) =>  [response.body, parseInt(response.headers.get('x-total-count'), 10)])
      );

    this.radioGroupSubscription = this.radioGroupForm.valueChanges
      .subscribe((data) => {
        this.types = data.txTypes.map((id: number) => this.txTypes[id - 1]);
        if (this.types.length === this.txTypes.length) {
          this.types = [];
        }
        this.page = 1;
        this.typesChanged(data.txTypes);
        this.cd.markForCheck();
      });
  }

  pageChange(page: number) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page },
      queryParamsHandling: 'merge',
    });
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

  getStringByTxType(type: string) {
    const id = this.txTypes.indexOf(type) + 1;
    return this.txTypeOptions.find((type) => id === type.id).name;
  }

  trackByFn(index: number) {
    return index;
  }

  onResize(event: any) {
    this.paginationMaxSize = event.target.innerWidth < 670 ? 3 : 5;
  }

  ngOnDestroy(): void {
    this.radioGroupSubscription.unsubscribe();
  }
}
