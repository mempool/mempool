import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { switchMap, filter, catchError, map, tap } from 'rxjs/operators';
import { Address, ChainStats, Transaction, Utxo, Vin } from '@interfaces/electrs.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { ApiService } from '@app/services/api.service';
import { of, merge, Subscription, Observable, forkJoin } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { AddressInformation } from '@interfaces/node-api.interface';
import { AddressTypeInfo } from '@app/shared/address-utils';

class AddressStats implements ChainStats {
  address: string;
  scriptpubkey?: string;
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;

  constructor (stats: ChainStats, address: string, scriptpubkey?: string) {
    Object.assign(this, stats);
    this.address = address;
    this.scriptpubkey = scriptpubkey;
  }

  public addTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (vin.prevout?.scriptpubkey_address === this.address || (this.scriptpubkey === vin.prevout?.scriptpubkey)) {
        this.spendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (vout.scriptpubkey_address === this.address || (this.scriptpubkey === vout.scriptpubkey)) {
        this.fundTxo(vout.value);
      }
    }
    this.tx_count++;
  }

  public removeTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (vin.prevout?.scriptpubkey_address === this.address || (this.scriptpubkey === vin.prevout?.scriptpubkey)) {
        this.unspendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (vout.scriptpubkey_address === this.address || (this.scriptpubkey === vout.scriptpubkey)) {
        this.unfundTxo(vout.value);
      }
    }
    this.tx_count--;
  }

  private fundTxo(value: number): void {
    this.funded_txo_sum += value;
    this.funded_txo_count++;
  }

  private unfundTxo(value: number): void {
    this.funded_txo_sum -= value;
    this.funded_txo_count--;
  }

  private spendTxo(value: number): void {
    this.spent_txo_sum += value;
    this.spent_txo_count++;
  }

  private unspendTxo(value: number): void {
    this.spent_txo_sum -= value;
    this.spent_txo_count--;
  }

  get balance(): number {
    return this.funded_txo_sum - this.spent_txo_sum;
  }

  get totalReceived(): number {
    return this.funded_txo_sum;
  }

  get utxos(): number {
    return this.funded_txo_count - this.spent_txo_count;
  }
}

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss']
})
export class AddressComponent implements OnInit, OnDestroy {
  network = '';

  isMobile: boolean;
  showQR: boolean = false;

  address: Address;
  addressString: string;
  isLoadingAddress = true;
  transactions: Transaction[];
  utxos: Utxo[];
  isLoadingTransactions = true;
  retryLoadMore = false;
  error: any;
  mainSubscription: Subscription;
  mempoolTxSubscription: Subscription;
  mempoolRemovedTxSubscription: Subscription;
  blockTxSubscription: Subscription;
  addressLoadingStatus$: Observable<number>;
  addressInfo: null | AddressInformation = null;
  addressTypeInfo: null | AddressTypeInfo;

  fullyLoaded = false;
  chainStats: AddressStats;
  mempoolStats: AddressStats;

  exampleChannel?: any;

  now = Date.now() / 1000;
  balancePeriod: 'all' | '1m' = 'all';

  private tempTransactions: Transaction[];
  private timeTxIndexes: number[];
  private lastTransactionTxId: string;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.websocketService.want(['blocks']);

    this.onResize();

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
          this.fullyLoaded = false;
          this.address = null;
          this.isLoadingTransactions = true;
          this.transactions = null;
          this.utxos = null;
          this.addressInfo = null;
          this.exampleChannel = null;
          document.body.scrollTo(0, 0);
          this.addressString = params.get('id') || '';
          if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}$/.test(this.addressString)) {
            this.addressString = this.addressString.toLowerCase();
          }
          this.seoService.setTitle($localize`:@@address.component.browser-title:Address: ${this.addressString}:INTERPOLATION:`);
          this.seoService.setDescription($localize`:@@meta.description.bitcoin.address:See mempool transactions, confirmed transactions, balance, and more for ${this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet'?'Liquid':'Bitcoin'}${seoDescriptionNetwork(this.stateService.network)} address ${this.addressString}:INTERPOLATION:.`);

          this.addressTypeInfo = new AddressTypeInfo(this.stateService.network || 'mainnet', this.addressString);

          return merge(
            of(true),
            this.stateService.connectionState$
              .pipe(filter((state) => state === 2 && this.transactions && this.transactions.length > 0))
          )
          .pipe(
            switchMap(() => (
              this.addressString.match(/04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}/)
              ? this.electrsApiService.getPubKeyAddress$(this.addressString)
              : this.electrsApiService.getAddress$(this.addressString)
            ).pipe(
                catchError((err) => {
                  this.isLoadingAddress = false;
                  this.error = err;
                  this.seoService.logSoft404();
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
        tap((address: Address) => {
          if ((this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet') && /^([a-zA-HJ-NP-Z1-9]{26,35}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,100}|[a-km-zA-HJ-NP-Z1-9]{80})$/.test(address.address)) {
            this.apiService.validateAddress$(address.address)
              .subscribe((addressInfo) => {
                this.addressInfo = addressInfo;
                this.websocketService.startTrackAddress(addressInfo.unconfidential);
              });
          } else {
            this.websocketService.startTrackAddress(address.address);
          }
        }),
        switchMap((address) => {
          this.address = address;
          this.updateChainStats();
          this.isLoadingAddress = false;
          this.isLoadingTransactions = true;
          const utxoCount = this.chainStats.utxos + this.mempoolStats.utxos;
          return forkJoin([
            address.is_pubkey
              ? this.electrsApiService.getScriptHashTransactions$((address.address.length === 66 ? '21' : '41') + address.address + 'ac')
              : this.electrsApiService.getAddressTransactions$(address.address),
            (utxoCount > 2 && utxoCount <= 500 ? (address.is_pubkey
              ? this.electrsApiService.getScriptHashUtxos$((address.address.length === 66 ? '21' : '41') + address.address + 'ac')
              : this.electrsApiService.getAddressUtxos$(address.address)) : of(null)).pipe(
                catchError(() => {
                  return of(null);
                })
              )
          ]);
        }),
        switchMap(([transactions, utxos]) => {
          this.utxos = utxos;

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
        if (this.transactions.length === (this.mempoolStats.tx_count + this.chainStats.tx_count)) {
          this.fullyLoaded = true;
        }
        this.isLoadingTransactions = false;

        let addressVin: Vin[] = [];
        for (const tx of this.transactions) {
          addressVin = addressVin.concat(tx.vin.filter(v => v.prevout?.scriptpubkey_address === this.address.address));
        }
        this.addressTypeInfo.processInputs(addressVin);
        // hack to trigger change detection
        this.addressTypeInfo = this.addressTypeInfo.clone();

        if (!this.showBalancePeriod()) {
          this.setBalancePeriod('all');
        } else {
          this.setBalancePeriod('1m');
        }
      },
      (error) => {
        console.log(error);
        this.error = error;
        this.seoService.logSoft404();
        this.isLoadingAddress = false;
      });

    this.mempoolTxSubscription = this.stateService.mempoolTransactions$
      .subscribe(tx => {
        this.addTransaction(tx);
        this.mempoolStats.addTx(tx);
      });

    this.mempoolRemovedTxSubscription = this.stateService.mempoolRemovedTransactions$
      .subscribe(tx => {
        this.removeTransaction(tx);
        this.mempoolStats.removeTx(tx);
      });

    this.blockTxSubscription = this.stateService.blockTransactions$
      .subscribe((transaction) => {
        const tx = this.transactions.find((t) => t.txid === transaction.txid);
        if (tx) {
          tx.status = transaction.status;
          this.transactions = this.transactions.slice();
          this.mempoolStats.removeTx(transaction);
          this.audioService.playSound('magic');
          this.confirmTransaction(tx);
        } else {
          if (this.addTransaction(transaction, false)) {
            this.audioService.playSound('magic');
          }
        }
        this.chainStats.addTx(transaction);
      });
  }

  addTransaction(transaction: Transaction, playSound: boolean = true): boolean {
    if (this.transactions.some((t) => t.txid === transaction.txid)) {
      return false;
    }

    this.transactions.unshift(transaction);
    this.transactions = this.transactions.slice();

    if (playSound) {
      if (transaction.vout.some((vout) => vout?.scriptpubkey_address === this.address.address)) {
        this.audioService.playSound('cha-ching');
      } else {
        this.audioService.playSound('chime');
      }
    }

    // update utxos in-place
    if (this.utxos != null) {
      let utxosChanged = false;
      for (const vin of transaction.vin) {
        const utxoIndex = this.utxos.findIndex((utxo) => utxo.txid === vin.txid && utxo.vout === vin.vout);
        if (utxoIndex !== -1) {
          this.utxos.splice(utxoIndex, 1);
          utxosChanged = true;
        }
      }
      for (const [index, vout] of transaction.vout.entries()) {
        if (vout.scriptpubkey_address === this.address.address) {
          this.utxos.push({
            txid: transaction.txid,
            vout: index,
            value: vout.value,
            status: JSON.parse(JSON.stringify(transaction.status)),
          });
          utxosChanged = true;
        }
      }
      if (utxosChanged) {
        this.utxos = this.utxos.slice();
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

    // update utxos in-place
    if (this.utxos != null) {
      let utxosChanged = false;
      for (const vin of transaction.vin) {
        if (vin.prevout?.scriptpubkey_address === this.address.address) {
          this.utxos.push({
            txid: vin.txid,
            vout: vin.vout,
            value: vin.prevout.value,
            status: { confirmed: true }, // Assuming the input was confirmed
          });
          utxosChanged = true;
        }
      }
      for (const [index, vout] of transaction.vout.entries()) {
        if (vout.scriptpubkey_address === this.address.address) {
          const utxoIndex = this.utxos.findIndex((utxo) => utxo.txid === transaction.txid && utxo.vout === index);
          if (utxoIndex !== -1) {
            this.utxos.splice(utxoIndex, 1);
            utxosChanged = true;
          }
        }
      }
      if (utxosChanged) {
        this.utxos = this.utxos.slice();
      }
    }

    return true;
  }

  confirmTransaction(transaction: Transaction): void {
    // update utxos in-place
    if (this.utxos != null) {
      let utxosChanged = false;
      for (const vin of transaction.vin) {
        if (vin.prevout?.scriptpubkey_address === this.address.address) {
          const utxoIndex = this.utxos.findIndex((utxo) => utxo.txid === vin.txid && utxo.vout === vin.vout);
          if (utxoIndex !== -1) {
            this.utxos[utxoIndex].status = JSON.parse(JSON.stringify(transaction.status));
            utxosChanged = true;
          }
        }
      }
      for (const [index, vout] of transaction.vout.entries()) {
        if (vout.scriptpubkey_address === this.address.address) {
          const utxoIndex = this.utxos.findIndex((utxo) => utxo.txid === transaction.txid && utxo.vout === index);
          if (utxoIndex !== -1) {
            this.utxos[utxoIndex].status = JSON.parse(JSON.stringify(transaction.status));
            utxosChanged = true;
          }
        }
      }
      if (utxosChanged) {
        this.utxos = this.utxos.slice();
      }
    }
  }

  loadMore(): void {
    if (this.isLoadingTransactions || this.fullyLoaded) {
      return;
    }
    this.isLoadingTransactions = true;
    this.retryLoadMore = false;
    (this.address.is_pubkey
    ? this.electrsApiService.getScriptHashTransactions$((this.address.address.length === 66 ? '21' : '41') + this.address.address + 'ac', this.lastTransactionTxId)
    : this.electrsApiService.getAddressTransactions$(this.address.address, this.lastTransactionTxId))
      .subscribe((transactions: Transaction[]) => {
        if (transactions && transactions.length) {
          this.lastTransactionTxId = transactions[transactions.length - 1].txid;
          this.transactions = this.transactions.concat(transactions);
        } else {
          this.fullyLoaded = true;
        }
        this.isLoadingTransactions = false;
      },
      (error) => {
        this.isLoadingTransactions = false;
        this.retryLoadMore = true;
        // In the unlikely event of the txid wasn't found in the mempool anymore and we must reload the page.
        if (error.status === 422) {
          window.location.reload();
        }
      });
  }

  updateChainStats(): void {
    this.chainStats = new AddressStats(this.address.chain_stats, this.address.address);
    this.mempoolStats = new AddressStats(this.address.mempool_stats, this.address.address);
  }

  setBalancePeriod(period: 'all' | '1m'): boolean {
    this.balancePeriod = period;
    return false;
  }

  showBalancePeriod(): boolean {
    return this.transactions?.length && (
      !this.transactions[0].status?.confirmed
      || this.transactions[0].status.block_time > (this.now - (60 * 60 * 24 * 30))
    );
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  ngOnDestroy(): void {
    this.mainSubscription.unsubscribe();
    this.mempoolTxSubscription.unsubscribe();
    this.mempoolRemovedTxSubscription.unsubscribe();
    this.blockTxSubscription.unsubscribe();
    this.websocketService.stopTrackingAddress();
  }
}
