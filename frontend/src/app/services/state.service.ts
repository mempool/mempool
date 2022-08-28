import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject, fromEvent, Observable } from 'rxjs';
import { Transaction } from '../interfaces/electrs.interface';
import { IBackendInfo, MempoolBlock, MempoolBlockWithTransactions, MempoolBlockDelta, MempoolInfo, Recommendedfees, ReplacedTransaction, TransactionStripped } from '../interfaces/websocket.interface';
import { BlockExtended, DifficultyAdjustment, OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { Router, NavigationStart } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map, shareReplay } from 'rxjs/operators';

interface MarkBlockState {
  blockHeight?: number;
  mempoolBlockIndex?: number;
  txFeePerVSize?: number;
}

export interface ILoadingIndicators { [name: string]: number; }

export interface Env {
  TESTNET_ENABLED: boolean;
  SIGNET_ENABLED: boolean;
  LIQUID_ENABLED: boolean;
  LIQUID_TESTNET_ENABLED: boolean;
  BISQ_ENABLED: boolean;
  BISQ_SEPARATE_BACKEND: boolean;
  ITEMS_PER_PAGE: number;
  KEEP_BLOCKS_AMOUNT: number;
  OFFICIAL_MEMPOOL_SPACE: boolean;
  BASE_MODULE: string;
  NGINX_PROTOCOL?: string;
  NGINX_HOSTNAME?: string;
  NGINX_PORT?: string;
  BLOCK_WEIGHT_UNITS: number;
  MEMPOOL_BLOCKS_AMOUNT: number;
  GIT_COMMIT_HASH: string;
  PACKAGE_JSON_VERSION: string;
  MEMPOOL_WEBSITE_URL: string;
  LIQUID_WEBSITE_URL: string;
  BISQ_WEBSITE_URL: string;
  MINING_DASHBOARD: boolean;
  LIGHTNING: boolean;
}

const defaultEnv: Env = {
  'TESTNET_ENABLED': false,
  'SIGNET_ENABLED': false,
  'LIQUID_ENABLED': false,
  'LIQUID_TESTNET_ENABLED': false,
  'BASE_MODULE': 'mempool',
  'BISQ_ENABLED': false,
  'BISQ_SEPARATE_BACKEND': false,
  'ITEMS_PER_PAGE': 10,
  'KEEP_BLOCKS_AMOUNT': 8,
  'OFFICIAL_MEMPOOL_SPACE': false,
  'NGINX_PROTOCOL': 'http',
  'NGINX_HOSTNAME': '127.0.0.1',
  'NGINX_PORT': '80',
  'BLOCK_WEIGHT_UNITS': 4000000,
  'MEMPOOL_BLOCKS_AMOUNT': 8,
  'GIT_COMMIT_HASH': '',
  'PACKAGE_JSON_VERSION': '',
  'MEMPOOL_WEBSITE_URL': 'https://mempool.space',
  'LIQUID_WEBSITE_URL': 'https://liquid.network',
  'BISQ_WEBSITE_URL': 'https://bisq.markets',
  'MINING_DASHBOARD': true,
  'LIGHTNING': false,
};

@Injectable({
  providedIn: 'root'
})
export class StateService {
  isBrowser: boolean = isPlatformBrowser(this.platformId);
  network = '';
  lightning = false;
  blockVSize: number;
  env: Env;
  latestBlockHeight = -1;

  networkChanged$ = new ReplaySubject<string>(1);
  lightningChanged$ = new ReplaySubject<boolean>(1);
  blocks$: ReplaySubject<[BlockExtended, boolean]>;
  transactions$ = new ReplaySubject<TransactionStripped>(6);
  conversions$ = new ReplaySubject<any>(1);
  bsqPrice$ = new ReplaySubject<number>(1);
  mempoolInfo$ = new ReplaySubject<MempoolInfo>(1);
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  mempoolBlockTransactions$ = new Subject<TransactionStripped[]>();
  mempoolBlockDelta$ = new Subject<MempoolBlockDelta>();
  txReplaced$ = new Subject<ReplacedTransaction>();
  utxoSpent$ = new Subject<object>();
  difficultyAdjustment$ = new ReplaySubject<DifficultyAdjustment>(1);
  mempoolTransactions$ = new Subject<Transaction>();
  blockTransactions$ = new Subject<Transaction>();
  isLoadingWebSocket$ = new ReplaySubject<boolean>(1);
  vbytesPerSecond$ = new ReplaySubject<number>(1);
  previousRetarget$ = new ReplaySubject<number>(1);
  backendInfo$ = new ReplaySubject<IBackendInfo>(1);
  loadingIndicators$ = new ReplaySubject<ILoadingIndicators>(1);
  recommendedFees$ = new ReplaySubject<Recommendedfees>(1);

  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewFiat$ = new BehaviorSubject<boolean>(false);
  connectionState$ = new BehaviorSubject<0 | 1 | 2>(2);
  isTabHidden$: Observable<boolean>;

  markBlock$ = new ReplaySubject<MarkBlockState>();
  keyNavigation$ = new Subject<KeyboardEvent>();

  blockScrolling$: Subject<boolean> = new Subject<boolean>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    private router: Router,
  ) {
    const browserWindow = window || {};
    // @ts-ignore
    const browserWindowEnv = browserWindow.__env || {};
    this.env = Object.assign(defaultEnv, browserWindowEnv);

    if (defaultEnv.BASE_MODULE !== 'mempool') {
      this.env.MINING_DASHBOARD = false;
    }

    if (this.isBrowser) {
      this.setNetworkBasedonUrl(window.location.pathname);
      this.setLightningBasedonUrl(window.location.pathname);
      this.isTabHidden$ = fromEvent(document, 'visibilitychange').pipe(map(() => this.isHidden()), shareReplay());
    } else {
      this.setNetworkBasedonUrl('/');
      this.setLightningBasedonUrl('/');
      this.isTabHidden$ = new BehaviorSubject(false);
    }

    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.setNetworkBasedonUrl(event.url);
        this.setLightningBasedonUrl(event.url);
      }
    });

    this.blocks$ = new ReplaySubject<[BlockExtended, boolean]>(this.env.KEEP_BLOCKS_AMOUNT);

    if (this.env.BASE_MODULE === 'bisq') {
      this.network = this.env.BASE_MODULE;
      this.networkChanged$.next(this.env.BASE_MODULE);
    }

    this.blockVSize = this.env.BLOCK_WEIGHT_UNITS / 4;
  }

  setNetworkBasedonUrl(url: string) {
    if (this.env.BASE_MODULE !== 'mempool' && this.env.BASE_MODULE !== 'liquid') {
      return;
    }
    // horrible network regex breakdown:
    // /^\/                                         starts with a forward slash...
    // (?:[a-z]{2}(?:-[A-Z]{2})?\/)?                optional locale prefix (non-capturing)
    // (?:preview\/)?                               optional "preview" prefix (non-capturing)
    // (bisq|testnet|liquidtestnet|liquid|signet)/  network string (captured as networkMatches[1])
    const networkMatches = url.match(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:preview\/)?(bisq|testnet|liquidtestnet|liquid|signet)/);
    switch (networkMatches && networkMatches[1]) {
      case 'liquid':
        if (this.network !== 'liquid') {
          this.network = 'liquid';
          this.networkChanged$.next('liquid');
        }
        return;
      case 'liquidtestnet':
        if (this.network !== 'liquidtestnet') {
          this.network = 'liquidtestnet';
          this.networkChanged$.next('liquidtestnet');
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
          if (this.env.BASE_MODULE === 'liquid') {
            this.network = 'liquidtestnet';
            this.networkChanged$.next('liquidtestnet');
          } else {
            this.network = 'testnet';
            this.networkChanged$.next('testnet');
          }
        }
        return;
      case 'bisq':
        if (this.network !== 'bisq') {
          this.network = 'bisq';
          this.networkChanged$.next('bisq');
        }
        return;
      default:
        if (this.env.BASE_MODULE !== 'mempool') {
          if (this.network !== this.env.BASE_MODULE) {
            this.network = this.env.BASE_MODULE;
            this.networkChanged$.next(this.env.BASE_MODULE);
          }
        } else if (this.network !== '') {
          this.network = '';
          this.networkChanged$.next('');
        }
    }
  }

  setLightningBasedonUrl(url: string) {
    if (this.env.BASE_MODULE !== 'mempool') {
      return;
    }
    const networkMatches = url.match(/\/lightning\//);
    this.lightning = !!networkMatches;
    this.lightningChanged$.next(this.lightning);
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

  setBlockScrollingInProgress(value: boolean) {
    this.blockScrolling$.next(value);
  }

  isLiquid() {
    return this.network === 'liquid' || this.network === 'liquidtestnet';
  }
}
