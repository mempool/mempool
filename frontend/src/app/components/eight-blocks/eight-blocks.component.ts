import { Component, OnInit, OnDestroy, ViewChild, HostListener } from '@angular/core';
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
  autoNumBlocks: boolean = false;
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
    margin: '',
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
      this.autofit = params.autofit !== 'false';
      this.numBlocks = Number.isInteger(Number(params.numBlocks)) ? Number(params.numBlocks) : 0;
      this.blockWidth = Number.isInteger(Number(params.blockWidth)) ? Number(params.blockWidth) : 320;
      this.padding = Number.isInteger(Number(params.padding)) ? Number(params.padding) : 4;
      this.wrapBlocks = params.wrap !== 'false';
      this.stagger = Number.isInteger(Number(params.stagger)) ? Number(params.stagger) : 0;
      this.animationDuration = Number.isInteger(Number(params.animationDuration)) ? Number(params.animationDuration) : 2000;
      this.animationOffset = 0;

      if (!this.numBlocks) {
        this.autoNumBlocks = true;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const paddedWidth = this.blockWidth + (this.padding * 2);
        this.numBlocks = Math.floor(width / paddedWidth) * Math.floor(height / paddedWidth);
      }

      this.blockIndices = [...Array(this.numBlocks).keys()];

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
        margin: (this.padding || 0) +'px ',
      };

      this.cacheBlocksSubscription = this.cacheService.loadedBlocks$.subscribe((block: BlockExtended) => {
        if (this.pendingBlocks[block.height]) {
          this.pendingBlocks[block.height].forEach(resolve => resolve(block));
          delete this.pendingBlocks[block.height];
        }
      });

      this.tipSubscription?.unsubscribe();
      this.tipSubscription = this.stateService.chainTip$
        .subscribe((height) => {
          this.height = height;
          this.handleNewBlock(height);
        });
    });

    this.setupBlockGraphs();

    this.networkChangedSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);
  }

  ngAfterViewInit(): void {
    this.setupBlockGraphs();
  }

  @HostListener('window:resize', ['$event'])
  resizeCanvas(): void {
    if (this.autoNumBlocks) {
      this.autoNumBlocks = true;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const paddedWidth = this.blockWidth + (this.padding * 2);
      this.numBlocks = Math.floor(width / paddedWidth) * Math.floor(height / paddedWidth);
      this.blockIndices = [...Array(this.numBlocks).keys()];

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
        margin: (this.padding || 0) +'px ',
      };

      if (this.cacheBlocksSubscription) {
        this.cacheBlocksSubscription.unsubscribe();
      }
      this.cacheBlocksSubscription = this.cacheService.loadedBlocks$.subscribe((block: BlockExtended) => {
        if (this.pendingBlocks[block.height]) {
          this.pendingBlocks[block.height].forEach(resolve => resolve(block));
          delete this.pendingBlocks[block.height];
        }
      });

      this.tipSubscription?.unsubscribe();
      this.tipSubscription = this.stateService.chainTip$
        .subscribe((height) => {
          this.height = height;
          this.handleNewBlock(height);
        });

      this.setupBlockGraphs();
    }
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

  async handleNewBlock(height: number): Promise<void> {
    const readyPromises: Promise<TransactionStripped[]>[] = [];
    const previousBlocks = this.latestBlocks;

    const blocks = await this.loadBlocks(height, this.numBlocks);

    const newHeights = {};
    this.latestBlocks = blocks;
    for (const block of blocks) {
      newHeights[block.height] = true;
      if (!this.strippedTransactions[block.height]) {
        readyPromises.push(this.loadBlockTransactions(block));
      }
    }
    await Promise.allSettled(readyPromises);
    this.isLoadingTransactions = false;
    this.updateBlockGraphs(blocks);

    // free up old transactions
    previousBlocks.forEach(block => {
      if (!newHeights[block.height]) {
        delete this.strippedTransactions[block.height];
      }
    });
  }

  async loadBlocks(height: number, numBlocks: number): Promise<BlockExtended[]> {
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
        this.blockGraph.replace(i, this.strippedTransactions[blocks?.[this.getBlockIndex(i)]?.height] || [], 'right', false, startTime + (this.stagger * i));
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
        this.blockGraph.setup(i, this.strippedTransactions[this.latestBlocks?.[this.getBlockIndex(i)]?.height] || []);
      }
    }
  }

  getBlockIndex(slotIndex: number): number {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const paddedWidth = this.blockWidth + (this.padding * 2);
    const blocksPerRow = Math.floor(width / paddedWidth);
    const blocksPerColumn = Math.floor(height / paddedWidth);
    const row = Math.floor(slotIndex / blocksPerRow);
    const column = slotIndex % blocksPerRow;
    return (blocksPerColumn - 1 - row) * blocksPerRow + column;
  }
}
