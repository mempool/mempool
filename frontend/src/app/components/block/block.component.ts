import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ElectrsApiService } from '../../services/electrs-api.service';
import { switchMap, tap, throttleTime, catchError, map, shareReplay, startWith, pairwise } from 'rxjs/operators';
import { Transaction, Vout } from '../../interfaces/electrs.interface';
import { Observable, of, Subscription, asyncScheduler } from 'rxjs';
import { StateService } from '../../services/state.service';
import { SeoService } from 'src/app/services/seo.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';
import { BlockExtended, TransactionStripped } from 'src/app/interfaces/node-api.interface';
import { ApiService } from 'src/app/services/api.service';
import { BlockOverviewGraphComponent } from 'src/app/components/block-overview-graph/block-overview-graph.component';
import { detectWebGL } from 'src/app/shared/graphs.utils';

@Component({
  selector: 'app-block',
  templateUrl: './block.component.html',
  styleUrls: ['./block.component.scss']
})
export class BlockComponent implements OnInit, OnDestroy {
  network = '';
  block: BlockExtended;
  blockHeight: number;
  lastBlockHeight: number;
  nextBlockHeight: number;
  blockHash: string;
  isLoadingBlock = true;
  latestBlock: BlockExtended;
  latestBlocks: BlockExtended[] = [];
  transactions: Transaction[];
  isLoadingTransactions = true;
  strippedTransactions: TransactionStripped[];
  overviewTransitionDirection: string;
  isLoadingOverview = true;
  error: any;
  blockSubsidy: number;
  fees: number;
  paginationMaxSize: number;
  page = 1;
  itemsPerPage: number;
  txsLoadingStatus$: Observable<number>;
  showDetails = false;
  showPreviousBlocklink = true;
  showNextBlocklink = true;
  transactionsError: any = null;
  overviewError: any = null;
  webGlEnabled = true;

  transactionSubscription: Subscription;
  overviewSubscription: Subscription;
  keyNavigationSubscription: Subscription;
  blocksSubscription: Subscription;
  networkChangedSubscription: Subscription;
  queryParamsSubscription: Subscription;
  nextBlockSubscription: Subscription = undefined;
  nextBlockSummarySubscription: Subscription = undefined;
  nextBlockTxListSubscription: Subscription = undefined;

  @ViewChild('blockGraph') blockGraph: BlockOverviewGraphComponent;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private seoService: SeoService,
    private websocketService: WebsocketService,
    private relativeUrlPipe: RelativeUrlPipe,
    private apiService: ApiService
  ) {
    this.webGlEnabled = detectWebGL();
  }

  ngOnInit() {
    this.websocketService.want(['blocks', 'mempool-blocks']);
    this.paginationMaxSize = window.matchMedia('(max-width: 670px)').matches ? 3 : 5;
    this.network = this.stateService.network;
    this.itemsPerPage = this.stateService.env.ITEMS_PER_PAGE;

    this.txsLoadingStatus$ = this.route.paramMap
      .pipe(
        switchMap(() => this.stateService.loadingIndicators$),
        map((indicators) => indicators['blocktxs-' + this.blockHash] !== undefined ? indicators['blocktxs-' + this.blockHash] : 0)
      );

    this.blocksSubscription = this.stateService.blocks$
      .subscribe(([block]) => {
        this.latestBlock = block;
        this.latestBlocks.unshift(block);
        this.latestBlocks = this.latestBlocks.slice(0, this.stateService.env.KEEP_BLOCKS_AMOUNT);
        this.setNextAndPreviousBlockLink();

        if (block.id === this.blockHash) {
          this.block = block;
          if (block?.extras?.reward != undefined) {
            this.fees = block.extras.reward / 100000000 - this.blockSubsidy;
          }
        }
      });

    const block$ = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        const blockHash: string = params.get('id') || '';
        this.block = undefined;
        this.page = 1;
        this.error = undefined;
        this.fees = undefined;
        this.stateService.markBlock$.next({});

        if (history.state.data && history.state.data.blockHeight) {
          this.blockHeight = history.state.data.blockHeight;
        }

        let isBlockHeight = false;
        if (/^[0-9]+$/.test(blockHash)) {
          isBlockHeight = true;
        } else {
          this.blockHash = blockHash;
        }
        document.body.scrollTo(0, 0);

        if (history.state.data && history.state.data.block) {
          this.blockHeight = history.state.data.block.height;
          return of(history.state.data.block);
        } else {
          this.isLoadingBlock = true;
          this.isLoadingOverview = true;

          let blockInCache: BlockExtended;
          if (isBlockHeight) {
            blockInCache = this.latestBlocks.find((block) => block.height === parseInt(blockHash, 10));
            if (blockInCache) {
              return of(blockInCache);
            }
            return this.electrsApiService.getBlockHashFromHeight$(parseInt(blockHash, 10))
              .pipe(
                switchMap((hash) => {
                  this.blockHash = hash;
                  this.location.replaceState(
                    this.router.createUrlTree([(this.network ? '/' + this.network : '') + '/block/', hash]).toString()
                  );
                  return this.apiService.getBlock$(hash);
                })
              );
          }

          blockInCache = this.latestBlocks.find((block) => block.id === this.blockHash);
          if (blockInCache) {
            return of(blockInCache);
          }

          return this.apiService.getBlock$(blockHash);
        }
      }),
      tap((block: BlockExtended) => {
        if (block.height > 0) {
          // Preload previous block summary (execute the http query so the response will be cached)
          this.unsubscribeNextBlockSubscriptions();
          setTimeout(() => {
            this.nextBlockSubscription = this.apiService.getBlock$(block.previousblockhash).subscribe();
            this.nextBlockTxListSubscription = this.electrsApiService.getBlockTransactions$(block.previousblockhash).subscribe();
            this.nextBlockSummarySubscription = this.apiService.getStrippedBlockTransactions$(block.previousblockhash).subscribe();
          }, 100);
        }

        this.block = block;
        this.blockHeight = block.height;
        const direction = (this.lastBlockHeight < this.blockHeight) ? 'right' : 'left';
        this.lastBlockHeight = this.blockHeight;
        this.nextBlockHeight = block.height + 1;
        this.setNextAndPreviousBlockLink();

        this.seoService.setTitle($localize`:@@block.component.browser-title:Block ${block.height}:BLOCK_HEIGHT:: ${block.id}:BLOCK_ID:`);
        this.isLoadingBlock = false;
        this.setBlockSubsidy();
        if (block?.extras?.reward !== undefined) {
          this.fees = block.extras.reward / 100000000 - this.blockSubsidy;
        }
        this.stateService.markBlock$.next({ blockHeight: this.blockHeight });
        this.isLoadingTransactions = true;
        this.transactions = null;
        this.transactionsError = null;
        this.isLoadingOverview = true;
        this.overviewError = null;
      }),
      throttleTime(300, asyncScheduler, { leading: true, trailing: true }),
      shareReplay(1)
    );
    this.transactionSubscription = block$.pipe(
      switchMap((block) => this.electrsApiService.getBlockTransactions$(block.id)
        .pipe(
          catchError((err) => {
            this.transactionsError = err;
            return of([]);
        }))
      ),
    )
    .subscribe((transactions: Transaction[]) => {
      if (this.fees === undefined && transactions[0]) {
        this.fees = transactions[0].vout.reduce((acc: number, curr: Vout) => acc + curr.value, 0) / 100000000 - this.blockSubsidy;
      }
      this.transactions = transactions;
      this.isLoadingTransactions = false;
    },
    (error) => {
      this.error = error;
      this.isLoadingBlock = false;
      this.isLoadingOverview = false;
    });

    this.overviewSubscription = block$.pipe(
      startWith(null),
      pairwise(),
      switchMap(([prevBlock, block]) => this.apiService.getStrippedBlockTransactions$(block.id)
        .pipe(
          catchError((err) => {
            this.overviewError = err;
            return of([]);
          }),
          switchMap((transactions) => {
            if (prevBlock) {
              return of({ transactions, direction: (prevBlock.height < block.height) ? 'right' : 'left' });
            } else {
              return of({ transactions, direction: 'down' });
            }
          })
        )
      ),
    )
    .subscribe(({transactions, direction}: {transactions: TransactionStripped[], direction: string}) => {
      this.strippedTransactions = transactions;
      this.isLoadingOverview = false;
      if (this.blockGraph) {
        this.blockGraph.destroy();
        this.blockGraph.setup(this.strippedTransactions);
      }
    },
    (error) => {
      this.error = error;
      this.isLoadingOverview = false;
      if (this.blockGraph) {
        this.blockGraph.destroy();
      }
    });

    this.networkChangedSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      if (params.showDetails === 'true') {
        this.showDetails = true;
      } else {
        this.showDetails = false;
      }
    });

    this.keyNavigationSubscription = this.stateService.keyNavigation$.subscribe((event) => {
      if (this.showPreviousBlocklink && event.key === 'ArrowRight' && this.nextBlockHeight - 2 >= 0) {
        this.navigateToPreviousBlock();
      }
      if (event.key === 'ArrowLeft') {
        if (this.showNextBlocklink) {
          this.navigateToNextBlock();
        } else {
          this.router.navigate([this.relativeUrlPipe.transform('/mempool-block'), '0']);
        }
      }
    });
  }

  ngOnDestroy() {
    this.stateService.markBlock$.next({});
    this.transactionSubscription.unsubscribe();
    this.overviewSubscription.unsubscribe();
    this.keyNavigationSubscription.unsubscribe();
    this.blocksSubscription.unsubscribe();
    this.networkChangedSubscription.unsubscribe();
    this.queryParamsSubscription.unsubscribe();
    this.unsubscribeNextBlockSubscriptions();
  }

  unsubscribeNextBlockSubscriptions() {
    if (this.nextBlockSubscription !== undefined) {
      this.nextBlockSubscription.unsubscribe();
    }
    if (this.nextBlockSummarySubscription !== undefined) {
      this.nextBlockSummarySubscription.unsubscribe();
    }
    if (this.nextBlockTxListSubscription !== undefined) {
      this.nextBlockTxListSubscription.unsubscribe();
    }
  }

  // TODO - Refactor this.fees/this.reward for liquid because it is not
  // used anymore on Bitcoin networks (we use block.extras directly)
  setBlockSubsidy() {
    this.blockSubsidy = 0;
  }

  pageChange(page: number, target: HTMLElement) {
    const start = (page - 1) * this.itemsPerPage;
    this.isLoadingTransactions = true;
    this.transactions = null;
    this.transactionsError = null;
    target.scrollIntoView(); // works for chrome

    this.electrsApiService.getBlockTransactions$(this.block.id, start)
      .pipe(
        catchError((err) => {
          this.transactionsError = err;
          return of([]);
      })
      )
     .subscribe((transactions) => {
        this.transactions = transactions;
        this.isLoadingTransactions = false;
        target.scrollIntoView(); // works for firefox
      });
  }

  toggleShowDetails() {
    if (this.showDetails) {
      this.showDetails = false;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { showDetails: false },
        queryParamsHandling: 'merge',
        fragment: 'block'
      });
    } else {
      this.showDetails = true;
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { showDetails: true },
        queryParamsHandling: 'merge',
        fragment: 'details'
      });
    }
  }

  hasTaproot(version: number): boolean {
    const versionBit = 2; // Taproot
    return (Number(version) & (1 << versionBit)) === (1 << versionBit);
  }

  displayTaprootStatus(): boolean {
    if (this.stateService.network !== '') {
      return false;
    }
    return this.block && this.block.height > 681393 && (new Date().getTime() / 1000) < 1628640000;
  }

  onResize(event: any) {
    this.paginationMaxSize = event.target.innerWidth < 670 ? 3 : 5;
  }

  navigateToPreviousBlock() {
    if (!this.block) {
      return;
    }
    const block = this.latestBlocks.find((b) => b.height === this.nextBlockHeight - 2);
    this.router.navigate([this.relativeUrlPipe.transform('/block/'),
      block ? block.id : this.block.previousblockhash], { state: { data: { block, blockHeight: this.nextBlockHeight - 2 } } });
  }

  navigateToNextBlock() {
    const block = this.latestBlocks.find((b) => b.height === this.nextBlockHeight);
    this.router.navigate([this.relativeUrlPipe.transform('/block/'),
      block ? block.id : this.nextBlockHeight], { state: { data: { block, blockHeight: this.nextBlockHeight } } });
  }

  setNextAndPreviousBlockLink(){
    if (this.latestBlock && this.blockHeight) {
      if (this.blockHeight === 0){
        this.showPreviousBlocklink = false;
      } else {
        this.showPreviousBlocklink = true;
      }
      if (this.latestBlock.height && this.latestBlock.height === this.blockHeight) {
        this.showNextBlocklink = false;
      } else {
        this.showNextBlocklink = true;
      }
    }
  }

  onTxClick(event: TransactionStripped): void {
    const url = new RelativeUrlPipe(this.stateService).transform(`/tx/${event.txid}`);
    this.router.navigate([url]);
  }
}