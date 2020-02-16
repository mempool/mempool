import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap } from 'rxjs/operators';
import { Address, Transaction } from '../../interfaces/electrs.interface';

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss']
})
export class AddressComponent implements OnInit {
  address: Address;
  addressString: string;
  isLoadingAddress = true;
  transactions: Transaction[];
  isLoadingTransactions = true;
  error: any;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
  ) { }

  ngOnInit() {
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.error = undefined;
        this.isLoadingAddress = true;
        this.isLoadingTransactions = true;
        this.transactions = null;
        this.addressString = params.get('id') || '';
        return this.electrsApiService.getAddress$(this.addressString);
      })
    )
    .subscribe((address) => {
      this.address = address;
      this.isLoadingAddress = false;
      window.scrollTo(0, 0);
      this.getAddressTransactions(address.address);
    },
    (error) => {
      console.log(error);
      this.error = error;
      this.isLoadingAddress = false;
    });
  }

  getAddressTransactions(address: string) {
    this.electrsApiService.getAddressTransactions$(address)
      .subscribe((transactions: any) => {
        this.transactions = transactions;
        this.isLoadingTransactions = false;
      });
  }

  loadMore() {
    this.isLoadingTransactions = true;
    this.electrsApiService.getAddressTransactionsFromHash$(this.address.address, this.transactions[this.transactions.length - 1].txid)
      .subscribe((transactions) => {
        this.transactions = this.transactions.concat(transactions);
        this.isLoadingTransactions = false;
      });
  }
}
