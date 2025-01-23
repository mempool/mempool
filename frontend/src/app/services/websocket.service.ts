import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebsocketResponse } from '@interfaces/websocket.interface';
import { StateService } from '@app/services/state.service';
import { Transaction } from '@interfaces/electrs.interface';
import { firstValueFrom, Subscription } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { take } from 'rxjs/operators';
import { TransferState, makeStateKey } from '@angular/core';
import { CacheService } from '@app/services/cache.service';
import { uncompressDeltaChange, uncompressTx } from '@app/shared/common.utils';

const OFFLINE_RETRY_AFTER_MS = 2000;
const OFFLINE_PING_CHECK_AFTER_MS = 30000;
const EXPECT_PING_RESPONSE_AFTER_MS = 5000;

const initData = makeStateKey('/api/v1/init-data');

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private webSocketProtocol = (document.location.protocol === 'https:') ? 'wss:' : 'ws:';
  private webSocketUrl = this.webSocketProtocol + '//' + document.location.hostname + ':' + document.location.port + '{network}/api/v1/ws';

  private websocketSubject: WebSocketSubject<WebsocketResponse>;
  private goneOffline = false;
  private lastWant: string | null = null;
  private isTrackingTx = false;
  private trackingTxId: string;
  private isTrackingMempoolBlock = false;
  private isTrackingRbf: 'all' | 'fullRbf' | false = false;
  private isTrackingRbfSummary = false;
  private isTrackingAddress: string | false = false;
  private isTrackingAddresses: string[] | false = false;
  private isTrackingAccelerations: boolean = false;
  private isTrackingWallet: boolean = false;
  private trackingWalletName: string;
  private isTrackingStratum: string | number | false = false;
  private trackingMempoolBlock: number;
  private trackingMempoolBlockNetwork: string;
  private stoppingTrackMempoolBlock: any | null = null;
  private latestGitCommit = '';
  private onlineCheckTimeout: number;
  private onlineCheckTimeoutTwo: number;
  private subscription: Subscription;
  private network = '';

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private transferState: TransferState,
    private cacheService: CacheService,
  ) {
    if (!this.stateService.isBrowser) {
      // @ts-ignore
      this.websocketSubject = { next: () => {}};
      this.stateService.isLoadingWebSocket$.next(false);
      this.apiService.getInitData$()
        .pipe(take(1))
        .subscribe((response) => this.handleResponse(response));
    } else {
      this.network = this.stateService.network === this.stateService.env.ROOT_NETWORK ? '' : this.stateService.network;
      this.websocketSubject = webSocket<WebsocketResponse>(this.webSocketUrl.replace('{network}', this.network ? '/' + this.network : ''));

      const { response: theInitData } = this.transferState.get<any>(initData, null) || {};
      if (theInitData) {
        if (theInitData.body.blocks) {
          theInitData.body.blocks = theInitData.body.blocks.reverse();
        }
        this.stateService.backend$.next(theInitData.backend);
        this.stateService.isLoadingWebSocket$.next(false);
        this.handleResponse(theInitData.body);
        this.startSubscription(false, true);
      } else {
        this.startSubscription();
      }

      this.stateService.networkChanged$.subscribe((network) => {
        if (network === this.network || (this.network === '' && network === this.stateService.env.ROOT_NETWORK)) {
          return;
        }
        this.network = network === this.stateService.env.ROOT_NETWORK ? '' : network;
        clearTimeout(this.onlineCheckTimeout);
        clearTimeout(this.onlineCheckTimeoutTwo);

        this.stateService.resetChainTip();

        this.reconnectWebsocket();
      });
    }
  }

  reconnectWebsocket(retrying = false, hasInitData = false) {
    console.log('reconnecting websocket');
    this.websocketSubject.complete();
    this.subscription.unsubscribe();
    this.websocketSubject = webSocket<WebsocketResponse>(
      this.webSocketUrl.replace('{network}', this.network ? '/' + this.network : '')
    );

    this.startSubscription(retrying, hasInitData);
  }

  startSubscription(retrying = false, hasInitData = false) {
    if (!hasInitData) {
      this.stateService.isLoadingWebSocket$.next(true);
      this.websocketSubject.next({'action': 'init'});
    }
    if (retrying) {
      this.stateService.connectionState$.next(1);
    }
    this.subscription = this.websocketSubject
      .subscribe((response: WebsocketResponse) => {
        this.stateService.isLoadingWebSocket$.next(false);
        this.handleResponse(response);

        if (this.goneOffline === true) {
          this.goneOffline = false;
          if (this.lastWant) {
            this.want(JSON.parse(this.lastWant), true);
          }
          if (this.isTrackingTx) {
            this.startMultiTrackTransaction(this.trackingTxId);
          }
          if (this.isTrackingMempoolBlock) {
            this.startTrackMempoolBlock(this.trackingMempoolBlock, true);
          }
          if (this.isTrackingRbf) {
            this.startTrackRbf(this.isTrackingRbf);
          }
          if (this.isTrackingRbfSummary) {
            this.startTrackRbfSummary();
          }
          if (this.isTrackingAddress) {
            this.startTrackAddress(this.isTrackingAddress);
          }
          if (this.isTrackingAddresses) {
            this.startTrackAddresses(this.isTrackingAddresses);
          }
          if (this.isTrackingAccelerations) {
            this.startTrackAccelerations();
          }
          if (this.isTrackingWallet) {
            this.startTrackingWallet(this.trackingWalletName);
          }
          if (this.isTrackingStratum !== false) {
            this.startTrackStratum(this.isTrackingStratum);
          }
          this.stateService.connectionState$.next(2);
        }

        if (this.stateService.connectionState$.value !== 2) {
          this.stateService.connectionState$.next(2);
        }

        this.startOnlineCheck();
      },
      (err: Error) => {
        console.log(err);
        console.log(`WebSocket error`);
        this.goOffline();
      });
  }

  startTrackTransaction(txId: string) {
    if (this.isTrackingTx) {
      return;
    }
    this.websocketSubject.next({ 'track-tx': txId });
    this.isTrackingTx = true;
    this.trackingTxId = txId;
  }

  startMultiTrackTransaction(txId: string) {
    this.websocketSubject.next({ 'track-tx': txId, 'watch-mempool': true });
    this.isTrackingTx = true;
    this.trackingTxId = txId;
  }

  stopTrackingTransaction() {
    if (!this.isTrackingTx) {
      return;
    }
    this.websocketSubject.next({ 'track-tx': 'stop' });
    this.isTrackingTx = false;
  }

  startTrackAddress(address: string) {
    this.websocketSubject.next({ 'track-address': address });
    this.isTrackingAddress = address;
  }

  stopTrackingAddress() {
    this.websocketSubject.next({ 'track-address': 'stop' });
    this.isTrackingAddress = false;
  }

  startTrackAddresses(addresses: string[]) {
    this.websocketSubject.next({ 'track-addresses': addresses });
    this.isTrackingAddresses = addresses;
  }

  stopTrackingAddresses() {
    this.websocketSubject.next({ 'track-addresses': [] });
    this.isTrackingAddresses = false;
  }

  startTrackingWallet(walletName: string) {
    this.websocketSubject.next({ 'track-wallet': walletName });
    this.isTrackingWallet = true;
    this.trackingWalletName = walletName;
  }

  stopTrackingWallet() {
    this.websocketSubject.next({ 'track-wallet': 'stop' });
    this.isTrackingWallet = false;
    this.trackingWalletName = '';
  }

  startTrackAsset(asset: string) {
    this.websocketSubject.next({ 'track-asset': asset });
  }

  stopTrackingAsset() {
    this.websocketSubject.next({ 'track-asset': 'stop' });
  }

  startTrackMempoolBlock(block: number, force: boolean = false): boolean {
    if (this.stoppingTrackMempoolBlock) {
      clearTimeout(this.stoppingTrackMempoolBlock);
    }
    // skip duplicate tracking requests
    if (force || this.trackingMempoolBlock !== block || this.network !== this.trackingMempoolBlockNetwork) {
      this.websocketSubject.next({ 'track-mempool-block': block });
      this.isTrackingMempoolBlock = true;
      this.trackingMempoolBlock = block;
      this.trackingMempoolBlockNetwork = this.network;
      return true;
    }
    return false;
  }

  stopTrackMempoolBlock(): void {
    if (this.stoppingTrackMempoolBlock) {
      clearTimeout(this.stoppingTrackMempoolBlock);
    }
    this.isTrackingMempoolBlock = false;
    this.stoppingTrackMempoolBlock = setTimeout(() => {
      this.stoppingTrackMempoolBlock = null;
      this.websocketSubject.next({ 'track-mempool-block': -1 });
      this.trackingMempoolBlock = null;
      this.stateService.mempoolBlockState = null;
    }, 2000);
  }

  startTrackRbf(mode: 'all' | 'fullRbf') {
    this.websocketSubject.next({ 'track-rbf': mode });
    this.isTrackingRbf = mode;
  }

  stopTrackRbf() {
    this.websocketSubject.next({ 'track-rbf': 'stop' });
    this.isTrackingRbf = false;
  }

  startTrackRbfSummary() {
    this.initRbfSummary();
    this.websocketSubject.next({ 'track-rbf-summary': true });
    this.isTrackingRbfSummary = true;
  }

  stopTrackRbfSummary() {
    this.websocketSubject.next({ 'track-rbf-summary': false });
    this.isTrackingRbfSummary = false;
  }

  startTrackAccelerations() {
    this.websocketSubject.next({ 'track-accelerations': true });
    this.isTrackingAccelerations = true;
  }

  stopTrackAccelerations() {
    if (this.isTrackingAccelerations) {
      this.websocketSubject.next({ 'track-accelerations': false });
      this.isTrackingAccelerations = false;
    }
  }

  ensureTrackAccelerations() {
    if (!this.isTrackingAccelerations) {
      this.startTrackAccelerations();
    }
  }

  startTrackStratum(pool: number | string) {
    this.websocketSubject.next({ 'track-stratum': pool });
    this.isTrackingStratum = pool;
  }

  stopTrackStratum() {
    if (this.isTrackingStratum) {
      this.websocketSubject.next({ 'track-stratum': null });
      this.isTrackingStratum = false;
    }
  }

  fetchStatistics(historicalDate: string) {
    this.websocketSubject.next({ historicalDate });
  }

  want(data: string[], force = false) {
    if (!this.stateService.isBrowser) {
      return;
    }
    if (JSON.stringify(data) === this.lastWant && !force) {
      return;
    }
    this.websocketSubject.next({action: 'want', data: data});
    this.lastWant = JSON.stringify(data);
  }

  goOffline() {
    const retryDelay = OFFLINE_RETRY_AFTER_MS + (Math.random() * OFFLINE_RETRY_AFTER_MS);
    console.log(`trying to reconnect websocket in ${retryDelay} seconds`);
    this.goneOffline = true;
    this.stateService.connectionState$.next(0);
    window.setTimeout(() => {
      this.reconnectWebsocket(true);
    }, retryDelay);
  }

  startOnlineCheck() {
    clearTimeout(this.onlineCheckTimeout);
    clearTimeout(this.onlineCheckTimeoutTwo);

    this.onlineCheckTimeout = window.setTimeout(() => {
      this.websocketSubject.next({action: 'ping'});
      this.onlineCheckTimeoutTwo = window.setTimeout(() => {
        if (!this.goneOffline) {
          console.log('WebSocket response timeout, force closing');
          this.websocketSubject.complete();
          this.subscription.unsubscribe();
          this.goOffline();
        }
      }, EXPECT_PING_RESPONSE_AFTER_MS);
    }, OFFLINE_PING_CHECK_AFTER_MS);
  }

  handleResponse(response: WebsocketResponse) {
    let reinitBlocks = false;

    if (response.backend) {
      this.stateService.backend$.next(response.backend);
    }

    if (response.blocks && response.blocks.length) {
      const blocks = response.blocks;
      this.stateService.resetBlocks(blocks);
      const maxHeight = blocks.reduce((max, block) => Math.max(max, block.height), this.stateService.latestBlockHeight);
      this.stateService.updateChainTip(maxHeight);
    }

    if (response.tx) {
      this.stateService.mempoolTransactions$.next(response.tx);
    }

    if (response['txPosition']) {
      this.stateService.mempoolTxPosition$.next(response['txPosition']);
    }

    if (response.block) {
      if (response.block.height === this.stateService.latestBlockHeight + 1) {
        this.stateService.updateChainTip(response.block.height);
        this.stateService.addBlock(response.block);
        this.stateService.txConfirmed$.next([response.txConfirmed, response.block]);
      } else if (response.block.height > this.stateService.latestBlockHeight + 1) {
        reinitBlocks = true;
      }

      if (response.txConfirmed) {
        this.isTrackingTx = false;
      }
    }

    if (response.conversions) {
      this.stateService.conversions$.next(response.conversions);
    }

    if (response.rbfTransaction) {
      this.stateService.txReplaced$.next(response.rbfTransaction);
    }

    if (response.rbfInfo) {
      this.stateService.txRbfInfo$.next(response.rbfInfo);
    }

    if (response.rbfLatest) {
      this.stateService.rbfLatest$.next(response.rbfLatest);
    }

    if (response.rbfLatestSummary !== undefined) {
      this.stateService.rbfLatestSummary$.next(response.rbfLatestSummary || []);
    }

    if (response.txReplaced) {
      this.stateService.txReplaced$.next(response.txReplaced);
    }

    if (response['mempool-blocks']) {
      this.stateService.mempoolBlocks$.next(response['mempool-blocks']);
    }

    if (response.transactions) {
      this.stateService.transactions$.next(response.transactions.slice(0, 6));
    }

    if (response['bsq-price']) {
      this.stateService.bsqPrice$.next(response['bsq-price']);
    }

    if (response.utxoSpent) {
      this.stateService.utxoSpent$.next(response.utxoSpent);
    }

    if (response.da) {
      this.stateService.difficultyAdjustment$.next(response.da);
    }

    if (response.fees) {
     this.stateService.recommendedFees$.next(response.fees); 
    }

    if (response.backendInfo) {
      this.stateService.backendInfo$.next(response.backendInfo);

      if (!this.latestGitCommit) {
        this.latestGitCommit = response.backendInfo.gitCommit;
      } else {
        if (this.latestGitCommit !== response.backendInfo.gitCommit) {
          setTimeout(() => {
            window.location.reload();
          }, Math.floor(Math.random() * 60000) + 60000);
        }
      }
    }

    if (response['address-transactions']) {
      response['address-transactions'].forEach((addressTransaction: Transaction) => {
        this.stateService.mempoolTransactions$.next(addressTransaction);
      });
    }

    if (response['address-removed-transactions']) {
      response['address-removed-transactions'].forEach((addressTransaction: Transaction) => {
        this.stateService.mempoolRemovedTransactions$.next(addressTransaction);
      });
    }

    if (response['multi-address-transactions']) {
      this.stateService.multiAddressTransactions$.next(response['multi-address-transactions']);
    }

    if (response['block-transactions']) {
      response['block-transactions'].forEach((addressTransaction: Transaction) => {
        this.stateService.blockTransactions$.next(addressTransaction);
      });
    }

    if (response['projected-block-transactions']) {
      if (response['projected-block-transactions'].index == this.trackingMempoolBlock) {
        if (response['projected-block-transactions'].blockTransactions) {
          this.stateService.mempoolSequence = response['projected-block-transactions'].sequence;
          this.stateService.mempoolBlockUpdate$.next({
            block: this.trackingMempoolBlock,
            transactions: response['projected-block-transactions'].blockTransactions.map(uncompressTx),
          });
        } else if (response['projected-block-transactions'].delta) {
          if (this.stateService.mempoolSequence && response['projected-block-transactions'].sequence !== this.stateService.mempoolSequence + 1) {
            this.stateService.mempoolSequence = 0;
            this.startTrackMempoolBlock(this.trackingMempoolBlock, true);
          } else {
            this.stateService.mempoolSequence = response['projected-block-transactions'].sequence;
            this.stateService.mempoolBlockUpdate$.next(uncompressDeltaChange(this.trackingMempoolBlock, response['projected-block-transactions'].delta));
          }
        }
      }
    }

    if (response['wallet-transactions']) {
      this.stateService.walletTransactions$.next(response['wallet-transactions']);
    }

    if (response['accelerations']) {
      if (response['accelerations'].accelerations) {
        this.stateService.accelerations$.next({
          added: response['accelerations'].accelerations,
          removed: [],
          reset: true,
        });
      } else {
        this.stateService.accelerations$.next(response['accelerations']);
      }
    }

    if (response['live-2h-chart']) {
      this.stateService.live2Chart$.next(response['live-2h-chart']);
    }

    if (response.loadingIndicators) {
      this.stateService.loadingIndicators$.next(response.loadingIndicators);
      if (response.loadingIndicators.mempool != null && response.loadingIndicators.mempool < 100) {
        this.stateService.isLoadingMempool$.next(true);
      } else {
        this.stateService.isLoadingMempool$.next(false);
      }
    }

    if (response.mempoolInfo) {
      this.stateService.mempoolInfo$.next(response.mempoolInfo);
    }

    if (response.vBytesPerSecond !== undefined) {
      this.stateService.vbytesPerSecond$.next(response.vBytesPerSecond);
    }

    if (response.previousRetarget !== undefined) {
      this.stateService.previousRetarget$.next(response.previousRetarget);
    }

    if (response.stratumJobs) {
      this.stateService.stratumJobUpdate$.next({ state: response.stratumJobs });
    }

    if (response.stratumJob) {
      this.stateService.stratumJobUpdate$.next({ job: response.stratumJob });
    }

    if (response['tomahawk']) {
      this.stateService.serverHealth$.next(response['tomahawk']);
    }

    if (response['git-commit']) {
      this.stateService.backendInfo$.next(response['git-commit']);
    }

    if (reinitBlocks) {
      this.websocketSubject.next({'refresh-blocks': true});
    }
  }

  async initRbfSummary(): Promise<void> {
    if (!this.stateService.isBrowser) {
      const rbfList = await firstValueFrom(this.apiService.getRbfList$(false));
      if (rbfList) {
        const rbfSummary = rbfList.slice(0, 6).map(rbfTree => {
          let oldFee = 0;
          let oldVsize = 0;
          for (const replaced of rbfTree.replaces) {
            oldFee += replaced.tx.fee;
            oldVsize += replaced.tx.vsize;
          }
          return {
            txid: rbfTree.tx.txid,
            mined: !!rbfTree.tx.mined,
            fullRbf: !!rbfTree.tx.fullRbf,
            oldFee,
            oldVsize,
            newFee: rbfTree.tx.fee,
            newVsize: rbfTree.tx.vsize,
          };
        });
        this.stateService.rbfLatestSummary$.next(rbfSummary);
      }
    }
  }
}
