import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { switchMap, catchError, map, tap, shareReplay, startWith, scan } from 'rxjs/operators';
import { Address, AddressTxSummary, ChainStats, Transaction } from '@interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';
import { of, Observable, Subscription } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { WalletAddress } from '@interfaces/node-api.interface';
import { OpenGraphService } from '../../services/opengraph.service';
import { WebsocketService } from '../../services/websocket.service';

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
  selector: 'app-wallet-preview',
  templateUrl: './wallet-preview.component.html',
  styleUrls: ['./wallet-preview.component.scss']
})
export class WalletPreviewComponent implements OnInit, OnDestroy {
  network = '';

  addresses: Address[] = [];
  addressStrings: string[] = [];
  walletName: string;
  isLoadingWallet = true;
  wallet$: Observable<Record<string, WalletAddress>>;
  walletAddresses$: Observable<Record<string, Address>>;
  walletSummary$: Observable<AddressTxSummary[]>;
  walletStats$: Observable<WalletStats>;
  error: any;
  walletSubscription: Subscription;

  collapseAddresses: boolean = true;

  fullyLoaded = false;
  txCount = 0;
  received = 0;
  sent = 0;
  chainBalance = 0;

  ogSession: number;

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private apiService: ApiService,
    private seoService: SeoService,
    private websocketService: WebsocketService,
    private openGraphService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'stats']);
    this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.wallet$ = this.route.paramMap.pipe(
      map((params: ParamMap) => params.get('wallet') as string),
      tap((walletName: string) => {
        this.walletName = walletName;
        this.ogSession = this.openGraphService.waitFor('wallet-addresses-' + this.walletName);
        this.ogSession = this.openGraphService.waitFor('wallet-data-' + this.walletName);
        this.ogSession = this.openGraphService.waitFor('wallet-txs-' + this.walletName);
        this.seoService.setTitle($localize`:@@wallet.component.browser-title:Wallet: ${walletName}:INTERPOLATION:`);
        this.seoService.setDescription($localize`:@@meta.description.bitcoin.wallet:See mempool transactions, confirmed transactions, balance, and more for ${this.stateService.network==='liquid'||this.stateService.network==='liquidtestnet'?'Liquid':'Bitcoin'}${seoDescriptionNetwork(this.stateService.network)} wallet ${walletName}:INTERPOLATION:.`);
      }),
      switchMap((walletName: string) => this.apiService.getWallet$(walletName).pipe(
        catchError((err) => {
          this.error = err;
          this.seoService.logSoft404();
          console.log(err);
          this.openGraphService.fail({ event: 'wallet-addresses-' + this.walletName, sessionId: this.ogSession });
          this.openGraphService.fail({ event: 'wallet-data-' + this.walletName, sessionId: this.ogSession });
          this.openGraphService.fail({ event: 'wallet-txs-' + this.walletName, sessionId: this.ogSession });
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
      tap(() => {
        this.isLoadingWallet = false;
      })
    );

    this.walletSubscription = this.walletAddresses$.subscribe(wallet => {
      this.addressStrings = Object.keys(wallet);
      this.addresses = Object.values(wallet);
      this.openGraphService.waitOver({ event: 'wallet-addresses-' + this.walletName, sessionId: this.ogSession });
    });

    this.walletSummary$ = this.wallet$.pipe(
      map(wallet => this.deduplicateWalletTransactions(Object.values(wallet).flatMap(address => address.transactions))),
      tap(() => {
        this.openGraphService.waitOver({ event: 'wallet-txs-' + this.walletName, sessionId: this.ogSession });
      })
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
      }),
      tap(() => {
        this.openGraphService.waitOver({ event: 'wallet-data-' + this.walletName, sessionId: this.ogSession });
      })
    );
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
    this.walletSubscription.unsubscribe();
  }
}
