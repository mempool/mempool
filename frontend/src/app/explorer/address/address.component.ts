import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ApiService } from 'src/app/services/api.service';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss']
})
export class AddressComponent implements OnInit {
  address: any;
  isLoadingAddress = true;
  latestBlockHeight: number;
  transactions: any[];
  isLoadingTransactions = true;
  error: any;

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService,
    private ref: ChangeDetectorRef,
  ) { }

  ngOnInit() {
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.error = undefined;
        this.isLoadingAddress = true;
        const address: string = params.get('id') || '';
        return this.apiService.getAddress$(address);
      })
    )
    .subscribe((address) => {
      this.address = address;
      this.isLoadingAddress = false;
      this.getAddressTransactions(address.address);
      this.ref.markForCheck();
    },
    (error) => {
      console.log(error);
      this.error = error;
      this.isLoadingAddress = false;
    });
  }

  getAddressTransactions(address: string) {
    this.apiService.getAddressTransactions$(address)
      .subscribe((transactions: any) => {
        this.transactions = transactions;
        this.isLoadingTransactions = false;
      });
  }

  loadMore() {
    this.isLoadingTransactions = true;
    this.apiService.getAddressTransactionsFromHash$(this.address.id, this.transactions[this.transactions.length - 1].txid)
      .subscribe((transactions) => {
        this.transactions = this.transactions.concat(transactions);
        this.isLoadingTransactions = false;
      });
  }
}
