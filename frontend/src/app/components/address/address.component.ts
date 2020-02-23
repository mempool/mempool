import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap } from 'rxjs/operators';
import { Address, Transaction } from '../../interfaces/electrs.interface';
import { WebsocketService } from 'src/app/services/websocket.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss']
})
export class AddressComponent implements OnInit, OnDestroy {
  address: Address;
  addressString: string;
  isLoadingAddress = true;
  transactions: Transaction[];
  isLoadingTransactions = true;
  error: any;
  addedTransactions = 0;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'mempool-blocks']);

    this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.error = undefined;
        this.isLoadingAddress = true;
        this.isLoadingTransactions = true;
        this.transactions = null;
        document.body.scrollTo(0, 0);
        this.addressString = params.get('id') || '';
        return this.electrsApiService.getAddress$(this.addressString);
      })
    )
    .subscribe((address) => {
      this.address = address;
      this.websocketService.startTrackAddress(address.address);
      this.isLoadingAddress = false;
      this.getAddressTransactions(address.address);
    },
    (error) => {
      console.log(error);
      this.error = error;
      this.isLoadingAddress = false;
    });

    this.stateService.mempoolTransactions$
      .subscribe((transaction) => {
        this.transactions.unshift(transaction);
        this.addedTransactions++;
      });

    this.stateService.blockTransactions$
      .subscribe((transaction) => {
        const tx = this.transactions.find((t) => t.txid === transaction.txid);
        if (tx) {
          tx.status = transaction.status;
        }
      });

    this.stateService.isOffline$
      .subscribe((state) => {
        if (!state && this.transactions && this.transactions.length) {
          this.isLoadingTransactions = true;
          this.getAddressTransactions(this.address.address);
        }
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

  ngOnDestroy() {
    this.websocketService.startTrackAddress('stop');
  }
}
