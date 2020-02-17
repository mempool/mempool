import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { WebsocketResponse } from '../interfaces/websocket.interface';
import { retryWhen, tap, delay } from 'rxjs/operators';
import { StateService } from './state.service';
import { Block } from '../interfaces/electrs.interface';

const WEB_SOCKET_PROTOCOL = (document.location.protocol === 'https:') ? 'wss:' : 'ws:';
const WEB_SOCKET_URL = WEB_SOCKET_PROTOCOL + '//' + document.location.hostname + ':8999';

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private websocketSubject: WebSocketSubject<WebsocketResponse> = webSocket<WebsocketResponse | any>(WEB_SOCKET_URL);
  private goneOffline = false;
  private lastWant: string[] | null = null;
  private trackingTxId: string | null = null;

  constructor(
    private stateService: StateService,
  ) {
    this.startSubscription();
  }

  startSubscription() {
    this.websocketSubject.next({'action': 'init'});
    this.websocketSubject
      .pipe(
        retryWhen((errors: any) => errors
          .pipe(
            tap(() => {
              this.goneOffline = true;
              this.websocketSubject.next({'action': 'init'});
              this.stateService.isOffline$.next(true);
            }),
            delay(5000),
          )
        ),
      )
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
            this.stateService.txConfirmed.next(response.block);
          }
        }

        if (response.conversions) {
          this.stateService.conversions$.next(response.conversions);
        }

        if (response['mempool-blocks']) {
          this.stateService.mempoolBlocks$.next(response['mempool-blocks']);
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
            this.startTrackTx(this.trackingTxId);
          }
          this.stateService.isOffline$.next(false);
        }
      },
      (err: Error) => {
        console.log(err);
        this.goneOffline = true;
        console.log('Error, retrying in 10 sec');
        window.setTimeout(() => this.startSubscription(), 10000);
      });
  }

  startTrackTx(txId: string) {
    this.websocketSubject.next({ txId });
    this.trackingTxId = txId;
  }

  fetchStatistics(historicalDate: string) {
    this.websocketSubject.next({ historicalDate });
  }

  want(data: string[]) {
    this.websocketSubject.next({action: 'want', data: data});
    this.lastWant = data;
  }
}
