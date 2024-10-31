import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Inject, OnDestroy, OnInit, PLATFORM_ID } from '@angular/core';
import { combineLatest, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, filter, map, scan, share, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { BlockExtended, OptimizedMempoolStats, TransactionStripped } from '@interfaces/node-api.interface';
import { MempoolInfo, ReplacementInfo } from '@interfaces/websocket.interface';
import { ApiService } from '@app/services/api.service';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { ActiveFilter, FilterMode, GradientMode, toFlags } from '@app/shared/filters.utils';
import { detectWebGL } from '@app/shared/graphs.utils';
import { Address, AddressTxSummary } from '@interfaces/electrs.interface';
import { ElectrsApiService } from '@app/services/electrs-api.service';

interface MempoolBlocksData {
  blocks: number;
  size: number;
}

interface MempoolInfoData {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  progressWidth: string;
  progressColor: string;
}

interface MempoolStatsData {
  mempool: OptimizedMempoolStats[];
  weightPerSecond: any;
}

@Component({
  selector: 'app-custom-dashboard',
  templateUrl: './custom-dashboard.component.html',
  styleUrls: ['./custom-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomDashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  network$: Observable<string>;
  mempoolBlocksData$: Observable<MempoolBlocksData>;
  mempoolInfoData$: Observable<MempoolInfoData>;
  mempoolLoadingStatus$: Observable<number>;
  vBytesPerSecondLimit = 1667;
  transactions$: Observable<TransactionStripped[]>;
  blocks$: Observable<BlockExtended[]>;
  replacements$: Observable<ReplacementInfo[]>;
  latestBlockHeight: number;
  mempoolTransactionsWeightPerSecondData: any;
  mempoolStats$: Observable<MempoolStatsData>;
  transactionsWeightPerSecondOptions: any;
  isLoadingWebSocket$: Observable<boolean>;
  isLoad: boolean = true;
  filterSubscription: Subscription;
  mempoolInfoSubscription: Subscription;
  currencySubscription: Subscription;
  currency: string;
  incomingGraphHeight: number = 300;
  graphHeight: number = 300;
  webGlEnabled = true;
  isMobile: boolean = window.innerWidth <= 767.98;

  widgets;

  addressSubscription: Subscription;
  walletSubscription: Subscription;
  blockTxSubscription: Subscription;
  addressSummary$: Observable<AddressTxSummary[]>;
  walletSummary$: Observable<AddressTxSummary[]>;
  address: Address;

  goggleResolution = 82;
  goggleCycle: { index: number, name: string, mode: FilterMode, filters: string[], gradient: GradientMode }[] = [
    { index: 0, name: $localize`:@@dfc3c34e182ea73c5d784ff7c8135f087992dac1:All`, mode: 'and', filters: [], gradient: 'age' },
    { index: 1, name: $localize`Consolidation`, mode: 'and', filters: ['consolidation'], gradient: 'fee' },
    { index: 2, name: $localize`Coinjoin`, mode: 'and', filters: ['coinjoin'], gradient: 'fee' },
    { index: 3, name: $localize`Data`, mode: 'or', filters: ['inscription', 'fake_pubkey', 'fake_scripthash', 'op_return'], gradient: 'fee' },
  ];
  goggleFlags = 0n;
  goggleMode: FilterMode = 'and';
  gradientMode: GradientMode = 'age';
  goggleIndex = 0;

  private destroy$ = new Subject();

  constructor(
    public stateService: StateService,
    private apiService: ApiService,
    private electrsApiService: ElectrsApiService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private cd: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {
    this.webGlEnabled = this.stateService.isBrowser && detectWebGL();
    this.widgets = this.stateService.env.customize?.dashboard.widgets || [];
  }

  ngAfterViewInit(): void {
    this.stateService.focusSearchInputDesktop();
  }

  ngOnDestroy(): void {
    this.filterSubscription.unsubscribe();
    this.mempoolInfoSubscription.unsubscribe();
    this.currencySubscription.unsubscribe();
    this.websocketService.stopTrackRbfSummary();
    if (this.addressSubscription) {
      this.addressSubscription.unsubscribe();
      this.websocketService.stopTrackingAddress();
      this.address = null;
    }
    if (this.walletSubscription) {
      this.walletSubscription.unsubscribe();
      this.websocketService.stopTrackingWallet();
    }
    this.destroy$.next(1);
    this.destroy$.complete();
  }

  ngOnInit(): void {
    this.onResize();
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.seoService.resetTitle();
    this.seoService.resetDescription();
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks', 'live-2h-chart']);
    this.websocketService.startTrackRbfSummary();
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.mempoolLoadingStatus$ = this.stateService.loadingIndicators$
      .pipe(
        map((indicators) => indicators.mempool !== undefined ? indicators.mempool : 100)
      );

    this.filterSubscription = this.stateService.activeGoggles$.subscribe((active: ActiveFilter) => {
      const activeFilters = active.filters.sort().join(',');
      for (const goggle of this.goggleCycle) {
        if (goggle.mode === active.mode) {
          const goggleFilters = goggle.filters.sort().join(',');
          if (goggleFilters === activeFilters) {
            this.goggleIndex = goggle.index;
            this.goggleFlags = toFlags(goggle.filters);
            this.goggleMode = goggle.mode;
            this.gradientMode = active.gradient;
            return;
          }
        }
      }
      this.goggleCycle.push({
        index: this.goggleCycle.length,
        name: 'Custom',
        mode: active.mode,
        filters: active.filters,
        gradient: active.gradient,
      });
      this.goggleIndex = this.goggleCycle.length - 1;
      this.goggleFlags = toFlags(active.filters);
      this.goggleMode = active.mode;
    });

    this.mempoolInfoData$ = combineLatest([
      this.stateService.mempoolInfo$,
      this.stateService.vbytesPerSecond$
    ]).pipe(
      map(([mempoolInfo, vbytesPerSecond]) => {
        const percent = Math.round((Math.min(vbytesPerSecond, this.vBytesPerSecondLimit) / this.vBytesPerSecondLimit) * 100);

        let progressColor = 'bg-success';
        if (vbytesPerSecond > 1667) {
          progressColor = 'bg-warning';
        }
        if (vbytesPerSecond > 3000) {
          progressColor = 'bg-danger';
        }

        const mempoolSizePercentage = (mempoolInfo.usage / mempoolInfo.maxmempool * 100);
        let mempoolSizeProgress = 'bg-danger';
        if (mempoolSizePercentage <= 50) {
          mempoolSizeProgress = 'bg-success';
        } else if (mempoolSizePercentage <= 75) {
          mempoolSizeProgress = 'bg-warning';
        }

        return {
          memPoolInfo: mempoolInfo,
          vBytesPerSecond: vbytesPerSecond,
          progressWidth: percent + '%',
          progressColor: progressColor,
          mempoolSizeProgress: mempoolSizeProgress,
        };
      })
    );

    this.mempoolInfoSubscription = this.mempoolInfoData$.subscribe();

    this.mempoolBlocksData$ = this.stateService.mempoolBlocks$
      .pipe(
        map((mempoolBlocks) => {
          const size = mempoolBlocks.map((m) => m.blockSize).reduce((a, b) => a + b, 0);
          const vsize = mempoolBlocks.map((m) => m.blockVSize).reduce((a, b) => a + b, 0);

          return {
            size: size,
            blocks: Math.ceil(vsize / this.stateService.blockVSize)
          };
        })
      );

    this.transactions$ = this.stateService.transactions$;

    this.blocks$ = this.stateService.blocks$
      .pipe(
        tap((blocks) => {
          this.latestBlockHeight = blocks[0].height;
        }),
        switchMap((blocks) => {
          if (this.stateService.env.MINING_DASHBOARD === true) {
            for (const block of blocks) {
              // @ts-ignore: Need to add an extra field for the template
              block.extras.pool.logo = `/resources/mining-pools/` +
                block.extras.pool.slug + '.svg';
            }
          }
          return of(blocks.slice(0, 6));
        })
      );

    this.replacements$ = this.stateService.rbfLatestSummary$;

    this.mempoolStats$ = this.stateService.connectionState$
      .pipe(
        filter((state) => state === 2),
        switchMap(() => this.apiService.list2HStatistics$().pipe(
          catchError((e) => {
            return of(null);
          })
        )),
        switchMap((mempoolStats) => {
          return merge(
            this.stateService.live2Chart$
              .pipe(
                scan((acc, stats) => {
                  const now = Date.now() / 1000;
                  const start = now - (2 * 60 * 60);
                  acc.unshift(stats);
                  acc = acc.filter(p => p.added >= start);
                  return acc;
                }, (mempoolStats || []))
              ),
            of(mempoolStats)
          );
        }),
        map((mempoolStats) => {
          if (mempoolStats) {
            return {
              mempool: mempoolStats,
              weightPerSecond: this.handleNewMempoolData(mempoolStats.concat([])),
            };
          } else {
            return null;
          }
        }),
        shareReplay(1),
      );

    this.currencySubscription = this.stateService.fiatCurrency$.subscribe((fiat) => {
      this.currency = fiat;
    });

    this.startAddressSubscription();
    this.startWalletSubscription();
  }

  handleNewMempoolData(mempoolStats: OptimizedMempoolStats[]) {
    mempoolStats.reverse();
    const labels = mempoolStats.map(stats => stats.added);

    return {
      labels: labels,
      series: [mempoolStats.map((stats) => [stats.added * 1000, stats.vbytes_per_second])],
    };
  }

  trackByBlock(index: number, block: BlockExtended) {
    return block.height;
  }

  getArrayFromNumber(num: number): number[] {
    return Array.from({ length: num }, (_, i) => i + 1);
  }
  
  setFilter(index): void {
    const selected = this.goggleCycle[index];
    this.stateService.activeGoggles$.next(selected);
  }

  startAddressSubscription(): void {
    if (this.stateService.env.customize && this.stateService.env.customize.dashboard.widgets.some(w => w.props?.address)) {
      let addressString = this.stateService.env.customize.dashboard.widgets.find(w => w.props?.address).props.address;
      addressString = (/^[A-Z]{2,5}1[AC-HJ-NP-Z02-9]{8,100}|04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}$/.test(addressString)) ? addressString.toLowerCase() : addressString;
      
      this.addressSubscription = (
        addressString.match(/04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}/)
        ? this.electrsApiService.getPubKeyAddress$(addressString)
        : this.electrsApiService.getAddress$(addressString)
      ).pipe(
          catchError((err) => {
            console.log(err);
            return of(null);
          }),
          filter((address) => !!address),
        ).subscribe((address: Address) => {
          this.websocketService.startTrackAddress(address.address);
          this.address = address;
          this.cd.markForCheck();
        });

      this.addressSummary$ = (
        addressString.match(/04[a-fA-F0-9]{128}|(02|03)[a-fA-F0-9]{64}/)
        ? this.electrsApiService.getScriptHashSummary$((addressString.length === 66 ? '21' : '41') + addressString + 'ac')
        : this.electrsApiService.getAddressSummary$(addressString)).pipe(
        catchError(e => {
          return of(null);
        }),
        switchMap(initial => this.stateService.blockTransactions$.pipe(
          startWith(null),
          scan((summary, tx) => {
            if (tx && !summary.some(t => t.txid === tx.txid)) {
              let value = 0;
              let funded = 0;
              let fundedCount = 0;
              let spent = 0;
              let spentCount = 0;
              for (const vout of tx.vout) {
                if (vout.scriptpubkey_address === addressString) {
                  value += vout.value;
                  funded += vout.value;
                  fundedCount++;
                }
              }
              for (const vin of tx.vin) {
                if (vin.prevout?.scriptpubkey_address === addressString) {
                  value -= vin.prevout?.value;
                  spent += vin.prevout?.value;
                  spentCount++;
                }
              }
              if (this.address && this.address.address === addressString) {
                this.address.chain_stats.tx_count++;
                this.address.chain_stats.funded_txo_sum += funded;
                this.address.chain_stats.funded_txo_count += fundedCount;
                this.address.chain_stats.spent_txo_sum += spent;
                this.address.chain_stats.spent_txo_count += spentCount;
              }
              summary.unshift({
                txid: tx.txid,
                time: tx.status?.block_time,
                height: tx.status?.block_height,
                value
              });
            }
            return summary;
          }, initial)
        )),
        share(),
      );
    }
  }

  startWalletSubscription(): void {
    if (this.stateService.env.customize && this.stateService.env.customize.dashboard.widgets.some(w => w.props?.wallet)) {
      const walletName = this.stateService.env.customize.dashboard.widgets.find(w => w.props?.wallet).props.wallet;
      this.websocketService.startTrackingWallet(walletName);

      this.walletSummary$ =  this.apiService.getWallet$(walletName).pipe(
        catchError(e => {
          return of({});
        }),
        switchMap(wallet => this.stateService.walletTransactions$.pipe(
          startWith([]),
          scan((summaries, newTransactions) => {
            const newSummaries: AddressTxSummary[] = [];
            for (const tx of newTransactions) {
              const funded: Record<string, number> = {};
              const spent: Record<string, number> = {};
              const fundedCount: Record<string, number> = {};
              const spentCount: Record<string, number> = {};
              for (const vin of tx.vin) {
                const address = vin.prevout?.scriptpubkey_address;
                if (address && wallet[address]) {
                  spent[address] = (spent[address] ?? 0) + (vin.prevout?.value ?? 0);
                  spentCount[address] = (spentCount[address] ?? 0) + 1;
                }
              }
              for (const vout of tx.vout) {
                const address = vout.scriptpubkey_address;
                if (address && wallet[address]) {
                  funded[address] = (funded[address] ?? 0) + (vout.value ?? 0);
                  fundedCount[address] = (fundedCount[address] ?? 0) + 1;
                }
              }
              for (const address of Object.keys({ ...funded, ...spent })) {
                // add tx to summary
                const txSummary: AddressTxSummary = {
                  txid: tx.txid,
                  value: (funded[address] ?? 0) - (spent[address] ?? 0),
                  height: tx.status.block_height,
                  time: tx.status.block_time,
                };
                wallet[address].transactions?.push(txSummary);
                newSummaries.push(txSummary);
              }
            }
            return this.deduplicateWalletTransactions([...summaries, ...newSummaries]);
          }, this.deduplicateWalletTransactions(Object.values(wallet).flatMap(address => address.transactions)))
        )),
        share(),
      );
    }
  }

  deduplicateWalletTransactions(walletTransactions: AddressTxSummary[]): AddressTxSummary[] {
    const transactions = new Map<string, AddressTxSummary>();
    for (const tx of walletTransactions) {
      if (transactions.has(tx.txid)) {
        transactions.get(tx.txid).value += tx.value;
      } else {
        transactions.set(tx.txid, tx);
      }
    }
    return Array.from(transactions.values()).sort((a, b) => {
      if (a.height === b.height) {
        return b.tx_position - a.tx_position;
      }
      return b.height - a.height;
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 992) {
      this.incomingGraphHeight = 300;
      this.goggleResolution = 82;
      this.graphHeight = 400;
    } else if (window.innerWidth >= 768) {
      this.incomingGraphHeight = 215;
      this.goggleResolution = 80;
      this.graphHeight = 310;
    } else {
      this.incomingGraphHeight = 180;
      this.goggleResolution = 86;
      this.graphHeight = 310;
    }
    this.isMobile = window.innerWidth <= 767.98;
  }
}
