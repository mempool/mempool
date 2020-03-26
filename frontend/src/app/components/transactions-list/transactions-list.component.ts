import { Component, OnInit, Input, ChangeDetectionStrategy, OnChanges, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable, forkJoin } from 'rxjs';
import { Block, Outspend, Transaction } from '../../interfaces/electrs.interface';
import { ElectrsApiService } from '../../services/electrs-api.service';

@Component({
  selector: 'app-transactions-list',
  templateUrl: './transactions-list.component.html',
  styleUrls: ['./transactions-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionsListComponent implements OnInit, OnChanges {
  @Input() transactions: Transaction[];
  @Input() showConfirmations = false;
  @Input() transactionPage = false;

  @Output() loadMore = new EventEmitter();

  latestBlock$: Observable<Block>;
  outspends: Outspend[] = [];

  constructor(
    private stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private ref: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    this.latestBlock$ = this.stateService.blocks$;
  }

  ngOnChanges() {
    if (!this.transactions || !this.transactions.length) {
      return;
    }
    const observableObject = {};
    this.transactions.forEach((tx, i) => {
      tx['@voutLength'] = 10;
      tx['@vinLength'] = 10;
      if (this.outspends[i]) {
        return;
      }
      observableObject[i] = this.electrsApiService.getOutspends$(tx.txid);
    });

    forkJoin(observableObject)
      .subscribe((outspends: any) => {
        const newOutspends = [];
        for (const i in outspends) {
          if (outspends.hasOwnProperty(i)) {
            newOutspends.push(outspends[i]);
          }
        }
        this.outspends = this.outspends.concat(newOutspends);
        this.ref.markForCheck();
      });
  }

  onScroll() {
    this.loadMore.emit();
  }

  getTotalTxOutput(tx: Transaction) {
    return tx.vout.map((v: any) => v.value || 0).reduce((a: number, b: number) => a + b);
  }

  switchCurrency() {
    const oldvalue = !this.stateService.viewFiat$.value;
    this.stateService.viewFiat$.next(oldvalue);
  }

  trackByFn(index: number, tx: Transaction) {
    return tx.txid + tx.status.confirmed;
  }

  loadMoreVin(tx: Transaction) {
    tx['@vinLength'] += 10;
    this.ref.markForCheck();
  }

  loadMoreVout(tx: Transaction) {
    tx['@voutLength'] += 10;
    this.ref.markForCheck();
  }

  getFilteredTxVin(tx: Transaction) {
    return tx.vin.slice(0, tx['@vinLength']);
  }

  getFilteredTxVout(tx: Transaction) {
    return tx.vout.slice(0, tx['@voutLength']);
  }
}
