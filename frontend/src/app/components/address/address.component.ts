import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap, filter, catchError, map, tap } from 'rxjs/operators';
import { Address, Transaction } from '../../interfaces/electrs.interface';
import { WebsocketService } from 'src/app/services/websocket.service';
import { StateService } from 'src/app/services/state.service';
import { AudioService } from 'src/app/services/audio.service';
import { ApiService } from 'src/app/services/api.service';
import { of, merge, Subscription, Observable } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss']
})
export class AddressComponent implements OnInit, OnDestroy {
  network = '';

  address: Address;
  addressString: string;
  isLoadingAddress = true;
  transactions: Transaction[];
  isLoadingTransactions = true;
  error: any;
  mainSubscription: Subscription;
  addressLoadingStatus$: Observable<number>;

  totalConfirmedTxCount = 0;
  loadedConfirmedTxCount = 0;
  txCount = 0;
  receieved = 0;
  sent = 0;

  sendNotifications = false;

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
    private seoService: SeoService,
    private notificationService: NotificationService,
  ) { }

  ngOnInit() {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.websocketService.want(['blocks']);

    this.addressLoadingStatus$ = this.route.paramMap
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['address-' + this.addressString] !== undefined ? indicators['address-' + this.addressString] : 0)
      );

    this.mainSubscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.error = undefined;
          this.isLoadingAddress = true;
          this.loadedConfirmedTxCount = 0;
          this.address = null;
          this.isLoadingTransactions = true;
          this.transactions = null;
          document.body.scrollTo(0, 0);
          this.addressString = params.get('id') || '';
          this.seoService.setTitle($localize`:@@address.component.browser-title:Address: ${this.addressString}:INTERPOLATION:`);

          return merge(
            of(true),
            this.stateService.connectionState$
              .pipe(filter((state) => state === 2 && this.transactions && this.transactions.length > 0))
          )
          .pipe(
            switchMap(() => this.electrsApiService.getAddress$(this.addressString)
              .pipe(
                catchError((err) => {
                  this.isLoadingAddress = false;
                  this.error = err;
                  console.log(err);
                  return of(null);
                })
              )
            )
          );
        })
      )
      .pipe(
        filter((address) => !!address),
        switchMap((address) => {
          this.address = address;
          this.updateChainStats();
          this.websocketService.startTrackAddress(address.address);
          this.isLoadingAddress = false;
          this.isLoadingTransactions = true;
          return this.electrsApiService.getAddressTransactions$(address.address);
        }),
        switchMap((transactions) => {
          this.tempTransactions = transactions;
          if (transactions.length) {
            this.lastTransactionTxId = transactions[transactions.length - 1].txid;
            this.loadedConfirmedTxCount += transactions.filter((tx) => tx.status.confirmed).length;
          }

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

        if (this.sendNotifications && this.notificationService.hasNotificationPermission()) {
          this.notificationService.sendNotification(this.addressString, $localize`:@@address.new-transaction-notification-body:A new transaction was seen`);
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
  }

  loadMore() {
    if (this.isLoadingTransactions || !this.totalConfirmedTxCount || this.loadedConfirmedTxCount >= this.totalConfirmedTxCount) {
      return;
    }
    this.isLoadingTransactions = true;
    this.electrsApiService.getAddressTransactionsFromHash$(this.address.address, this.lastTransactionTxId)
      .subscribe((transactions: Transaction[]) => {
        this.lastTransactionTxId = transactions[transactions.length - 1].txid;
        this.loadedConfirmedTxCount += transactions.length;
        this.transactions = this.transactions.concat(transactions);
        this.isLoadingTransactions = false;
      });
  }

  async toggleNotifications(enable) {
    if (enable) {
      await this.notificationService.askForNotificationPermission();
      this.sendNotifications = true;
    } else {
      this.sendNotifications = false;
    }
  }

  hasNotificationSupport() {
    return NotificationService.supportsNotifications();
  }

  updateChainStats() {
    this.receieved = this.address.chain_stats.funded_txo_sum + this.address.mempool_stats.funded_txo_sum;
    this.sent = this.address.chain_stats.spent_txo_sum + this.address.mempool_stats.spent_txo_sum;
    this.txCount = this.address.chain_stats.tx_count + this.address.mempool_stats.tx_count;
    this.totalConfirmedTxCount = this.address.chain_stats.tx_count;
  }

  ngOnDestroy() {
    this.mainSubscription.unsubscribe();
    this.websocketService.stopTrackingAddress();
  }
}
