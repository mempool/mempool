import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebsocketResponse } from '../interfaces/websocket.interface';
import { retryWhen, tap, delay } from 'rxjs/operators';
import { StateService } from './state.service';
import { Block, Transaction } from '../interfaces/electrs.interface';
import { Subscription } from 'rxjs';

const WEB_SOCKET_PROTOCOL = (document.location.protocol === 'https:') ? 'wss:' : 'ws:';
const WEB_SOCKET_URL = WEB_SOCKET_PROTOCOL + '//' + document.location.hostname + ':' + document.location.port + '/ws';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private websocketSubject: WebSocketSubject<WebsocketResponse> = webSocket<WebsocketResponse | any>(WEB_SOCKET_URL);
  private goneOffline = false;
  private lastWant: string[] | null = null;
  private trackingTxId: string | null = null;
  private trackingAddress: string | null = null;
  private latestGitCommit = '';
  private onlineCheckTimeout: number;
  private onlineCheckTimeoutTwo: number;
  private subscription: Subscription;

  constructor(
    private stateService: StateService,
  ) {
    this.startSubscription();
  }

  startSubscription() {
    this.websocketSubject.next({'action': 'init'});
    this.subscription = this.websocketSubject
      .subscribe((response: WebsocketResponse) => {
        if (response.blocks && response.blocks.length) {
          const blocks = response.blocks;
          blocks.forEach((block: Block) => {
            if (block.height > this.stateService.latestBlockHeight) {
              this.stateService.latestBlockHeight = block.height;
              this.stateService.blocks$.next(block);
            }
          });
        }

        if (response.block) {
          if (response.block.height > this.stateService.latestBlockHeight) {
            this.stateService.latestBlockHeight = response.block.height;
            this.stateService.blocks$.next(response.block);
          }

          if (response.txConfirmed) {
            this.trackingTxId = null;
            this.stateService.txConfirmed$.next(response.block);
          }
        }

        if (response.conversions) {
          this.stateService.conversions$.next(response.conversions);
        }

        if (response['mempool-blocks']) {
          this.stateService.mempoolBlocks$.next(response['mempool-blocks']);
        }

        if (response['git-commit']) {
          if (!this.latestGitCommit) {
            this.latestGitCommit = response['git-commit'];
          } else {
            if (this.latestGitCommit !== response['git-commit']) {
              setTimeout(() => {
                window.location.reload();
              }, Math.floor(Math.random() * 60000) + 1000);
            }
          }
        }

        if (response['address-transactions']) {
          response['address-transactions'].forEach((addressTransaction: Transaction) => {
            this.stateService.mempoolTransactions$.next(addressTransaction);
          });
        }

        if (response['address-block-transactions']) {
          response['address-block-transactions'].forEach((addressTransaction: Transaction) => {
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
          if (this.trackingTxId) {
            this.startTrackTransaction(this.trackingTxId);
          }
          if (this.trackingAddress) {
            this.startTrackTransaction(this.trackingAddress);
          }
          this.stateService.isOffline$.next(false);
        }

        this.startOnlineCheck();
      },
      (err: Error) => {
        console.log(err);
        console.log('WebSocket error, trying to reconnect in 10 seconds');
        this.goOffline();
      });
  }

  startTrackTransaction(txId: string) {
    this.websocketSubject.next({ 'track-tx': txId });
    this.trackingTxId = txId;
  }

  startTrackAddress(address: string) {
    this.websocketSubject.next({ 'track-address': address });
    this.trackingAddress = address;
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
    this.stateService.isOffline$.next(true);
    window.setTimeout(() => this.startSubscription(), 10000);
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
      }, 1000);
    }, 10000);
  }
}
