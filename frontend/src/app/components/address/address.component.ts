import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap } from 'rxjs/operators';
import { Address, Transaction } from '../../interfaces/electrs.interface';
import { WebsocketService } from 'src/app/services/websocket.service';
import { StateService } from 'src/app/services/state.service';
import { AudioService } from 'src/app/services/audio.service';

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

  txCount = 0;
  receieved = 0;
  sent = 0;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private audioService: AudioService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);

    this.route.paramMap
      .subscribe((params: ParamMap) => {
        this.error = undefined;
        this.isLoadingAddress = true;
        this.isLoadingTransactions = true;
        this.transactions = null;
        document.body.scrollTo(0, 0);
        this.addressString = params.get('id') || '';
        this.loadAddress(this.addressString);
      });

    this.stateService.mempoolTransactions$
      .subscribe((transaction) => {
        if (this.transactions.some((t) => t.txid === transaction.txid)) {
          return;
        }

        this.transactions.unshift(transaction);
        this.transactions = this.transactions.slice();
        this.txCount++;

        if (transaction.vout.some((vout) => vout.scriptpubkey_address === this.address.address)) {
          this.audioService.playSound('cha-ching');
        } else {
          this.audioService.playSound('chime');
        }

        transaction.vin.forEach((vin) => {
          if (vin.prevout.scriptpubkey_address === this.address.address) {
            this.sent += vin.prevout.value;
          }
        });
        transaction.vout.forEach((vout) => {
          if (vout.scriptpubkey_address === this.address.address) {
            this.receieved += vout.value;
          }
        });
      });

    this.stateService.blockTransactions$
      .subscribe((transaction) => {
        const tx = this.transactions.find((t) => t.txid === transaction.txid);
        if (tx) {
          tx.status = transaction.status;
          this.transactions = this.transactions.slice();
          this.audioService.playSound('magic');
        }
      });

    this.stateService.isOffline$
      .subscribe((state) => {
        if (!state && this.transactions && this.transactions.length) {
          this.loadAddress(this.addressString);
        }
      });
  }

  loadAddress(addressStr?: string) {
    this.electrsApiService.getAddress$(addressStr)
      .subscribe((address) => {
        this.address = address;
        this.updateChainStats();
        this.websocketService.startTrackAddress(address.address);
        this.isLoadingAddress = false;
        this.reloadAddressTransactions(address.address);
      },
      (error) => {
        console.log(error);
        this.error = error;
        this.isLoadingAddress = false;
      });
  }

  updateChainStats() {
    this.receieved = this.address.chain_stats.funded_txo_sum + this.address.mempool_stats.funded_txo_sum;
    this.sent = this.address.chain_stats.spent_txo_sum + this.address.mempool_stats.spent_txo_sum;
    this.txCount = this.address.chain_stats.tx_count + this.address.mempool_stats.tx_count;
  }


  reloadAddressTransactions(address: string) {
    this.isLoadingTransactions = true;
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
