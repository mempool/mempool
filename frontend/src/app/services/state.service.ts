import { Injectable } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject } from 'rxjs';
import { Block, Transaction } from '../interfaces/electrs.interface';
import { MempoolBlock, MemPoolState } from '../interfaces/websocket.interface';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { Router, NavigationStart } from '@angular/router';

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
  blocks$ = new ReplaySubject<Block>(8);
  conversions$ = new ReplaySubject<any>(1);
  mempoolStats$ = new ReplaySubject<MemPoolState>(1);
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  txConfirmed$ = new Subject<Block>();
  mempoolTransactions$ = new Subject<Transaction>();
  assetTransactions$ = new Subject<Transaction>();
  blockTransactions$ = new Subject<Transaction>();

  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewFiat$ = new BehaviorSubject<boolean>(false);
  connectionState$ = new BehaviorSubject<0 | 1 | 2>(2);

  markBlock$ = new Subject<MarkBlockState>();
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
      case 'liquid-tv':
        if (this.network !== 'liquid') {
          this.network = 'liquid';
          this.networkChanged$.next('liquid');
        }
        return;
      case 'testnet':
      case 'testnet-tv':
        if (this.network !== 'testnet') {
          this.network = 'testnet';
          this.networkChanged$.next('testnet');
        }
        return;
      default:
        if (this.network !== '') {
          this.network = '';
          this.networkChanged$.next('');
        }
    }
  }
}
