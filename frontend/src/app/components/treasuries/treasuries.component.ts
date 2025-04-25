import { Component, OnInit, OnDestroy } from '@angular/core';
import { Observable, combineLatest, of, Subscription } from 'rxjs';
import { AddressTxSummary, Transaction, Address } from '@interfaces/electrs.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { catchError, map, scan, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { WalletStats } from '@app/shared/wallet-stats';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-treasuries',
  templateUrl: './treasuries.component.html',
  styleUrls: ['./treasuries.component.scss']
})
export class TreasuriesComponent implements OnInit, OnDestroy {
  wallets: string[] = [];
  walletSummaries$: Observable<Record<string, AddressTxSummary[]>>;
  selectedWallets: Record<string, boolean> = {};
  isLoading = true;
  error: any;
  walletSubscriptions: Subscription[] = [];
  currentSortedWallets: string[] = [];

  // Individual wallet data
  walletObservables: Record<string, Observable<Record<string, any>>> = {};
  walletAddressesObservables: Record<string, Observable<Record<string, Address>>> = {};
  individualWalletSummaries: Record<string, Observable<AddressTxSummary[]>> = {};
  walletStatsObservables: Record<string, Observable<WalletStats>> = {};
  walletStats$: Observable<Record<string, WalletStats>>;
  sortedWallets$: Observable<string[]>;

  constructor(
    private apiService: ApiService,
    private stateService: StateService,
    private electrsApiService: ElectrsApiService,
    private router: Router,
  ) {}

  ngOnInit() {
    // Fetch the list of wallets from the API
    this.apiService.getWallets$().pipe(
      catchError(err => {
        console.error('Error loading wallets list:', err);
        return of([]);
      })
    ).subscribe(wallets => {
      this.wallets = wallets;

      // Initialize all wallets as enabled by default
      this.wallets.forEach(wallet => {
        this.selectedWallets[wallet] = true;
      });

      // Set up wallet data after we have the wallet list
      this.setupWalletData();
    });
  }

  private setupWalletData() {
    this.wallets.forEach(walletName => {
      this.walletObservables[walletName] = this.apiService.getWallet$(walletName).pipe(
        catchError((err) => {
          console.log(`Error loading wallet ${walletName}:`, err);
          return of({});
        }),
        shareReplay(1),
      );

      this.walletAddressesObservables[walletName] = this.walletObservables[walletName].pipe(
        map(wallet => {
          const walletInfo: Record<string, Address> = {};
          for (const address of Object.keys(wallet || {})) {
            walletInfo[address] = {
              address,
              chain_stats: wallet[address]?.stats || {
                funded_txo_count: 0,
                funded_txo_sum: 0,
                spent_txo_count: 0,
                spent_txo_sum: 0,
                tx_count: 0
              },
              mempool_stats: {
                funded_txo_count: 0,
                funded_txo_sum: 0,
                spent_txo_count: 0, 
                spent_txo_sum: 0, 
                tx_count: 0
              },
            };
          }
          return walletInfo;
        }),
        switchMap(initial => this.stateService.walletTransactions$.pipe(
          startWith(null),
          scan((wallet, walletTransactions) => {
            for (const tx of (walletTransactions || [])) {
              const funded: Record<string, number> = {};
              const spent: Record<string, number> = {};
              const fundedCount: Record<string, number> = {};
              const spentCount: Record<string, number> = {};
              for (const vin of tx.vin || []) {
                const address = vin.prevout?.scriptpubkey_address;
                if (address && wallet[address]) {
                  spent[address] = (spent[address] ?? 0) + (vin.prevout?.value ?? 0);
                  spentCount[address] = (spentCount[address] ?? 0) + 1;
                }
              }
              for (const vout of tx.vout || []) {
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
      );

      this.individualWalletSummaries[walletName] = this.walletObservables[walletName].pipe(
        switchMap(wallet => this.stateService.walletTransactions$.pipe(
          startWith([]),
          scan((summaries, newTransactions: Transaction[]) => {
            const newSummaries: AddressTxSummary[] = [];
            for (const tx of newTransactions || []) {
              const funded: Record<string, number> = {};
              const spent: Record<string, number> = {};
              const fundedCount: Record<string, number> = {};
              const spentCount: Record<string, number> = {};
              for (const vin of tx.vin || []) {
                const address = vin.prevout?.scriptpubkey_address;
                if (address && wallet[address]) {
                  spent[address] = (spent[address] ?? 0) + (vin.prevout?.value ?? 0);
                  spentCount[address] = (spentCount[address] ?? 0) + 1;
                }
              }
              for (const vout of tx.vout || []) {
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
                if (wallet[address]?.transactions) {
                  wallet[address].transactions.push(txSummary);
                } else if (wallet[address]) {
                  wallet[address].transactions = [txSummary];
                }
                newSummaries.push(txSummary);
              }
            }
            return this.deduplicateWalletTransactions([...summaries, ...newSummaries]);
          }, this.deduplicateWalletTransactions(
            Object.values(wallet || {}).flatMap(address => address?.transactions || [])
          ))
        ))
      );

      this.walletStatsObservables[walletName] = this.walletObservables[walletName].pipe(
        switchMap(wallet => {
          const walletStats = new WalletStats(
            Object.values(wallet || {}).map(w => w?.stats || {}),
            Object.keys(wallet || {})
          );
          return of(walletStats);
        })
      );
    });

    const walletSummaryKeys = Object.keys(this.individualWalletSummaries);
    const walletSummaryObservables = walletSummaryKeys.map(key => this.individualWalletSummaries[key]);

    this.walletSummaries$ = combineLatest(walletSummaryObservables).pipe(
      map((summaries) => {
        const result: Record<string, AddressTxSummary[]> = {};
        summaries.forEach((summary, index) => {
          if (summary && summary.length > 0) {
            result[walletSummaryKeys[index]] = summary;
          }
        });
        return result;
      }),
      tap((data) => {
        this.selectedWallets = {};
        Object.keys(data).forEach(wallet => {
          this.selectedWallets[wallet] = true;
        });
        this.isLoading = false;
      }),
      shareReplay(1),
      catchError(err => {
        this.error = err;
        console.log(err);
        return of({});
      })
    );

    const walletStatsKeys = Object.keys(this.walletStatsObservables);
    const walletStatsObservables = walletStatsKeys.map(key => this.walletStatsObservables[key]);

    this.walletStats$ = combineLatest(walletStatsObservables).pipe(
      map((stats) => {
        const result: Record<string, WalletStats> = {};
        stats.forEach((stat, index) => {
          result[walletStatsKeys[index]] = stat;
        });
        return result;
      }),
      shareReplay(1),
      catchError(err => {
        this.error = err;
        console.log(err);
        return of({});
      })
    );

    this.sortedWallets$ = this.walletStats$.pipe(
      map(walletStats => {
        return [...this.wallets].sort((a, b) => {
          const balanceA = walletStats[a]?.balance || 0;
          const balanceB = walletStats[b]?.balance || 0;
          return balanceB - balanceA;
        });
      }),
      tap(sortedWallets => {
        // Update selectedWallets to maintain the same order
        const newSelectedWallets: Record<string, boolean> = {};
        sortedWallets.forEach(wallet => {
          newSelectedWallets[wallet] = this.selectedWallets[wallet] ?? true;
        });
        this.selectedWallets = newSelectedWallets;
        this.currentSortedWallets = sortedWallets;
      })
    );
  }

  private deduplicateWalletTransactions(walletTransactions: AddressTxSummary[]): AddressTxSummary[] {
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
        return (b.tx_position ?? 0) - (a.tx_position ?? 0);
      }
      return b.height - a.height;
    });
  }

  getWalletColor(wallet: string): string {
    // Use a consistent color for each wallet based on its position in the sorted list
    const colors = [
      '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
    ];
    const index = this.currentSortedWallets.indexOf(wallet);
    return colors[index % colors.length];
  }

  navigateToWallet(wallet: string): void {
    this.router.navigate(['/wallet', wallet]);
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.walletSubscriptions.forEach(sub => {
      if (sub) {
        sub.unsubscribe();
      }
    });
  }
}
