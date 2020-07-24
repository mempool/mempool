import { Injectable } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject, fromEvent } from 'rxjs';
import { Block, Transaction } from '../interfaces/electrs.interface';
import { MempoolBlock, MemPoolState } from '../interfaces/websocket.interface';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { Router, NavigationStart } from '@angular/router';
import { env } from '../app.constants';
import { shareReplay, map } from 'rxjs/operators';

interface MarkBlockState {
  blockHeight?: number;
  mempoolBlockIndex?: number;
  txFeePerVSize?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StateService {
  network = '';
  latestBlockHeight = 0;

  networkChanged$ = new ReplaySubject<string>(1);
  blocks$ = new ReplaySubject<[Block, boolean]>(env.KEEP_BLOCKS_AMOUNT);
  conversions$ = new ReplaySubject<any>(1);
  bsqPrice$ = new ReplaySubject<number>(1);
  mempoolStats$ = new ReplaySubject<MemPoolState>(1);
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  txReplaced$ = new Subject<Transaction>();
  mempoolTransactions$ = new Subject<Transaction>();
  blockTransactions$ = new Subject<Transaction>();
  isLoadingWebSocket$ = new ReplaySubject<boolean>(1);

  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewFiat$ = new BehaviorSubject<boolean>(false);
  connectionState$ = new BehaviorSubject<0 | 1 | 2>(2);
  isTabHidden$ = fromEvent(document, 'visibilitychange').pipe(map((event) => this.isHidden()), shareReplay());

  markBlock$ = new ReplaySubject<MarkBlockState>();
  keyNavigation$ = new Subject<KeyboardEvent>();

  constructor(
    private router: Router,
  ) {
    this.setNetworkBasedonUrl(window.location.pathname);

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.setNetworkBasedonUrl(event.url);
      }
    });
  }

  setNetworkBasedonUrl(url: string) {
    switch (url.split('/')[1]) {
      case 'liquid':
        if (this.network !== 'liquid') {
          this.network = 'liquid';
          this.networkChanged$.next('liquid');
        }
        return;
      case 'testnet':
        if (this.network !== 'testnet') {
          this.network = 'testnet';
          this.networkChanged$.next('testnet');
        }
        return;
      case 'bisq':
        if (this.network !== 'bisq') {
          this.network = 'bisq';
          this.networkChanged$.next('bisq');
        }
        return;
      default:
        if (this.network !== '') {
          this.network = '';
          this.networkChanged$.next('');
        }
    }
  }

  getHiddenProp(){
    const prefixes = ['webkit', 'moz', 'ms', 'o'];
    if ('hidden' in document) { return 'hidden'; }
    for (const prefix of prefixes) {
      if ((prefix + 'Hidden') in document) {
        return prefix + 'Hidden';
      }
    }
    return null;
  }

  isHidden() {
    const prop = this.getHiddenProp();
    if (!prop) { return false; }
    return document[prop];
  }
}
