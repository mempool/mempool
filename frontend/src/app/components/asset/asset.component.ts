import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { switchMap, filter, catchError, take } from 'rxjs/operators';
import { Asset, Transaction } from '@interfaces/electrs.interface';
import { WebsocketService } from '@app/services/websocket.service';
import { StateService } from '@app/services/state.service';
import { AudioService } from '@app/services/audio.service';
import { ApiService } from '@app/services/api.service';
import { of, merge, Subscription, combineLatest } from 'rxjs';
import { SeoService } from '@app/services/seo.service';
import { environment } from '@environments/environment';
import { AssetsService } from '@app/services/assets.service';
import { moveDec } from '@app/bitcoin.utils';

@Component({
  selector: 'app-asset',
  templateUrl: './asset.component.html',
  styleUrls: ['./asset.component.scss']
})
export class AssetComponent implements OnInit, OnDestroy {
  network = '';
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;

  asset: Asset;
  blindedIssuance: boolean;
  assetContract: any;
  assetString: string;
  isLoadingAsset = true;
  transactions: Transaction[];
  isLoadingTransactions = true;
  isNativeAsset = false;
  error: any;
  mainSubscription: Subscription;
  imageError = false;

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
    private seoService: SeoService,
    private assetsService: AssetsService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.stateService.networkChanged$.subscribe((network) => this.network = network);

    this.mainSubscription = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.error = undefined;
          this.imageError = false;
          this.isLoadingAsset = true;
          this.loadedConfirmedTxCount = 0;
          this.asset = null;
          this.assetContract = null;
          this.isLoadingTransactions = true;
          this.transactions = null;
          document.body.scrollTo(0, 0);
          this.assetString = params.get('id') || '';
          this.seoService.setTitle($localize`:@@asset.component.asset-browser-title:Asset: ${this.assetString}:INTERPOLATION:`);

          return merge(
            of(true),
            this.stateService.connectionState$
              .pipe(filter((state) => state === 2 && this.transactions && this.transactions.length > 0))
          )
          .pipe(
            switchMap(() => {
              return combineLatest([this.electrsApiService.getAsset$(this.assetString)
                .pipe(
                  catchError((err) => {
                    this.isLoadingAsset = false;
                    this.error = err;
                    this.seoService.logSoft404();
                    console.log(err);
                    return of(null);
                  })
                ), this.assetsService.getAssetsMinimalJson$])
              .pipe(
                take(1)
              );
            })
          );
        })
      )
      .pipe(
        switchMap(([asset, assetsData]) => {
          this.asset = asset;
          this.assetContract = assetsData[this.asset.asset_id];
          if (!this.assetContract) {
            this.assetContract = [null, '?', 'Unknown', 0];
          }
          this.seoService.setDescription($localize`:@@meta.description.liquid.asset:Browse an overview of the Liquid asset ${this.assetContract[2]}:INTERPOLATION: (${this.assetContract[1]}:INTERPOLATION:): see issued amount, burned amount, circulating amount, related transactions, and more.`);
          this.blindedIssuance = this.asset.chain_stats.has_blinded_issuances || this.asset.mempool_stats.has_blinded_issuances;
          this.isNativeAsset = asset.asset_id === this.nativeAssetId;
          this.updateChainStats();
          this.websocketService.startTrackAsset(asset.asset_id);
          this.isLoadingAsset = false;
          this.isLoadingTransactions = true;
          return this.electrsApiService.getAssetTransactions$(asset.asset_id);
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
        this.isLoadingAsset = false;
      });

    this.stateService.mempoolTransactions$
      .subscribe((transaction) => {
        if (this.transactions.some((t) => t.txid === transaction.txid)) {
          return;
        }

        this.transactions.unshift(transaction);
        this.transactions = this.transactions.slice();
        this.txCount++;

        this.audioService.playSound('chime');
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
    this.electrsApiService.getAssetTransactionsFromHash$(this.asset.asset_id, this.lastTransactionTxId)
      .subscribe((transactions: Transaction[]) => {
        this.lastTransactionTxId = transactions[transactions.length - 1].txid;
        this.loadedConfirmedTxCount += transactions.length;
        this.transactions = this.transactions.concat(transactions);
        this.isLoadingTransactions = false;
      });
  }

  updateChainStats() {
    // this.receieved = this.asset.chain_stats.funded_txo_sum + this.asset.mempool_stats.funded_txo_sum;
    // this.sent = this.asset.chain_stats.spent_txo_sum + this.asset.mempool_stats.spent_txo_sum;
    this.txCount = this.asset.chain_stats.tx_count + this.asset.mempool_stats.tx_count;
    this.totalConfirmedTxCount = this.asset.chain_stats.tx_count;
  }

  formatAmount(value: number, precision = 0): number | string {
    return moveDec(value, -precision);
  }

  ngOnDestroy() {
    this.mainSubscription.unsubscribe();
    this.websocketService.stopTrackingAsset();
  }
}
