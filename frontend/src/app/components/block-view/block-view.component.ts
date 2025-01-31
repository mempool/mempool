import { Component, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { switchMap, tap, catchError, shareReplay, filter } from 'rxjs/operators';
import { of, Subscription } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { BlockExtended, TransactionStripped } from '@interfaces/node-api.interface';
import { ApiService } from '@app/services/api.service';
import { seoDescriptionNetwork } from '@app/shared/common.utils';
import { BlockOverviewGraphComponent } from '@components/block-overview-graph/block-overview-graph.component';
import { RelativeUrlPipe } from '@app/shared/pipes/relative-url/relative-url.pipe';

function bestFitResolution(min, max, n): number {
  const target = (min + max) / 2;
  let bestScore = Infinity;
  let best = null;
  for (let i = min; i <= max; i++) {
    const remainder = (n % i);
    if (remainder < bestScore || (remainder === bestScore && (Math.abs(i - target) < Math.abs(best - target)))) {
      bestScore = remainder;
      best = i;
    }
  }
  return best;
}

@Component({
  selector: 'app-block-view',
  templateUrl: './block-view.component.html',
  styleUrls: ['./block-view.component.scss']
})
export class BlockViewComponent implements OnInit, OnDestroy {
  network = '';
  block: BlockExtended;
  blockHeight: number;
  blockHash: string;
  rawId: string;
  isLoadingBlock = true;
  strippedTransactions: TransactionStripped[];
  isLoadingOverview = true;
  autofit: boolean = false;
  resolution: number = 80;

  overviewSubscription: Subscription;
  networkChangedSubscription: Subscription;
  queryParamsSubscription: Subscription;

  @ViewChild('blockGraph') blockGraph: BlockOverviewGraphComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private electrsApiService: ElectrsApiService,
    public stateService: StateService,
    private seoService: SeoService,
    private apiService: ApiService
  ) { }

  ngOnInit(): void {
    this.network = this.stateService.network;

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      this.autofit = params.autofit === 'true';
      if (this.autofit) {
        this.onResize();
      }
    });

    const block$ = this.route.paramMap.pipe(
      switchMap((params: ParamMap) => {
        this.rawId = params.get('id') || '';

        const blockHash: string = params.get('id') || '';
        this.block = undefined;

        let isBlockHeight = false;
        if (/^[0-9]+$/.test(blockHash)) {
          isBlockHeight = true;
        } else {
          this.blockHash = blockHash;
        }

        this.isLoadingBlock = true;
        this.isLoadingOverview = true;

        if (isBlockHeight) {
          return this.electrsApiService.getBlockHashFromHeight$(parseInt(blockHash, 10))
            .pipe(
              switchMap((hash) => {
                if (hash) {
                  this.blockHash = hash;
                  return this.apiService.getBlock$(hash);
                } else {
                  return null;
                }
              }),
              catchError(() => {
                return of(null);
              }),
            );
        }
        return this.apiService.getBlock$(blockHash);
      }),
      filter((block: BlockExtended | void) => block != null),
      tap((block: BlockExtended) => {
        this.block = block;
        this.blockHeight = block.height;

        this.seoService.setTitle($localize`:@@block.component.browser-title:Block ${block.height}:BLOCK_HEIGHT:: ${block.id}:BLOCK_ID:`);
        if( this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ) {
          this.seoService.setDescription($localize`:@@meta.description.liquid.block:See size, weight, fee range, included transactions, and more for Liquid${seoDescriptionNetwork(this.stateService.network)} block ${block.height}:BLOCK_HEIGHT: (${block.id}:BLOCK_ID:).`);
        } else {
          this.seoService.setDescription($localize`:@@meta.description.bitcoin.block:See size, weight, fee range, included transactions, audit (expected v actual), and more for Bitcoin${seoDescriptionNetwork(this.stateService.network)} block ${block.height}:BLOCK_HEIGHT: (${block.id}:BLOCK_ID:).`);
        }
        this.isLoadingBlock = false;
        this.isLoadingOverview = true;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.overviewSubscription = block$.pipe(
      switchMap((block) => this.apiService.getStrippedBlockTransactions$(block.id)
        .pipe(
          catchError(() => {
            return of([]);
          }),
          switchMap((transactions) => {
            return of(transactions);
          })
        )
      ),
    )
    .subscribe((transactions: TransactionStripped[]) => {
      this.strippedTransactions = transactions;
      this.isLoadingOverview = false;
      if (this.blockGraph) {
        this.blockGraph.destroy();
        this.blockGraph.setup(this.strippedTransactions);
      }
    },
    () => {
      this.isLoadingOverview = false;
      if (this.blockGraph) {
        this.blockGraph.destroy();
      }
    });

    this.networkChangedSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);
  }

  onTxClick(event: { tx: TransactionStripped, keyModifier: boolean }): void {
    const url = new RelativeUrlPipe(this.stateService).transform(`/tx/${event.tx.txid}`);
    if (!event.keyModifier) {
      this.router.navigate([url]);
    } else {
      window.open(url, '_blank');
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (this.autofit) {
      this.resolution = bestFitResolution(64, 96, Math.min(window.innerWidth, window.innerHeight));
    }
  }

  ngOnDestroy(): void {
    if (this.overviewSubscription) {
      this.overviewSubscription.unsubscribe();
    }
    if (this.networkChangedSubscription) {
      this.networkChangedSubscription.unsubscribe();
    }
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
    if (this.blockGraph) {
      this.blockGraph.destroy();
    }
  }
}
