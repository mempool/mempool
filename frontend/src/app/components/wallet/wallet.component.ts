import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, catchError, map, tap, shareReplay, startWith, scan } from 'rxjs/operators';
import { Address, AddressTxSummary, ChainStats, Transaction } from '@interfaces/electrs.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';
import { of, Observable, Subscription } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { WalletAddress } from '@interfaces/node-api.interface';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { AudioService } from '@app/services/audio.service';

class WalletStats implements ChainStats {
  addresses: string[];
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;

  constructor (stats: ChainStats[], addresses: string[]) {
    Object.assign(this, stats.reduce((acc, stat) => {
        acc.funded_txo_count += stat.funded_txo_count;
        acc.funded_txo_sum += stat.funded_txo_sum;
        acc.spent_txo_count += stat.spent_txo_count;
        acc.spent_txo_sum += stat.spent_txo_sum;
        acc.tx_count += stat.tx_count;
        return acc;
      }, {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 0,
      })
    );
    this.addresses = addresses;
  }

  public addTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (this.addresses.includes(vin.prevout?.scriptpubkey_address)) {
        this.spendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (this.addresses.includes(vout.scriptpubkey_address)) {
        this.fundTxo(vout.value);
      }
    }
    this.tx_count++;
  }

  public removeTx(tx: Transaction): void {
    for (const vin of tx.vin) {
      if (this.addresses.includes(vin.prevout?.scriptpubkey_address)) {
        this.unspendTxo(vin.prevout.value);
      }
    }
    for (const vout of tx.vout) {
      if (this.addresses.includes(vout.scriptpubkey_address)) {
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
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss']
})
export class WalletComponent implements OnInit, OnDestroy {
  network = '';

  addresses: Address[] = [];
  addressStrings: string[] = [];
  walletName: string;
  isLoadingWallet = true;
  isLoadingTransactions = true;
  transactions: Transaction[];
  totalTransactionCount: number;
  retryLoadMore = false;
  wallet$: Observable<Record<string, WalletAddress>>;
  walletAddresses$: Observable<Record<string, Address>>;
  walletSummary$: Observable<AddressTxSummary[]>;
  walletStats$: Observable<WalletStats>;
  error: any;
  walletSubscription: Subscription;
  transactionSubscription: Subscription;

  collapseAddresses: boolean = true;

  fullyLoaded = false;
  txCount = 0;
  received = 0;
  sent = 0;
  chainBalance = 0;

  constructor(
    private route: ActivatedRoute,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private apiService: ApiService,
    private electrsApiService: ElectrsApiService,
    private audioService: AudioService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.websocketService.want(['blocks']);
    this.wallet$ = this.route.paramMap.pipe(
      map((params: ParamMap) => params.get('wallet') as string),
      tap((walletName: string) => {
        this.walletName = walletName;
        this.websocketService.startTrackingWallet(walletName);
        this.seoService.setTitle($localize`:@@wallet.component.browser-title:Wallet: ${walletName}:INTERPOLATION:`);
        this.seoService.setDescription($localize`:@@meta.description.bitcoin.wallet:See mempool transactions, confirmed transactions, balance, and more for ${this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet'?'Liquid':'Bitcoin'}${seoDescriptionNetwork(this.stateService.network)} wallet ${walletName}:INTERPOLATION:.`);
      }),
      switchMap((walletName: string) => this.apiService.getWallet$(walletName).pipe(
        catchError((err) => {
          this.error = err;
          this.seoService.logSoft404();
          console.log(err);
          return of({});
        })
      )),
      shareReplay(1),
    );

    this.walletAddresses$ = this.wallet$.pipe(
      map(wallet => {
        const walletInfo: Record<string, Address> = {};
        for (const address of Object.keys(wallet)) {
          walletInfo[address] = {
            address,
            chain_stats: wallet[address].stats,
            mempool_stats: {
              funded_txo_count: 0,
              funded_txo_sum: 0,
              spent_txo_count: 0, spent_txo_sum: 0, tx_count: 0
            },
          };
        }
        return walletInfo;
      }),
      switchMap(initial => this.stateService.walletTransactions$.pipe(
        startWith(null),
        tap((transactions) => {
          if (!transactions?.length) {
            return;
          }
          for (const transaction of transactions) {
            const tx = this.transactions.find((t) => t.txid === transaction.txid);
            if (tx) {
              tx.status = transaction.status;
            } else {
              this.transactions.unshift(transaction);
            }
          }
          this.transactions = this.transactions.slice();
          this.audioService.playSound('magic');
        }),
        scan((wallet, walletTransactions) => {
          for (const tx of (walletTransactions || [])) {
            const funded: Record<string, number> = {};
            const spent: Record<string, number> = {};
            const fundedCount: Record<string, number> = {};
            const spentCount: Record<string, number> = {};
            for (const vin of tx.vin) {
              const address = vin.prevout?.scriptpubkey_address;
              if (address && wallet[address]) {
                spent[address] = (spent[address] ?? 0) + (vin.prevout?.value ?? 0);
                spentCount[address] = (spentCount[address] ?? 0) + 1;
              }
            }
            for (const vout of tx.vout) {
              const address = vout.scriptpubkey_address;
              if (address && wallet[address]) {
                funded[address] = (funded[address] ?? 0) + (vout.value ?? 0);
                fundedCount[address] = (fundedCount[address] ?? 0) + 1;
              }
            }
            for (const address of Object.keys({ ...funded, ...spent })) {
              // update address stats
              wallet[address].chain_stats.tx_count++;
              wallet[address].chain_stats.funded_txo_count += fundedCount[address] || 0;
              wallet[address].chain_stats.spent_txo_count += spentCount[address] || 0;
              wallet[address].chain_stats.funded_txo_sum += funded[address] || 0;
              wallet[address].chain_stats.spent_txo_sum += spent[address] || 0;
            }
          }
          return wallet;
        }, initial)
      )),
      tap(() => {
        this.isLoadingWallet = false;
      })
    );

    this.walletSubscription = this.walletAddresses$.subscribe(wallet => {
      this.addressStrings = Object.keys(wallet);
      this.addresses = Object.values(wallet);
    });

    this.walletSummary$ = this.wallet$.pipe(
      switchMap(wallet => this.stateService.walletTransactions$.pipe(
        startWith([]),
        scan((summaries, newTransactions) => {
          const newSummaries: AddressTxSummary[] = [];
          for (const tx of newTransactions) {
            const funded: Record<string, number> = {};
            const spent: Record<string, number> = {};
            const fundedCount: Record<string, number> = {};
            const spentCount: Record<string, number> = {};
            for (const vin of tx.vin) {
              const address = vin.prevout?.scriptpubkey_address;
              if (address && wallet[address]) {
                spent[address] = (spent[address] ?? 0) + (vin.prevout?.value ?? 0);
                spentCount[address] = (spentCount[address] ?? 0) + 1;
              }
            }
            for (const vout of tx.vout) {
              const address = vout.scriptpubkey_address;
              if (address && wallet[address]) {
                funded[address] = (funded[address] ?? 0) + (vout.value ?? 0);
                fundedCount[address] = (fundedCount[address] ?? 0) + 1;
              }
            }
            for (const address of Object.keys({ ...funded, ...spent })) {
              // add tx to summary
              const txSummary: AddressTxSummary = {
                txid: tx.txid,
                value: (funded[address] ?? 0) - (spent[address] ?? 0),
                height: tx.status.block_height,
                time: tx.status.block_time,
              };
              wallet[address].transactions?.push(txSummary);
              newSummaries.push(txSummary);
            }
          }
          return this.deduplicateWalletTransactions([...summaries, ...newSummaries]);
        }, this.deduplicateWalletTransactions(Object.values(wallet).flatMap(address => address.transactions)))
      ))
    );

    this.walletStats$ = this.wallet$.pipe(
      switchMap(wallet => {
        const walletStats = new WalletStats(Object.values(wallet).map(w => w.stats), Object.keys(wallet));
        return this.stateService.walletTransactions$.pipe(
          startWith([]),
          scan((stats, newTransactions) => {
            for (const tx of newTransactions) {
              stats.addTx(tx);
            }
            return stats;
          }, walletStats),
        );
      })
    );

    this.transactionSubscription = this.wallet$.pipe(
      switchMap(wallet => {
        const addresses = Object.keys(wallet).map(addr => this.normalizeAddress(addr));
        return this.electrsApiService.getAddressesTransactions$(addresses);
      }),
      map(transactions => {
        // only confirmed transactions supported for now
        return transactions.filter(tx => tx.status.confirmed).sort((a, b) => b.status.block_height - a.status.block_height);
      }),
      catchError((error) => {
        console.log(error);
        this.error = error;
        this.seoService.logSoft404();
        this.isLoadingWallet = false;
        return of([]);
      })
    ).subscribe((transactions: Transaction[] | null) => {
      if (!transactions) {
        return;
      }
      this.transactions = transactions;
      this.isLoadingTransactions = false;
    });
  }

  loadMore(): void {
    if (this.isLoadingTransactions || this.fullyLoaded) {
      return;
    }
    this.isLoadingTransactions = true;
    this.retryLoadMore = false;
    this.electrsApiService.getAddressesTransactions$(this.addressStrings, this.transactions[this.transactions.length - 1].txid)
      .subscribe((transactions: Transaction[]) => {
        if (transactions && transactions.length) {
          this.transactions = this.transactions.concat(transactions.sort((a, b) => b.status.block_height - a.status.block_height));
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

  deduplicateWalletTransactions(walletTransactions: AddressTxSummary[]): AddressTxSummary[] {
    const transactions = new Map<string, AddressTxSummary>();
    for (const tx of walletTransactions) {
      if (transactions.has(tx.txid)) {
        transactions.get(tx.txid).value += tx.value;
      } else {
        transactions.set(tx.txid, tx);
      }
    }
    return Array.from(transactions.values()).sort((a, b) => {
      if (a.height === b.height) {
        return b.tx_position - a.tx_position;
      }
      return b.height - a.height;
    });
  }

  normalizeAddress(address: string): string {
    if (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}$/.test(address)) {
      return address.toLowerCase();
    } else {
      return address;
    }
  }

  ngOnDestroy(): void {
    this.websocketService.stopTrackingWallet();
    this.walletSubscription.unsubscribe();
    this.transactionSubscription.unsubscribe();
  }
}
