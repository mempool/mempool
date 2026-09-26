import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { switchMap, filter, catchError, map, tap, expand, last } from 'rxjs/operators';
import { Address, ChainStats, Transaction, Utxo, Vin } from '@interfaces/electrs.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { ApiService } from '@app/services/api.service';
import { of, merge, Subscription, Observable, forkJoin, Subject, EMPTY } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { AddressInformation } from '@interfaces/node-api.interface';
import { AddressTypeInfo } from '@app/shared/address-utils';
import { extractTapLeaves, fillTapTree, convertTextToBuffer, PsbtKeyValue } from '@app/shared/transaction.utils';
import { HttpResponse } from '@angular/common/http';

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

// Filtered pages are completed client side, since electrs may stop scanning before filling a page
const TX_PAGE_SIZE = 50;
const MAX_SCAN_REQUESTS = 10;

interface TxPage {
  transactions: Transaction[];
  cursor: string;      // after_txid for the next request, empty when there are no more transactions
  truncated: boolean;  // electrs hit its scan limit before filling the page
}

export interface TxFilters {
  direction?: 'incoming' | 'outgoing';
  min?: string;
  max?: string;
  from?: string;
  to?: string;
}

@Component({
  selector: 'app-address',
  templateUrl: './address.component.html',
  styleUrls: ['./address.component.scss'],
  standalone: false,
})
export class AddressComponent implements OnInit, OnDestroy {
  network = '';

  isMobile: boolean;
  showQR: boolean = false;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

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
  fragmentSubscription: Subscription;
  networkChangeSubscription: Subscription;
  taprootFragment: URLSearchParams;
  addressLoadingStatus$: Observable<number>;
  addressInfo: null | AddressInformation = null;
  addressTypeInfo: null | AddressTypeInfo;
  tapTreeIncomplete: boolean = false;
  taprootPsbtExpanded: boolean = false;
  psbtForm: UntypedFormGroup;
  psbtError?: string;
  accelerationsSubscription: Subscription;
  acceleratedTxids: Set<string> | null = null;

  fullyLoaded = false;
  chainStats: AddressStats;
  mempoolStats: AddressStats;

  exampleChannel?: any;

  now = Date.now() / 1000;
  balancePeriod: 'all' | '1m' = 'all';

  filters$: Subject<TxFilters> = new Subject();
  filters: TxFilters;
  filtersSubscription: Subscription;
  loadMoreSubscription: Subscription;
  draftFilters: TxFilters = {};
  showFilters = false;
  rangeMode: 'date' | 'height' = 'date';
  amountUnit: 'sats' | 'btc' = this.stateService.viewAmountMode$.value === 'sats' ? 'sats' : 'btc';
  amountInputs: { min: string, max: string } = { min: '', max: '' };

  private tempTransactions: Transaction[];
  private timeTxIndexes: number[];
  private nextTxCursor: string;

  constructor(
    private route: ActivatedRoute,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    public stateService: StateService,
    private audioService: AudioService,
    private apiService: ApiService,
    private seoService: SeoService,
    private formBuilder: UntypedFormBuilder,
  ) { }

  ngOnInit(): void {
    this.network = this.stateService.network;
    this.networkChangeSubscription = this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
      this.updateAccelerationSubscription();
    });
    this.websocketService.want(['blocks']);
    this.psbtForm = this.formBuilder.group({ psbt: [''], tapleaf: [''], taptree: [''], ikey: [''] });

    this.onResize();
    this.fragmentSubscription = this.route.fragment.subscribe((fragment) => {
      if (fragment) {
        this.taprootFragment = new URLSearchParams(fragment.replace(/\+/g, '%2B')); // URLSearchParams decodes "+" as space, so normalize to preserve base64 fragments
        this.submitPsbt();
      } else {
        this.taprootFragment = undefined;
      }
    });

    this.addressLoadingStatus$ = this.route.paramMap
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['address-' + this.addressString] !== undefined ? indicators['address-' + this.addressString] : 0)
      );

    this.updateAccelerationSubscription();

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
          this.tapTreeIncomplete = false;
          this.taprootPsbtExpanded = false;
          this.psbtForm?.reset({ psbt: '', tapleaf: '', taptree: '', ikey: '' });
          this.psbtError = undefined;
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
          return this.loadFirstPage$();
        })
      )
      .subscribe(
        (times) => this.onTransactionsLoaded(times),
        (error) => this.onTransactionsError(error),
      );

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

    this.filtersSubscription = this.filters$.pipe(
      tap((filters) => {
        this.filters = {
          ...this.filters,
          ...filters
        };
      }),
      switchMap(() => this.loadFirstPage$()),
    ).subscribe(
      (times) => this.onTransactionsLoaded(times),
      (error) => this.onTransactionsError(error),
    );
  }

  // Loads the first page of transactions and utxos, and returns the first seen times of unconfirmed transactions
  private loadFirstPage$(): Observable<number[]> {
    this.loadMoreSubscription?.unsubscribe();
    this.isLoadingTransactions = true;
    this.fullyLoaded = false;
    const utxoCount = this.chainStats.utxos + this.mempoolStats.utxos;
    return forkJoin([
      this.fetchTxPage$(),
      (utxoCount > 2 && utxoCount <= 500 ? (this.address.is_pubkey
        ? this.electrsApiService.getScriptHashUtxos$(this.getPubkeyScript())
        : this.electrsApiService.getAddressUtxos$(this.address.address)) : of(null)).pipe(
          catchError(() => {
            return of(null);
          })
        )
    ]).pipe(
      switchMap(([page, utxos]) => {
        this.utxos = utxos;
        this.tempTransactions = page.transactions;
        this.nextTxCursor = page.cursor;
        this.fullyLoaded = !page.cursor;

        const fetchTxs: string[] = [];
        this.timeTxIndexes = [];
        page.transactions.forEach((tx, index) => {
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
    );
  }

  // Requests pages until it has a full one, electrs finished scanning, or MAX_SCAN_REQUESTS is reached
  private fetchTxPage$(afterTxid?: string): Observable<TxPage> {
    const request$ = (cursor?: string) => (this.address.is_pubkey
      ? this.electrsApiService.getFilteredScriptHashTransactions$(this.getPubkeyScript(), cursor, this.filters)
      : this.electrsApiService.getFilteredAddressTransactions$(this.address.address, cursor, this.filters)
    ).pipe(
      map((response) => this.toTxPage(response)),
    );

    return request$(afterTxid).pipe(
      expand((page, index) => {
        const requestsDone = index + 1;
        if (!page.truncated || page.transactions.length >= TX_PAGE_SIZE || requestsDone >= MAX_SCAN_REQUESTS) {
          return EMPTY;
        }
        return request$(page.cursor).pipe(
          map((nextPage) => ({ ...nextPage, transactions: page.transactions.concat(nextPage.transactions) })),
        );
      }),
      last(),
    );
  }

  // Electrs stops scanning after 10k txs; when it does, the next page must continue from the last scanned tx
  private toTxPage(response: HttpResponse<Transaction[]>): TxPage {
    const transactions = response.body || [];
    const lastScannedTxid = response.headers.get('X-Last-Scanned-Txid');
    // Without a last scanned txid we can't resume the scan, so treat it as a regular page
    const truncated = response.headers.get('X-Scan-Truncated') === 'true' && !!lastScannedTxid;
    return {
      transactions,
      truncated,
      cursor: truncated ? lastScannedTxid : transactions[transactions.length - 1]?.txid,
    };
  }

  private getPubkeyScript(): string {
    return (this.address.address.length === 66 ? '21' : '41') + this.address.address + 'ac';
  }

  private onTransactionsLoaded(times: number[] | null): void {
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

    const addressVin: Vin[] = [];
    const vinIds: string[] = [];
    for (const tx of this.transactions) {
      tx.vin.forEach((v, index) => {
        if (v.prevout?.scriptpubkey_address === this.address.address) {
          addressVin.push(v);
          vinIds.push(`${tx.txid}:${index}`);
        }
      });
    }
    this.addressTypeInfo.processInputs(addressVin, vinIds);
    if (this.addressTypeInfo.type === 'v1_p2tr' && !this.addressTypeInfo.tapscript) {
      this.setTapTreeIncomplete(true);
    }
    // hack to trigger change detection
    this.addressTypeInfo = this.addressTypeInfo.clone();

    if (!this.showBalancePeriod()) {
      this.setBalancePeriod('all');
    } else {
      this.setBalancePeriod('1m');
    }
  }

  private onTransactionsError(error: any): void {
    console.log(error);
    this.error = error;
    this.seoService.logSoft404();
    this.isLoadingAddress = false;
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
    this.loadMoreSubscription = this.fetchTxPage$(this.nextTxCursor)
      .subscribe((page: TxPage) => {
        this.transactions = this.transactions.concat(page.transactions);
        this.nextTxCursor = page.cursor;
        this.fullyLoaded = !page.cursor;
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

  sanitizeFormControl(controlName: string): string {
    const control = this.psbtForm?.get(controlName);
    const sanitized = (control?.value || '').trim();
    if (control && control.value !== sanitized) {
      control.setValue(sanitized, { emitEvent: false });
    }
    return sanitized;
  }

  submitPsbt(): void {
    if (this.psbtForm && this.tapTreeIncomplete) {
      if (this.taprootFragment) { // If pending fragment, apply it first
        const fragment = this.taprootFragment;
        this.taprootFragment = undefined;

        const patch = {};
        ['psbt', 'tapleaf', 'taptree', 'ikey'].forEach((key) => {
          const value = fragment.get(key);
          if (value) {
            patch[key] = value;
          }
        });

        if (Object.keys(patch).length) {
          this.psbtForm.patchValue(patch, { emitEvent: false });
        }
      }

      try {
        const psbt = this.sanitizeFormControl('psbt');
        const tapleavesRaw = this.sanitizeFormControl('tapleaf');
        const taptree = this.sanitizeFormControl('taptree');
        const internalKey = this.sanitizeFormControl('ikey');
        const tapleaves = tapleavesRaw ? tapleavesRaw.split(',').map((leaf) => leaf.trim()).filter(Boolean) : [];

        const hasInput = !!(psbt || tapleaves.length || taptree);
        if (!hasInput) {
          this.psbtError = undefined;
          return;
        }

        const psbtBuffer = psbt ? convertTextToBuffer(psbt) : undefined;
        const tapleafRecords = tapleaves.reduce((records, leaf) => {
          const parts = leaf.split(':');
          if (parts.length !== 2 || !parts[0] || !parts[1]) {
            throw new Error('Tapleaves must be in the format "<control block>:<script><leaf version>" separated by commas');
          }
          records.push({
            keyData: convertTextToBuffer(parts[0]),
            value: convertTextToBuffer(parts[1]),
          });
          return records;
        }, [] as PsbtKeyValue[]);
        const taptreeBuffer = taptree ? convertTextToBuffer(taptree) : undefined;
        const internalKeyBuffer = internalKey ? convertTextToBuffer(internalKey) : undefined;

        const leaves = extractTapLeaves(psbtBuffer, tapleafRecords, taptreeBuffer, internalKeyBuffer);
        fillTapTree(this.addressTypeInfo, leaves);
        this.addressTypeInfo = this.addressTypeInfo.clone();
        this.psbtForm?.reset({ psbt: '', tapleaf: '', taptree: '', ikey: '' });
        this.psbtError = undefined;
      } catch (error) {
        this.taprootPsbtExpanded = true;
        if (error instanceof Error) {
          this.psbtError = error.message;
        } else {
          this.psbtError = 'An error occurred while processing taproot data';
        }
      }
    }
  }

  setTapTreeIncomplete(incomplete: boolean): void {
    if (!incomplete) {
      this.taprootPsbtExpanded = false;
    }
    this.tapTreeIncomplete = incomplete;
    if (this.taprootFragment) {
      this.submitPsbt();
    }
  }

  showTaprootPsbtButton(): boolean {
    const isBitcoin = this.stateService.network !== 'liquid' && this.stateService.network !== 'liquidtestnet';
    return this.addressTypeInfo?.type === 'v1_p2tr' && isBitcoin && this.tapTreeIncomplete;
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.isMobile = window.innerWidth < 768;
  }

  private updateAccelerationSubscription(): void {
    if (this.stateService.env.ACCELERATOR_BUTTON && this.network === '') {
      if (!this.accelerationsSubscription) {
        this.websocketService.ensureTrackAccelerations();
        this.acceleratedTxids = new Set();
        this.accelerationsSubscription = this.stateService.accelerations$.subscribe((delta) => {
          if (!this.acceleratedTxids) {
            this.acceleratedTxids = new Set();
          }
          if (delta.reset) {
            this.acceleratedTxids.clear();
          } else {
            for (const txid of delta.removed) {
              this.acceleratedTxids.delete(txid);
            }
          }
          for (const acceleration of delta.added) {
            this.acceleratedTxids.add(acceleration.txid);
          }
        });
      }
    } else {
      this.accelerationsSubscription?.unsubscribe();
      this.accelerationsSubscription = null;
      this.acceleratedTxids = null;
    }
  }

  setFilters(filters: TxFilters) {
    this.filters$.next(filters);
  }

  hasInvalidFilters(): boolean {
    const isInvalidRange = (lower?: string, upper?: string) => !!lower && !!upper && Number(lower) > Number(upper);
    const { min, max, from, to } = this.draftFilters;
    return isInvalidRange(min, max) || isInvalidRange(from, to);
  }

  applyFilters() {
    if (this.hasPendingFilters() && !this.hasInvalidFilters()) {
      this.setFilters({ ...this.draftFilters });
    }
  }

  setDraftFilter<K extends keyof TxFilters>(key: K, value: TxFilters[K]) {
    this.draftFilters = { ...this.draftFilters, [key]: value };
  }

  hasActiveFilters(): boolean {
    return Object.values(this.filters || {}).some((value) => !!value);
  }

  hasPendingFilters(): boolean {
    const keys: (keyof TxFilters)[] = ['direction', 'min', 'max', 'from', 'to'];
    return keys.some((key) => (this.draftFilters[key] || '') !== (this.filters?.[key] || ''));
  }

  // Amount filters are always stored in sats, the inputs keep what the user typed in the selected unit
  setAmountFilter(key: 'min' | 'max', value: string) {
    this.amountInputs = { ...this.amountInputs, [key]: value };
    const amount = Number(value);
    if (!value || isNaN(amount) || amount < 0) {
      this.setDraftFilter(key, '');
    } else {
      this.setDraftFilter(key, Math.round(this.amountUnit === 'btc' ? amount * 100_000_000 : amount).toString());
    }
  }

  toggleAmountUnit() {
    this.amountUnit = this.amountUnit === 'btc' ? 'sats' : 'btc';
    const toInput = (sats?: string) => {
      if (!sats) {
        return '';
      }
      return this.amountUnit === 'btc' ? (Number(sats) / 100_000_000).toFixed(8).replace(/\.?0+$/, '') : sats;
    };
    this.amountInputs = { min: toInput(this.draftFilters.min), max: toInput(this.draftFilters.max) };
  }

  // The backend treats from/to values below 500M as block heights and the rest as unix timestamps
  toggleRangeMode() {
    this.rangeMode = this.rangeMode === 'date' ? 'height' : 'date';
    this.draftFilters = { ...this.draftFilters, from: '', to: '' };
  }

  setRangeFilter(key: 'from' | 'to', value: string) {
    let filterValue = '';
    if (value && this.rangeMode === 'date') {
      // Include the whole selected day (local time) in the range
      const date = new Date(`${value}T${key === 'from' ? '00:00:00' : '23:59:59'}`);
      if (!isNaN(date.getTime())) {
        filterValue = Math.floor(date.getTime() / 1000).toString();
      }
    } else if (value) {
      const height = parseInt(value, 10);
      if (height >= 0 && height < 500_000_000) {
        filterValue = height.toString();
      }
    }
    this.setDraftFilter(key, filterValue);
  }

  rangeInputValue(key: 'from' | 'to'): string {
    const value = this.draftFilters[key];
    if (!value) {
      return '';
    }
    if (this.rangeMode === 'height') {
      return value;
    }
    const date = new Date(parseInt(value, 10) * 1000);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  resetFilters() {
    this.draftFilters = {};
    this.amountInputs = { min: '', max: '' };
    this.setFilters({ direction: undefined, min: '', max: '', from: '', to: '' });
  }

  ngOnDestroy(): void {
    this.mainSubscription.unsubscribe();
    this.mempoolTxSubscription.unsubscribe();
    this.mempoolRemovedTxSubscription.unsubscribe();
    this.blockTxSubscription.unsubscribe();
    this.websocketService.stopTrackingAddress();
    this.fragmentSubscription?.unsubscribe();
    this.networkChangeSubscription?.unsubscribe();
    this.accelerationsSubscription?.unsubscribe();
    this.websocketService.stopTrackAccelerations();
    this.filtersSubscription?.unsubscribe();
    this.loadMoreSubscription?.unsubscribe();
  }
}
