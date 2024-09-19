import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { Subject, Subscription, of } from 'rxjs';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { BlockExtended, TransactionStripped } from '../../interfaces/node-api.interface';
import { ApiService } from '../../services/api.service';
import { detectWebGL } from '../../shared/graphs.utils';
import { animate, style, transition, trigger } from '@angular/animations';
import { BytesPipe } from '../../shared/pipes/bytes-pipe/bytes.pipe';
import { BlockOverviewMultiComponent } from '../block-overview-multi/block-overview-multi.component';
import { CacheService } from '../../services/cache.service';

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

interface BlockInfo extends BlockExtended {
  timeString: string;
}

@Component({
  selector: 'app-eight-blocks',
  templateUrl: './eight-blocks.component.html',
  styleUrls: ['./eight-blocks.component.scss'],
  animations: [
    trigger('infoChange', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('1000ms', style({ opacity: 1 })),
      ]),
      transition(':leave', [
        animate('1000ms 500ms', style({ opacity: 0 }))
      ])
    ]),
  ],
})
export class EightBlocksComponent implements OnInit, OnDestroy {
  network = '';
  latestBlocks: (BlockExtended | null)[] = [];
  pendingBlocks: Record<number, ((b: BlockExtended) => void)[]> = {};
  isLoadingTransactions = true;
  strippedTransactions: { [height: number]: TransactionStripped[] } = {};
  webGlEnabled = true;
  hoverTx: string | null = null;

  tipSubscription: Subscription;
  cacheBlocksSubscription: Subscription;
  networkChangedSubscription: Subscription;
  queryParamsSubscription: Subscription;
  graphChangeSubscription: Subscription;

  height: number = 0;
  numBlocks: number = 8;
  blockIndices: number[] = [...Array(8).keys()];
  autofit: boolean = false;
  padding: number = 0;
  wrapBlocks: boolean = false;
  blockWidth: number = 360;
  animationDuration: number = 2000;
  animationOffset: number = 0;
  stagger: number = 0;
  testing: boolean = true;
  testHeight: number = 800000;
  testShiftTimeout: number;

  showInfo: boolean = true;
  blockInfo: BlockInfo[] = [];

  wrapperStyle = {
    '--block-width': '1080px',
    width: '1080px',
    height: '1080px',
    maxWidth: '1080px',
    padding: '',
  };
  containerStyle = {};
  resolution: number = 86;

  @ViewChild('blockGraph') blockGraph: BlockOverviewMultiComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public stateService: StateService,
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private cacheService: CacheService,
    private bytesPipe: BytesPipe,
  ) {
    this.webGlEnabled = this.stateService.isBrowser && detectWebGL();
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);
    this.network = this.stateService.network;

    this.queryParamsSubscription = this.route.queryParams.subscribe((params) => {
      this.numBlocks = Number.isInteger(Number(params.numBlocks)) ? Number(params.numBlocks) : 8;
      this.blockIndices = [...Array(this.numBlocks).keys()];
      this.autofit = params.autofit !== 'false';
      this.padding = Number.isInteger(Number(params.padding)) ? Number(params.padding) : 10;
      this.blockWidth = Number.isInteger(Number(params.blockWidth)) ? Number(params.blockWidth) : 540;
      this.wrapBlocks = params.wrap !== 'false';
      this.stagger = Number.isInteger(Number(params.stagger)) ? Number(params.stagger) : 0;
      this.animationDuration = Number.isInteger(Number(params.animationDuration)) ? Number(params.animationDuration) : 2000;
      this.animationOffset = 0;

      if (this.autofit) {
        this.resolution = bestFitResolution(76, 96, this.blockWidth - this.padding * 2);
      } else {
        this.resolution = 86;
      }

      this.wrapperStyle = {
        '--block-width': this.blockWidth + 'px',
        width: this.blockWidth + 'px',
        height: this.blockWidth + 'px',
        maxWidth: this.blockWidth + 'px',
        padding: (this.padding || 0) +'px 0px',
      };

      this.cacheBlocksSubscription = this.cacheService.loadedBlocks$.subscribe((block: BlockExtended) => {
        if (this.pendingBlocks[block.height]) {
          this.pendingBlocks[block.height].forEach(resolve => resolve(block));
          delete this.pendingBlocks[block.height];
        }
      });

      this.tipSubscription?.unsubscribe();
      if (params.test === 'true') {
        this.shiftTestBlocks();
      } else {
        this.tipSubscription = this.stateService.chainTip$
          .subscribe((height) => {
            this.height = height;
            this.handleNewBlock(height);
          });
      }
    });

    this.setupBlockGraphs();

    this.networkChangedSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);
  }

  ngAfterViewInit(): void {
    this.setupBlockGraphs();
  }

  ngOnDestroy(): void {
    this.stateService.markBlock$.next({});
    if (this.tipSubscription) {
      this.tipSubscription?.unsubscribe();
    }
    this.cacheBlocksSubscription?.unsubscribe();
    this.networkChangedSubscription?.unsubscribe();
    this.queryParamsSubscription?.unsubscribe();
  }

  shiftTestBlocks(): void {
    const sub = this.apiService.getBlocks$(this.testHeight).subscribe(result => {
      sub.unsubscribe();
      this.handleNewBlock(this.testHeight);
      this.testHeight++;
      clearTimeout(this.testShiftTimeout);
      this.testShiftTimeout = window.setTimeout(() => { this.shiftTestBlocks(); }, 10000);
    });
  }

  async handleNewBlock(height: number): Promise<void> {
    const readyPromises: Promise<TransactionStripped[]>[] = [];
    const previousBlocks = this.latestBlocks;

    const blocks = await this.loadBlocks(height, this.numBlocks);
    console.log('loaded ', blocks.length, ' blocks from height ', height);
    console.log(blocks);

    const newHeights = {};
    this.latestBlocks = blocks;
    for (const block of blocks) {
      newHeights[block.height] = true;
      if (!this.strippedTransactions[block.height]) {
        readyPromises.push(this.loadBlockTransactions(block));
      }
    }
    await Promise.allSettled(readyPromises);
    this.updateBlockGraphs(blocks);

    // free up old transactions
    previousBlocks.forEach(block => {
      if (!newHeights[block.height]) {
        delete this.strippedTransactions[block.height];
      }
    });
  }

  async loadBlocks(height: number, numBlocks: number): Promise<BlockExtended[]> {
    console.log('loading ', numBlocks, ' blocks from height ', height);
    const promises: Promise<BlockExtended>[] = [];
    for (let i = 0; i < numBlocks; i++) {
      this.cacheService.loadBlock(height - i);
      const cachedBlock = this.cacheService.getCachedBlock(height - i);
      if (cachedBlock) {
        promises.push(Promise.resolve(cachedBlock));
      } else {
        promises.push(new Promise((resolve) => {
          if (!this.pendingBlocks[height - i]) {
            this.pendingBlocks[height - i] = [];
          }
          this.pendingBlocks[height - i].push(resolve);
        }));
      }
    }
    return Promise.all(promises);
  }

  async loadBlockTransactions(block: BlockExtended): Promise<TransactionStripped[]> {
    return new Promise((resolve) => {
      this.apiService.getStrippedBlockTransactions$(block.id).pipe(
        catchError(() => {
          return of([]);
        }),
      ).subscribe((transactions) => {
        this.strippedTransactions[block.height] = transactions;
        resolve(transactions);
      });
    });
  }

  updateBlockGraphs(blocks): void {
    const startTime = performance.now() + 1000 - (this.stagger < 0 ? this.stagger * 8 : 0);
    if (this.blockGraph) {
      for (let i = 0; i < this.numBlocks; i++) {
        this.blockGraph.replace(i, this.strippedTransactions[blocks?.[i]?.height] || [], 'right', false, startTime + (this.stagger * i));
      }
    }
    this.showInfo = false;
    setTimeout(() => {
      this.blockInfo = blocks.map(block => {
        return {
          ...block,
          timeString: (new Date(block.timestamp * 1000)).toLocaleTimeString(),
        };
      });
      this.showInfo = true;
    }, 1600);  // Should match the animation time.
  }

  setupBlockGraphs(): void {
    if (this.blockGraph) {
      for (let i = 0; i < this.numBlocks; i++) {
        this.blockGraph.destroy(i);
        this.blockGraph.setup(i, this.strippedTransactions[this.latestBlocks?.[i]?.height] || []);
      }
    }
  }
}
