import { Component, OnInit, Input, ChangeDetectionStrategy, OnChanges, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { StateService } from '../../services/state.service';
import { CacheService } from '../../services/cache.service';
import { Observable, ReplaySubject, BehaviorSubject, merge, Subscription } from 'rxjs';
import { Outspend, Transaction, Vin, Vout } from '../../interfaces/electrs.interface';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { environment } from '../../../environments/environment';
import { AssetsService } from '../../services/assets.service';
import { filter, map, tap, switchMap } from 'rxjs/operators';
import { BlockExtended } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { PriceService } from 'src/app/services/price.service';

@Component({
  selector: 'app-transactions-list',
  templateUrl: './transactions-list.component.html',
  styleUrls: ['./transactions-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransactionsListComponent implements OnInit, OnChanges {
  network = '';
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
  showMoreIncrement = 1000;

  @Input() transactions: Transaction[];
  @Input() showConfirmations = false;
  @Input() transactionPage = false;
  @Input() errorUnblinded = false;
  @Input() paginated = false;
  @Input() inputIndex: number;
  @Input() outputIndex: number;
  @Input() address: string = '';
  @Input() rowLimit = 12;

  @Output() loadMore = new EventEmitter();

  latestBlock$: Observable<BlockExtended>;
  outspendsSubscription: Subscription;
  refreshOutspends$: ReplaySubject<string[]> = new ReplaySubject();
  refreshChannels$: ReplaySubject<string[]> = new ReplaySubject();
  showDetails$ = new BehaviorSubject<boolean>(false);
  assetsMinimal: any;
  transactionsLength: number = 0;
  inputRowLimit: number = 12;
  outputRowLimit: number = 12;

  constructor(
    public stateService: StateService,
    private cacheService: CacheService,
    private electrsApiService: ElectrsApiService,
    private apiService: ApiService,
    private assetsService: AssetsService,
    private ref: ChangeDetectorRef,
    private priceService: PriceService,
  ) { }

  ngOnInit(): void {
    this.latestBlock$ = this.stateService.blocks$.pipe(map(([block]) => block));
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      this.assetsService.getAssetsMinimalJson$.subscribe((assets) => {
        this.assetsMinimal = assets;
      });
    }

    this.outspendsSubscription = merge(
      this.refreshOutspends$
        .pipe(
          switchMap((txIds) => this.apiService.getOutspendsBatched$(txIds)),
          tap((outspends: Outspend[][]) => {
            if (!this.transactions) {
              return;
            }
            const transactions = this.transactions.filter((tx) => !tx._outspends);
            outspends.forEach((outspend, i) => {
              transactions[i]._outspends = outspend;
            });
          }),
        ),
      this.stateService.utxoSpent$
        .pipe(
          tap((utxoSpent) => {
            for (const i in utxoSpent) {
              this.transactions[0]._outspends[i] = {
                spent: true,
                txid: utxoSpent[i].txid,
                vin: utxoSpent[i].vin,
              };
            }
          }),
        ),
        this.refreshChannels$
          .pipe(
            filter(() => this.stateService.env.LIGHTNING),
            switchMap((txIds) => this.apiService.getChannelByTxIds$(txIds)),
            tap((channels) => {
              if (!this.transactions) {
                return;
              }
              const transactions = this.transactions.filter((tx) => !tx._channels);
              channels.forEach((channel, i) => {
                transactions[i]._channels = channel;
              });
            }),
          )
        ,
    ).subscribe(() => this.ref.markForCheck());
  }

  ngOnChanges(changes): void {
    if (changes.inputIndex || changes.outputIndex || changes.rowLimit) {
      this.inputRowLimit = Math.max(this.rowLimit, (this.inputIndex || 0) + 3);
      this.outputRowLimit = Math.max(this.rowLimit, (this.outputIndex || 0) + 3);
      if ((this.inputIndex || this.outputIndex) && !changes.transactions) {
        setTimeout(() => {
          const assetBoxElements = document.getElementsByClassName('assetBox');
          if (assetBoxElements && assetBoxElements[0]) {
            assetBoxElements[0].scrollIntoView({block: "center"});
          }
        }, 10);
      }
    }
    if (changes.transactions || changes.address) {
      if (!this.transactions || !this.transactions.length) {
        return;
      }

      this.transactionsLength = this.transactions.length;
      this.cacheService.setTxCache(this.transactions);

      this.transactions.forEach((tx) => {
        tx['@voutLimit'] = true;
        tx['@vinLimit'] = true;
        if (tx['addressValue'] !== undefined) {
          return;
        }

        if (this.address) {
          const addressIn = tx.vout
            .filter((v: Vout) => v.scriptpubkey_address === this.address)
            .map((v: Vout) => v.value || 0)
            .reduce((a: number, b: number) => a + b, 0);

          const addressOut = tx.vin
            .filter((v: Vin) => v.prevout && v.prevout.scriptpubkey_address === this.address)
            .map((v: Vin) => v.prevout.value || 0)
            .reduce((a: number, b: number) => a + b, 0);

          tx['addressValue'] = addressIn - addressOut;
        }

        this.priceService.getPrices().pipe(
          tap(() => {
            tx['price'] = this.priceService.getPriceForTimestamp(tx.status.block_time);
          })
        ).subscribe();
      });
      const txIds = this.transactions.filter((tx) => !tx._outspends).map((tx) => tx.txid);
      if (txIds.length) {
        this.refreshOutspends$.next(txIds);
      }
      if (this.stateService.env.LIGHTNING) {
        const txIds = this.transactions.filter((tx) => !tx._channels).map((tx) => tx.txid);
        if (txIds.length) {
          this.refreshChannels$.next(txIds);
        }
      }
    }
  }

  onScroll(): void {
    const scrollHeight = document.body.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    if (scrollHeight > 0){
      const percentageScrolled = scrollTop * 100 / scrollHeight;
      if (percentageScrolled > 70){
        this.loadMore.emit();
      }
    }
  }

  haveBlindedOutputValues(tx: Transaction): boolean {
    return tx.vout.some((v: any) => v.value === undefined);
  }

  getTotalTxOutput(tx: Transaction): number {
    return tx.vout.map((v: Vout) => v.value || 0).reduce((a: number, b: number) => a + b);
  }

  switchCurrency(): void {
    if (this.network === 'liquid' || this.network === 'liquidtestnet') {
      return;
    }
    const oldvalue = !this.stateService.viewFiat$.value;
    this.stateService.viewFiat$.next(oldvalue);
  }

  trackByFn(index: number, tx: Transaction): string {
    return tx.txid + tx.status.confirmed;
  }

  trackByIndexFn(index: number): number {
    return index;
  }

  formatHex(num: number): string {
    const str = num.toString(16);
    return '0x' + (str.length % 2 ? '0' : '') + str;
  }

  pow(base: number, exponent: number): number {
    return Math.pow(base, exponent);
  }

  toggleDetails(): void {
    if (this.showDetails$.value === true) {
      this.showDetails$.next(false);
    } else {
      this.showDetails$.next(true);
    }
  }

  loadMoreInputs(tx: Transaction): void {
    if (!tx['@vinLoaded']) {
      this.electrsApiService.getTransaction$(tx.txid)
        .subscribe((newTx) => {
          tx['@vinLoaded'] = true;
          tx.vin = newTx.vin;
          tx.fee = newTx.fee;
          this.ref.markForCheck();
        });
    }
  }

  showMoreInputs(tx: Transaction): void {
    this.loadMoreInputs(tx);
    tx['@vinLimit'] = this.getVinLimit(tx, true);
  }

  showMoreOutputs(tx: Transaction): void {
    tx['@voutLimit'] = this.getVoutLimit(tx, true);
  }

  getVinLimit(tx: Transaction, next = false): number {
    let limit;
    if ((tx['@vinLimit'] || 0) > this.inputRowLimit) {
      limit = Math.min(tx['@vinLimit'] + (next ? this.showMoreIncrement : 0), tx.vin.length);
    } else {
      limit = Math.min((next ? this.showMoreIncrement : this.inputRowLimit), tx.vin.length);
    }
    if (tx.vin.length - limit <= 5) {
      limit = tx.vin.length;
    }
    return limit;
  }

  getVoutLimit(tx: Transaction, next = false): number {
    let limit;
    if ((tx['@voutLimit'] || 0) > this.outputRowLimit) {
      limit = Math.min(tx['@voutLimit'] + (next ? this.showMoreIncrement : 0), tx.vout.length);
    } else {
      limit = Math.min((next ? this.showMoreIncrement : this.outputRowLimit), tx.vout.length);
    }
    if (tx.vout.length - limit <= 5) {
      limit = tx.vout.length;
    }
    return limit;
  }

  ngOnDestroy(): void {
    this.outspendsSubscription.unsubscribe();
  }
}
