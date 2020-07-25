import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebsocketResponse } from '../interfaces/websocket.interface';
import { StateService } from './state.service';
import { Block, Transaction } from '../interfaces/electrs.interface';
import { Subscription } from 'rxjs';
import { env } from '../app.constants';

const WEB_SOCKET_PROTOCOL = (document.location.protocol === 'https:') ? 'wss:' : 'ws:';
const WEB_SOCKET_URL = WEB_SOCKET_PROTOCOL + '//' + document.location.hostname + ':' + document.location.port + '{network}/api/v1/ws';

const OFFLINE_RETRY_AFTER_MS = 10000;
const OFFLINE_PING_CHECK_AFTER_MS = 30000;
const EXPECT_PING_RESPONSE_AFTER_MS = 1000;

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private websocketSubject: WebSocketSubject<WebsocketResponse>;
  private goneOffline = false;
  private lastWant: string[] | null = null;
  private isTrackingTx = false;
  private latestGitCommit = '';
  private onlineCheckTimeout: number;
  private onlineCheckTimeoutTwo: number;
  private subscription: Subscription;
  private network = '';

  constructor(
    private stateService: StateService,
  ) {
    this.network = this.stateService.network === 'bisq' && !env.BISQ_SEPARATE_BACKEND ? '' : this.stateService.network;
    this.websocketSubject = webSocket<WebsocketResponse>(WEB_SOCKET_URL.replace('{network}', this.network ? '/' + this.network : ''));
    this.startSubscription();

    this.stateService.networkChanged$.subscribe((network) => {
      if (network === 'bisq' && !env.BISQ_SEPARATE_BACKEND) {
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
      this.websocketSubject = webSocket<WebsocketResponse>(WEB_SOCKET_URL.replace('{network}', this.network ? '/' + this.network : ''));

      this.startSubscription();
    });
  }

  startSubscription(retrying = false) {
    this.stateService.isLoadingWebSocket$.next(true);
    if (retrying) {
      this.stateService.connectionState$.next(1);
    }
    this.websocketSubject.next({'action': 'init'});
    this.subscription = this.websocketSubject
      .subscribe((response: WebsocketResponse) => {
        this.stateService.isLoadingWebSocket$.next(false);
        if (response.blocks && response.blocks.length) {
          const blocks = response.blocks;
          blocks.forEach((block: Block) => {
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

        if (response['mempool-blocks']) {
          this.stateService.mempoolBlocks$.next(response['mempool-blocks']);
        }

        if (response['bsq-price']) {
          this.stateService.bsqPrice$.next(response['bsq-price']);
        }

        if (response['git-commit']) {
          if (!this.latestGitCommit) {
            this.latestGitCommit = response['git-commit'];
          } else {
            if (this.latestGitCommit !== response['git-commit']) {
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

        if (response.mempoolInfo) {
          this.stateService.mempoolStats$.next({
            memPoolInfo: response.mempoolInfo,
            vBytesPerSecond: response.vBytesPerSecond,
          });
        }

        if (this.goneOffline === true) {
          this.goneOffline = false;
          if (this.lastWant) {
            this.want(this.lastWant);
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
  }

  startMultiTrackTransaction(txId: string) {
    this.websocketSubject.next({ 'track-tx': txId, 'watch-mempool': true });
    this.isTrackingTx = true;
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

  fetchStatistics(historicalDate: string) {
    this.websocketSubject.next({ historicalDate });
  }

  want(data: string[]) {
    this.websocketSubject.next({action: 'want', data: data});
    this.lastWant = data;
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
}
