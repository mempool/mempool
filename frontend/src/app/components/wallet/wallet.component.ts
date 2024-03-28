import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap, filter, catchError, map, tap, share } from 'rxjs/operators';
import { Address, Transaction } from '../../interfaces/electrs.interface';
import { WebsocketService } from '../../services/websocket.service';
import { StateService } from '../../services/state.service';
import { AudioService } from '../../services/audio.service';
import { ApiService } from '../../services/api.service';
import { of, merge, Subscription, Observable, combineLatest, forkJoin } from 'rxjs';
import { SeoService } from '../../services/seo.service';
import { seoDescriptionNetwork } from '../../shared/common.utils';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss']
})
export class WalletComponent implements OnInit, OnDestroy {
  network = '';

  addresses: Address[];
  addressStrings: string[];
  isLoadingAddress = true;
  transactions: Transaction[];
  isLoadingTransactions = true;
  retryLoadMore = false;
  error: any;
  mainSubscription: Subscription;
  wsSubscription: Subscription;
  addressLoadingStatus$: Observable<number>;

  collapseAddresses: boolean = true;

  fullyLoaded = false;
  txCount = 0;
  received = 0;
  sent = 0;
  chainBalance = 0;

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
  ) { }

  ngOnInit(): void {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.websocketService.want(['blocks']);

    const addresses$ = this.route.queryParamMap.pipe(
      map((queryParams) => (queryParams.get('addresses') as string)?.split(',').map(this.normalizeAddress)),
      tap(addresses => {
        this.addressStrings = addresses;
        this.error = undefined;
        this.isLoadingAddress = true;
        this.fullyLoaded = false;
        this.addresses = [];
        this.isLoadingTransactions = true;
        this.transactions = null;
        document.body.scrollTo(0, 0);
        const titleLabel = addresses[0] + (addresses.length > 1 ? ` +${addresses.length - 1} addresses` : '');
        this.seoService.setTitle($localize`:@@address.component.browser-title:Address: ${titleLabel}}:INTERPOLATION:`);
        this.seoService.setDescription($localize`:@@meta.description.bitcoin.address:See mempool transactions, confirmed transactions, balance, and more for ${this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet'?'Liquid':'Bitcoin'}${seoDescriptionNetwork(this.stateService.network)} address ${titleLabel}:INTERPOLATION:.`);
      }),
      share()
    );

    this.addressLoadingStatus$ = addresses$
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['address-' + this.addressStrings.join(',')] !== undefined ? indicators['address-' + this.addressStrings.join(',')] : 0)
      );

    this.mainSubscription = combineLatest([
      addresses$,
      merge(
        of(true),
        this.stateService.connectionState$.pipe(filter((state) => state === 2 && this.transactions && this.transactions.length > 0)),
      ),
    ]).pipe(
        switchMap(([addresses]) => {
            return forkJoin(
              addresses.map((address) => 
                address.match(/04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}/)
                  ? this.electrsApiService.getPubKeyAddress$(address)
                  : this.electrsApiService.getAddress$(address)
              )
            );
        }),
        tap((addresses: Address[]) => {
          this.addresses = addresses;
          this.updateChainStats();
          this.isLoadingAddress = false;
          this.isLoadingTransactions = true;
          this.websocketService.startTrackAddresses(addresses.map(address => address.address));
        }),
        switchMap((addresses) => {
          return addresses[0].is_pubkey
              ? this.electrsApiService.getScriptHashesTransactions$(addresses.map(address => (address.address.length === 66 ? '21' : '41') + address.address + 'ac'))
              : this.electrsApiService.getAddressesTransactions$(addresses.map(address => address.address));
        }),
        switchMap((transactions) => {
          this.tempTransactions = transactions;
          if (transactions.length) {
            this.lastTransactionTxId = transactions[transactions.length - 1].txid;
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
          return this.apiService.getTransactionTimes$(fetchTxs).pipe(
            catchError((err) => {
              this.isLoadingAddress = false;
              this.isLoadingTransactions = false;
              this.error = err;
              this.seoService.logSoft404();
              console.log(err);
              return of([]);
            })
          );
        })
      )
      .subscribe((times: number[] | null) => {
        if (!times) {
          return;
        }
        times.forEach((time, index) => {
          this.tempTransactions[this.timeTxIndexes[index]].firstSeen = time;
        });
        this.tempTransactions.sort((a, b) => {
          if (b.status.confirmed) {
            if (b.status.block_height === a.status.block_height) {
              return b.status.block_time - a.status.block_time;
            }
            return b.status.block_height - a.status.block_height;
          }
          return b.firstSeen - a.firstSeen;
        });

        this.transactions = this.tempTransactions;
        this.isLoadingTransactions = false;
      },
      (error) => {
        console.log(error);
        this.error = error;
        this.seoService.logSoft404();
        this.isLoadingAddress = false;
      });

    this.wsSubscription = this.stateService.multiAddressTransactions$.subscribe(update => {
      for (const address of Object.keys(update)) {
        for (const transaction of update[address].mempool) {
          this.addTransaction(transaction);
        }
        for (const transaction of update[address].confirmed) {
          const tx = this.transactions.find((t) => t.txid === transaction.txid);
          if (tx) {
            this.removeTransaction(tx);
            tx.status = transaction.status;
            this.transactions = this.transactions.slice();
            this.audioService.playSound('magic');
          } else {
            if (this.addTransaction(transaction, false)) {
              this.audioService.playSound('magic');
            }
          }
        }
        for (const transaction of update[address].removed) {
          this.removeTransaction(transaction);
        }
      }
    });
  }

  addTransaction(transaction: Transaction, playSound: boolean = true): boolean {
    if (this.transactions.some((t) => t.txid === transaction.txid)) {
      return false;
    }

    this.transactions.unshift(transaction);
    this.transactions = this.transactions.slice();
    this.txCount++;

    if (playSound) {
      if (transaction.vout.some((vout) => this.addressStrings.includes(vout?.scriptpubkey_address))) {
        this.audioService.playSound('cha-ching');
      } else {
        this.audioService.playSound('chime');
      }
    }

    for (const address of this.addresses) {
      let match = false;
      transaction.vin.forEach((vin) => {
        if (vin?.prevout?.scriptpubkey_address === address.address) {
          match = true;
          this.sent += vin.prevout.value;
          if (transaction.status?.confirmed) {
            address.chain_stats.funded_txo_count++;
            address.chain_stats.funded_txo_sum += vin.prevout.value;
          } else {
            address.mempool_stats.funded_txo_count++;
            address.mempool_stats.funded_txo_sum += vin.prevout.value;
          }
        }
      });
      transaction.vout.forEach((vout) => {
        match = true;
        if (vout?.scriptpubkey_address === address.address) {
          this.received += vout.value;
        }
        if (transaction.status?.confirmed) {
          address.chain_stats.spent_txo_count++;
          address.chain_stats.spent_txo_sum += vout.value;
        } else {
          address.mempool_stats.spent_txo_count++;
          address.mempool_stats.spent_txo_sum += vout.value;
        }
      });
      if (match) {
        if (transaction.status?.confirmed) {
          address.chain_stats.tx_count++;
        } else {
          address.mempool_stats.tx_count++;
        }
      }
    }

    return true;
  }

  removeTransaction(transaction: Transaction): boolean {
    const index = this.transactions.findIndex(((tx) => tx.txid === transaction.txid));
    if (index === -1) {
      return false;
    }

    this.transactions.splice(index, 1);
    this.transactions = this.transactions.slice();
    this.txCount--;

    for (const address of this.addresses) {
      let match = false;
      transaction.vin.forEach((vin) => {
        if (vin?.prevout?.scriptpubkey_address === address.address) {
          match = true;
          this.sent -= vin.prevout.value;
          if (transaction.status?.confirmed) {
            address.chain_stats.funded_txo_count--;
            address.chain_stats.funded_txo_sum -= vin.prevout.value;
          } else {
            address.mempool_stats.funded_txo_count--;
            address.mempool_stats.funded_txo_sum -= vin.prevout.value;
          }
        }
      });
      transaction.vout.forEach((vout) => {
        match = true;
        if (vout?.scriptpubkey_address === address.address) {
          this.received -= vout.value;
        }
        if (transaction.status?.confirmed) {
          address.chain_stats.spent_txo_count--;
          address.chain_stats.spent_txo_sum -= vout.value;
        } else {
          address.mempool_stats.spent_txo_count--;
          address.mempool_stats.spent_txo_sum -= vout.value;
        }
      });
      if (match) {
        if (transaction.status?.confirmed) {
          address.chain_stats.tx_count--;
        } else {
          address.mempool_stats.tx_count--;
        }
      }
    }

    return true;
  }

  loadMore(): void {
    if (this.isLoadingTransactions || this.fullyLoaded) {
      return;
    }
    this.isLoadingTransactions = true;
    this.retryLoadMore = false;

    (this.addresses[0].is_pubkey
        ? this.electrsApiService.getScriptHashesTransactions$(this.addresses.map(address => (address.address.length === 66 ? '21' : '41') + address.address + 'ac'), this.lastTransactionTxId)
        : this.electrsApiService.getAddressesTransactions$(this.addresses.map(address => address.address), this.lastTransactionTxId)
    ).pipe(
      catchError((error) => {
          this.isLoadingTransactions = false;
          this.retryLoadMore = true;
          // In the unlikely event of the txid wasn't found in the mempool anymore and we must reload the page.
          if (error.status === 422) {
            window.location.reload();
          }
          return of([]);
      })
    ).subscribe((transactions: Transaction[]) => {
      if (transactions && transactions.length) {
        this.lastTransactionTxId = transactions[transactions.length - 1].txid;
        this.transactions = this.transactions.concat(transactions);
      } else {
        this.fullyLoaded = true;
      }
      this.isLoadingTransactions = false;
    });
  }

  normalizeAddress(address: string): string {
    if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}$/.test(address)) {
      return address.toLowerCase();
    } else {
      return address;
    }
  }

  updateChainStats(): void {
    let received = 0;
    let sent = 0;
    let txCount = 0;
    let chainBalance = 0;
    for (const address of this.addresses) {
      received += address.chain_stats.funded_txo_sum + address.mempool_stats.funded_txo_sum;
      sent += address.chain_stats.spent_txo_sum + address.mempool_stats.spent_txo_sum;
      txCount += address.chain_stats.tx_count + address.mempool_stats.tx_count;
      chainBalance += (address.chain_stats.funded_txo_sum - address.chain_stats.spent_txo_sum);
    }
    this.received = received;
    this.sent = sent;
    this.txCount = txCount;
    this.chainBalance = chainBalance;
  }

  ngOnDestroy(): void {
    this.mainSubscription.unsubscribe();
    this.websocketService.stopTrackingAddresses();
    this.wsSubscription.unsubscribe();
  }
}
