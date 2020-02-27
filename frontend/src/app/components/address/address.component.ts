import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap } from 'rxjs/operators';
import { Address, Transaction } from '../../interfaces/electrs.interface';
import { WebsocketService } from 'src/app/services/websocket.service';
import { StateService } from 'src/app/services/state.service';
import { AudioService } from 'src/app/services/audio.service';
import { ApiService } from 'src/app/services/api.service';
import { of } from 'rxjs';

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

  totalConfirmedTxCount = 0;
  loadedConfirmedTxCount = 0;
  txCount = 0;
  receieved = 0;
  sent = 0;

  private tempTransactions: Transaction[];
  private timeTxIndexes: number[];
  private lastTransactionTxId: string;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private audioService: AudioService,
    private apiService: ApiService,
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
        this.totalConfirmedTxCount++;
        this.loadedConfirmedTxCount++;
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
      .pipe(
        switchMap((address) => {
          this.address = address;
          this.updateChainStats();
          this.websocketService.startTrackAddress(address.address);
          this.isLoadingAddress = false;
          this.isLoadingTransactions = true;
          return this.electrsApiService.getAddressTransactions$(address.address);
        }),
        switchMap((transactions) => {
          this.lastTransactionTxId = transactions[transactions.length - 1].txid;
          this.tempTransactions = transactions;
          this.loadedConfirmedTxCount = transactions.filter((tx) => tx.status.confirmed).length;

          const fetchTxs: string[] = [];
          this.timeTxIndexes = [];
          transactions.forEach((tx, index) => {
            if (!tx.status.confirmed) {
              fetchTxs.push(tx.txid);
              this.timeTxIndexes.push(index);
            }
          });
          if (!fetchTxs.length) {
            return of([]);
          }
          return this.apiService.getTransactionTimes$(fetchTxs);
        })
      )
      .subscribe((times: number[]) => {
        times.forEach((time, index) => {
          this.tempTransactions[this.timeTxIndexes[index]].firstSeen = time;
        });
        this.tempTransactions.sort((a, b) => {
          return b.status.block_time - a.status.block_time || b.firstSeen - a.firstSeen;
        });

        this.transactions = this.tempTransactions;
        this.isLoadingTransactions = false;
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
    this.totalConfirmedTxCount = this.address.chain_stats.tx_count;
  }

  loadMore() {
    this.isLoadingTransactions = true;
    this.electrsApiService.getAddressTransactionsFromHash$(this.address.address, this.lastTransactionTxId)
      .pipe(
        switchMap((transactions) => {
          this.tempTransactions = transactions;
          this.lastTransactionTxId = transactions[transactions.length - 1].txid;
          this.loadedConfirmedTxCount += transactions.filter((tx) => tx.status.confirmed).length;

          const fetchTxs: string[] = [];
          this.timeTxIndexes = [];
          transactions.forEach((tx, index) => {
            if (!tx.status.confirmed) {
              fetchTxs.push(tx.txid);
              this.timeTxIndexes.push(index);
            }
          });
          if (!fetchTxs.length) {
            return of([]);
          }
          return this.apiService.getTransactionTimes$(fetchTxs);
        })
      )
      .subscribe((times: number[]) => {
        times.forEach((time, index) => {
          this.tempTransactions[this.timeTxIndexes[index]].firstSeen = time;
        });
        this.tempTransactions.sort((a, b) => {
          return b.status.block_time - a.status.block_time || b.firstSeen - a.firstSeen;
        });

        this.transactions = this.transactions.concat(this.tempTransactions);
        this.isLoadingTransactions = false;
      });
  }

  ngOnDestroy() {
    this.websocketService.startTrackAddress('stop');
  }
}
