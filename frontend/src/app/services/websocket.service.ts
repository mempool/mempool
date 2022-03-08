import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebsocketResponse, IBackendInfo } from '../interfaces/websocket.interface';
import { StateService } from './state.service';
import { Transaction } from '../interfaces/electrs.interface';
import { Subscription } from 'rxjs';
import { ApiService } from './api.service';
import { take } from 'rxjs/operators';
import { TransferState, makeStateKey } from '@angular/platform-browser';
import { BlockExtended } from '../interfaces/node-api.interface';

const OFFLINE_RETRY_AFTER_MS = 10000;
const OFFLINE_PING_CHECK_AFTER_MS = 30000;
const EXPECT_PING_RESPONSE_AFTER_MS = 4000;

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
  private latestGitCommit = '';
  private onlineCheckTimeout: number;
  private onlineCheckTimeoutTwo: number;
  private subscription: Subscription;
  private network = '';

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
    private transferState: TransferState,
  ) {
    if (!this.stateService.isBrowser) {
      // @ts-ignore
      this.websocketSubject = { next: () => {}};
      this.stateService.isLoadingWebSocket$.next(false);
      this.apiService.getInitData$()
        .pipe(take(1))
        .subscribe((response) => this.handleResponse(response));
    } else {
      this.network = this.stateService.network === 'bisq' && !this.stateService.env.BISQ_SEPARATE_BACKEND ? '' : this.stateService.network;
      this.websocketSubject = webSocket<WebsocketResponse>(this.webSocketUrl.replace('{network}', this.network ? '/' + this.network : ''));

      const theInitData = this.transferState.get<any>(initData, null);
      if (theInitData) {
        this.handleResponse(theInitData.body);
        this.startSubscription(false, true);
      } else {
        this.startSubscription();
      }

      this.stateService.networkChanged$.subscribe((network) => {
        if (network === 'bisq' && !this.stateService.env.BISQ_SEPARATE_BACKEND) {
          network = '';
        }
        if (network === this.network) {
          return;
        }
        this.network = network;
        clearTimeout(this.onlineCheckTimeout);
        clearTimeout(this.onlineCheckTimeoutTwo);

        this.stateService.latestBlockHeight = 0;

        this.websocketSubject.complete();
        this.subscription.unsubscribe();
        this.websocketSubject = webSocket<WebsocketResponse>(
          this.webSocketUrl.replace('{network}', this.network ? '/' + this.network : '')
        );

        this.startSubscription();
      });
    }
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
          this.stateService.connectionState$.next(2);
        }

        if (this.stateService.connectionState$.value === 1) {
          this.stateService.connectionState$.next(2);
        }

        this.startOnlineCheck();
      },
      (err: Error) => {
        console.log(err);
        console.log(`WebSocket error, trying to reconnect in ${OFFLINE_RETRY_AFTER_MS} seconds`);
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
  }

  stopTrackingAddress() {
    this.websocketSubject.next({ 'track-address': 'stop' });
  }

  startTrackAsset(asset: string) {
    this.websocketSubject.next({ 'track-asset': asset });
  }

  stopTrackingAsset() {
    this.websocketSubject.next({ 'track-asset': 'stop' });
  }

  startTrackBisqMarket(market: string) {
    this.websocketSubject.next({ 'track-bisq-market': market });
  }

  stopTrackingBisqMarket() {
    this.websocketSubject.next({ 'track-bisq-market': 'stop' });
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
    this.goneOffline = true;
    this.stateService.connectionState$.next(0);
    window.setTimeout(() => {
      this.startSubscription(true);
    }, OFFLINE_RETRY_AFTER_MS);
  }

  startOnlineCheck() {
    clearTimeout(this.onlineCheckTimeout);
    clearTimeout(this.onlineCheckTimeoutTwo);

    this.onlineCheckTimeout = window.setTimeout(() => {
      this.websocketSubject.next({action: 'ping'});
      this.onlineCheckTimeoutTwo = window.setTimeout(() => {
        if (!this.goneOffline) {
          console.log('WebSocket response timeout, force closing, trying to reconnect in 10 seconds');
          this.websocketSubject.complete();
          this.subscription.unsubscribe();
          this.goOffline();
        }
      }, EXPECT_PING_RESPONSE_AFTER_MS);
    }, OFFLINE_PING_CHECK_AFTER_MS);
  }

  handleResponse(response: WebsocketResponse) {
    if (response.blocks && response.blocks.length) {
      const blocks = response.blocks;
      blocks.forEach((block: BlockExtended) => {
        if (block.height > this.stateService.latestBlockHeight) {
          this.stateService.latestBlockHeight = block.height;
          this.stateService.blocks$.next([block, false]);
        }
      });
    }

    if (response.tx) {
      this.stateService.mempoolTransactions$.next(response.tx);
    }

    if (response.block) {
      if (response.block.height > this.stateService.latestBlockHeight) {
        this.stateService.latestBlockHeight = response.block.height;
        this.stateService.blocks$.next([response.block, !!response.txConfirmed]);
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

    if (response.txReplaced) {
      this.stateService.txReplaced$.next(response.txReplaced);
    }

    if (response['mempool-blocks']) {
      this.stateService.mempoolBlocks$.next(response['mempool-blocks']);
    }

    if (response.transactions) {
      response.transactions.forEach((tx) => this.stateService.transactions$.next(tx));
    }

    if (response['bsq-price']) {
      this.stateService.bsqPrice$.next(response['bsq-price']);
    }

    if (response.utxoSpent) {
      this.stateService.utxoSpent$.next(response.utxoSpent);
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

    if (response['block-transactions']) {
      response['block-transactions'].forEach((addressTransaction: Transaction) => {
        this.stateService.blockTransactions$.next(addressTransaction);
      });
    }

    if (response['live-2h-chart']) {
      this.stateService.live2Chart$.next(response['live-2h-chart']);
    }

    if (response.loadingIndicators) {
      this.stateService.loadingIndicators$.next(response.loadingIndicators);
    }

    if (response.mempoolInfo) {
      this.stateService.mempoolInfo$.next(response.mempoolInfo);
    }

    if (response.vBytesPerSecond !== undefined) {
      this.stateService.vbytesPerSecond$.next(response.vBytesPerSecond);
    }

    if (response.lastDifficultyAdjustment !== undefined) {
      this.stateService.lastDifficultyAdjustment$.next(response.lastDifficultyAdjustment);
    }

    if (response.previousRetarget !== undefined) {
      this.stateService.previousRetarget$.next(response.previousRetarget);
    }

    if (response['git-commit']) {
      this.stateService.backendInfo$.next(response['git-commit']);
    }
  }
}
