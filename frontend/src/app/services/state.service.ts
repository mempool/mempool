import { Inject, Injectable, PLATFORM_ID, LOCALE_ID } from '@angular/core';
import { ReplaySubject, BehaviorSubject, Subject, fromEvent, Observable, merge } from 'rxjs';
import { Transaction } from '../interfaces/electrs.interface';
import { HealthCheckHost, IBackendInfo, MempoolBlock, MempoolBlockDelta, MempoolInfo, Recommendedfees, ReplacedTransaction, ReplacementInfo, TransactionStripped } from '../interfaces/websocket.interface';
import { BlockExtended, CpfpInfo, DifficultyAdjustment, MempoolPosition, OptimizedMempoolStats, RbfTree } from '../interfaces/node-api.interface';
import { Router, NavigationStart } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { filter, map, scan, shareReplay } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { hasTouchScreen } from '../shared/pipes/bytes-pipe/utils';
import { ActiveFilter } from '../shared/filters.utils';

export interface MarkBlockState {
  blockHeight?: number;
  txid?: string;
  mempoolBlockIndex?: number;
  txFeePerVSize?: number;
  mempoolPosition?: MempoolPosition;
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
  AUDIT: boolean;
  MAINNET_BLOCK_AUDIT_START_HEIGHT: number;
  TESTNET_BLOCK_AUDIT_START_HEIGHT: number;
  SIGNET_BLOCK_AUDIT_START_HEIGHT: number;
  HISTORICAL_PRICE: boolean;
  ACCELERATOR: boolean;
  ADDITIONAL_CURRENCIES: boolean;
  GIT_COMMIT_HASH_MEMPOOL_SPACE?: string;
  PACKAGE_JSON_VERSION_MEMPOOL_SPACE?: string;
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
  'AUDIT': false,
  'MAINNET_BLOCK_AUDIT_START_HEIGHT': 0,
  'TESTNET_BLOCK_AUDIT_START_HEIGHT': 0,
  'SIGNET_BLOCK_AUDIT_START_HEIGHT': 0,
  'HISTORICAL_PRICE': true,
  'ACCELERATOR': false,
  'ADDITIONAL_CURRENCIES': false,
};

@Injectable({
  providedIn: 'root'
})
export class StateService {
  isBrowser: boolean = isPlatformBrowser(this.platformId);
  isMempoolSpaceBuild = window['isMempoolSpaceBuild'] ?? false;
  network = '';
  lightning = false;
  blockVSize: number;
  env: Env;
  latestBlockHeight = -1;
  blocks: BlockExtended[] = [];

  networkChanged$ = new ReplaySubject<string>(1);
  lightningChanged$ = new ReplaySubject<boolean>(1);
  blocksSubject$ = new BehaviorSubject<BlockExtended[]>([]);
  blocks$: Observable<BlockExtended[]>;
  transactions$ = new BehaviorSubject<TransactionStripped[]>(null);
  conversions$ = new ReplaySubject<any>(1);
  bsqPrice$ = new ReplaySubject<number>(1);
  mempoolInfo$ = new ReplaySubject<MempoolInfo>(1);
  mempoolBlocks$ = new ReplaySubject<MempoolBlock[]>(1);
  mempoolBlockTransactions$ = new Subject<TransactionStripped[]>();
  mempoolBlockDelta$ = new Subject<MempoolBlockDelta>();
  liveMempoolBlockTransactions$: Observable<{ [txid: string]: TransactionStripped}>;
  txConfirmed$ = new Subject<[string, BlockExtended]>();
  txReplaced$ = new Subject<ReplacedTransaction>();
  txRbfInfo$ = new Subject<RbfTree>();
  rbfLatest$ = new Subject<RbfTree[]>();
  rbfLatestSummary$ = new Subject<ReplacementInfo[]>();
  utxoSpent$ = new Subject<object>();
  difficultyAdjustment$ = new ReplaySubject<DifficultyAdjustment>(1);
  mempoolTransactions$ = new Subject<Transaction>();
  mempoolTxPosition$ = new Subject<{ txid: string, position: MempoolPosition, cpfp: CpfpInfo | null}>();
  mempoolRemovedTransactions$ = new Subject<Transaction>();
  multiAddressTransactions$ = new Subject<{ [address: string]: { mempool: Transaction[], confirmed: Transaction[], removed: Transaction[] }}>();
  blockTransactions$ = new Subject<Transaction>();
  isLoadingWebSocket$ = new ReplaySubject<boolean>(1);
  isLoadingMempool$ = new BehaviorSubject<boolean>(true);
  vbytesPerSecond$ = new ReplaySubject<number>(1);
  previousRetarget$ = new ReplaySubject<number>(1);
  backendInfo$ = new ReplaySubject<IBackendInfo>(1);
  servicesBackendInfo$ = new ReplaySubject<IBackendInfo>(1);
  loadingIndicators$ = new ReplaySubject<ILoadingIndicators>(1);
  recommendedFees$ = new ReplaySubject<Recommendedfees>(1);
  chainTip$ = new ReplaySubject<number>(-1);
  serverHealth$ = new Subject<HealthCheckHost[]>();

  live2Chart$ = new Subject<OptimizedMempoolStats>();

  viewFiat$ = new BehaviorSubject<boolean>(false);
  connectionState$ = new BehaviorSubject<0 | 1 | 2>(2);
  isTabHidden$: Observable<boolean>;

  markBlock$ = new BehaviorSubject<MarkBlockState>({});
  keyNavigation$ = new Subject<KeyboardEvent>();
  searchText$ = new BehaviorSubject<string>('');

  blockScrolling$: Subject<boolean> = new Subject<boolean>();
  resetScroll$: Subject<boolean> = new Subject<boolean>();
  timeLtr: BehaviorSubject<boolean>;
  hideFlow: BehaviorSubject<boolean>;
  hideAudit: BehaviorSubject<boolean>;
  fiatCurrency$: BehaviorSubject<string>;
  rateUnits$: BehaviorSubject<string>;

  searchFocus$: Subject<boolean> = new Subject<boolean>();
  menuOpen$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  activeGoggles$: BehaviorSubject<ActiveFilter> = new BehaviorSubject({ mode: 'and', filters: [] });

  constructor(
    @Inject(PLATFORM_ID) private platformId: any,
    @Inject(LOCALE_ID) private locale: string,
    private router: Router,
    private storageService: StorageService,
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

    this.liveMempoolBlockTransactions$ = merge(
      this.mempoolBlockTransactions$.pipe(map(transactions => { return { transactions }; })),
      this.mempoolBlockDelta$.pipe(map(delta => { return { delta }; })),
    ).pipe(scan((transactions: { [txid: string]: TransactionStripped }, change: any): { [txid: string]: TransactionStripped } => {
      if (change.transactions) {
        const txMap = {}
        change.transactions.forEach(tx => {
          txMap[tx.txid] = tx;
        })
        return txMap;
      } else {
        change.delta.changed.forEach(tx => {
          transactions[tx.txid].rate = tx.rate;
        })
        change.delta.removed.forEach(txid => {
          delete transactions[txid];
        });
        change.delta.added.forEach(tx => {
          transactions[tx.txid] = tx;
        });
        return transactions;
      }
    }, {}));

    if (this.env.BASE_MODULE === 'bisq') {
      this.network = this.env.BASE_MODULE;
      this.networkChanged$.next(this.env.BASE_MODULE);
    }

    this.networkChanged$.subscribe((network) => {
      this.transactions$ = new BehaviorSubject<TransactionStripped[]>(null);
      this.blocksSubject$.next([]);
    });

    this.blockVSize = this.env.BLOCK_WEIGHT_UNITS / 4;

    this.blocks$ = this.blocksSubject$.pipe(filter(blocks => blocks != null && blocks.length > 0));

    const savedTimePreference = this.storageService.getValue('time-preference-ltr');
    const rtlLanguage = (this.locale.startsWith('ar') || this.locale.startsWith('fa') || this.locale.startsWith('he'));
    // default time direction is right-to-left, unless locale is a RTL language
    this.timeLtr = new BehaviorSubject<boolean>(savedTimePreference === 'true' || (savedTimePreference == null && rtlLanguage));
    this.timeLtr.subscribe((ltr) => {
      this.storageService.setValue('time-preference-ltr', ltr ? 'true' : 'false');
    });

    const savedFlowPreference = this.storageService.getValue('flow-preference');
    this.hideFlow = new BehaviorSubject<boolean>(savedFlowPreference === 'hide');
    this.hideFlow.subscribe((hide) => {
      if (hide) {
        this.storageService.setValue('flow-preference', hide ? 'hide' : 'show');
      } else {
        this.storageService.removeItem('flow-preference');
      }
    });

    const savedAuditPreference = this.storageService.getValue('audit-preference');
    this.hideAudit = new BehaviorSubject<boolean>(savedAuditPreference === 'hide');
    this.hideAudit.subscribe((hide) => {
      this.storageService.setValue('audit-preference', hide ? 'hide' : 'show');
    });
    
    const fiatPreference = this.storageService.getValue('fiat-preference');
    this.fiatCurrency$ = new BehaviorSubject<string>(fiatPreference || 'USD');

    const rateUnitPreference = this.storageService.getValue('rate-unit-preference');
    this.rateUnits$ = new BehaviorSubject<string>(rateUnitPreference || 'vb');
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
    // ($|\/)                                       network string must end or end with a slash
    const networkMatches = url.match(/^\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:preview\/)?(bisq|testnet|liquidtestnet|liquid|signet)($|\/)/);
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

  isAnyTestnet(): boolean {
    return ['testnet', 'signet', 'liquidtestnet'].includes(this.network);
  }

  resetChainTip() {
    this.latestBlockHeight = -1;
    this.chainTip$.next(-1);
  }

  updateChainTip(height) {
    if (height > this.latestBlockHeight) {
      this.latestBlockHeight = height;
      this.chainTip$.next(height);
    }
  }

  resetBlocks(blocks: BlockExtended[]): void {
    this.blocks = blocks.reverse();
    this.blocksSubject$.next(blocks);
  }

  addBlock(block: BlockExtended): void {
    this.blocks.unshift(block);
    this.blocks = this.blocks.slice(0, this.env.KEEP_BLOCKS_AMOUNT);
    this.blocksSubject$.next(this.blocks);
  }

  focusSearchInputDesktop() {
    if (!hasTouchScreen()) {
      this.searchFocus$.next(true);
    }    
  }
}
