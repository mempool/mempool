import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject, fromEvent, Observable } from 'rxjs';
import { Block, Transaction } from '../interfaces/electrs.interface';
import { IBackendInfo, MempoolBlock, MempoolInfo, TransactionStripped } from '../interfaces/websocket.interface';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { Router, NavigationStart } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map, shareReplay } from 'rxjs/operators';

interface MarkBlockState {
  blockHeight?: number;
  mempoolBlockIndex?: number;
  txFeePerVSize?: number;
}

export interface ILoadingIndicators {
  [name: string]: number;
}

export interface Env {
  TESTNET_ENABLED: boolean;
  SIGNET_ENABLED: boolean;
  LIQUID_ENABLED: boolean;
  BISQ_ENABLED: boolean;
  BISQ_SEPARATE_BACKEND: boolean;
  ITEMS_PER_PAGE: number;
  KEEP_BLOCKS_AMOUNT: number;
  OFFICIAL_MEMPOOL_SPACE: boolean;
  OFFICIAL_BISQ_MARKETS: boolean;
  NGINX_PROTOCOL?: string;
  NGINX_HOSTNAME?: string;
  NGINX_PORT?: string;
  GIT_COMMIT_HASH: string;
  PACKAGE_JSON_VERSION: string;
}

const defaultEnv: Env = {
  TESTNET_ENABLED: false,
  SIGNET_ENABLED: false,
  LIQUID_ENABLED: false,
  OFFICIAL_BISQ_MARKETS: false,
  BISQ_ENABLED: false,
  BISQ_SEPARATE_BACKEND: false,
  ITEMS_PER_PAGE: 10,
  KEEP_BLOCKS_AMOUNT: 8,
  OFFICIAL_MEMPOOL_SPACE: false,
  NGINX_PROTOCOL: 'http',
  NGINX_HOSTNAME: '127.0.0.1',
  NGINX_PORT: '80',
  GIT_COMMIT_HASH: '',
  PACKAGE_JSON_VERSION: '',
};

@Injectable({
  providedIn: 'root',
})
export class StateService {
  isBrowser: boolean = isPlatformBrowser(this.platformId);
  network = '';
  env: Env;
  latestBlockHeight = 0;

  networkChanged$ = new ReplaySubject<string>(1);
  blocks$: ReplaySubject<[Block, boolean]>;
  transactions$ = new ReplaySubject<TransactionStripped>(6);
  conversions$ = new ReplaySubject<any>(1);
  bsqPrice$ = new ReplaySubject<number>(1);
  mempoolInfo$ = new ReplaySubject<MempoolInfo>(1);
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  txReplaced$ = new Subject<Transaction>();
  mempoolTransactions$ = new Subject<Transaction>();
  blockTransactions$ = new Subject<Transaction>();
  isLoadingWebSocket$ = new ReplaySubject<boolean>(1);
  vbytesPerSecond$ = new ReplaySubject<number>(1);
  lastDifficultyAdjustment$ = new ReplaySubject<number>(1);
  backendInfo$ = new ReplaySubject<IBackendInfo>(1);
  loadingIndicators$ = new ReplaySubject<ILoadingIndicators>(1);

  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewFiat$ = new BehaviorSubject<boolean>(false);
  connectionState$ = new BehaviorSubject<0 | 1 | 2>(2);
  isTabHidden$: Observable<boolean>;

  markBlock$ = new ReplaySubject<MarkBlockState>();
  keyNavigation$ = new Subject<KeyboardEvent>();

  constructor(@Inject(PLATFORM_ID) private platformId: any, private router: Router) {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.setNetworkBasedonUrl(event.url);
      }
    });

    if (this.isBrowser) {
      this.setNetworkBasedonUrl(window.location.pathname);
      this.isTabHidden$ = fromEvent(document, 'visibilitychange').pipe(
        map(() => this.isHidden()),
        shareReplay()
      );
    } else {
      this.setNetworkBasedonUrl('/');
      this.isTabHidden$ = new BehaviorSubject(false);
    }

    const browserWindow = window || {};
    // @ts-ignore
    const browserWindowEnv = browserWindow.__env || {};
    this.env = Object.assign(defaultEnv, browserWindowEnv);

    this.blocks$ = new ReplaySubject<[Block, boolean]>(this.env.KEEP_BLOCKS_AMOUNT);
  }

  setNetworkBasedonUrl(url: string) {
    const networkMatches = url.match(/\/(bisq|testnet|liquid|signet)/);
    switch (networkMatches && networkMatches[1]) {
      case 'liquid':
        if (this.network !== 'liquid') {
          this.network = 'liquid';
          this.networkChanged$.next('liquid');
        }
        return;
      case 'signet':
        if (this.network !== 'signet') {
          this.network = 'signet';
          this.networkChanged$.next('signet');
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

  getHiddenProp() {
    const prefixes = ['webkit', 'moz', 'ms', 'o'];
    if ('hidden' in document) {
      return 'hidden';
    }
    for (const prefix of prefixes) {
      if (prefix + 'Hidden' in document) {
        return prefix + 'Hidden';
      }
    }
    return null;
  }

  isHidden() {
    const prop = this.getHiddenProp();
    if (!prop) {
      return false;
    }
    return document[prop];
  }
}
