import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { specialBlocks } from '../../app.constants';
import { BlockExtended } from '../../interfaces/node-api.interface';
import { Location } from '@angular/common';
import { config } from 'process';
import { CacheService } from 'src/app/services/cache.service';

interface BlockchainBlock extends BlockExtended {
  loading?: boolean;
}

@Component({
  selector: 'app-blockchain-blocks',
  templateUrl: './blockchain-blocks.component.html',
  styleUrls: ['./blockchain-blocks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockchainBlocksComponent implements OnInit, OnChanges, OnDestroy {
  @Input() static: boolean = false;
  @Input() offset: number = 0;
  @Input() height: number = 0;
  @Input() count: number = 8;
  
  specialBlocks = specialBlocks;
  network = '';
  blocks: BlockchainBlock[] = [];
  emptyBlocks: BlockExtended[] = this.mountEmptyBlocks();
  markHeight: number;
  blocksSubscription: Subscription;
  blockPageSubscription: Subscription;
  networkSubscription: Subscription;
  tabHiddenSubscription: Subscription;
  markBlockSubscription: Subscription;
  loadingBlocks$: Observable<boolean>;
  blockStyles = [];
  emptyBlockStyles = [];
  interval: any;
  tabHidden = false;
  feeRounding = '1.0-0';
  arrowVisible = false;
  arrowLeftPx = 30;
  blocksFilled = false;
  transition = '1s';
  showMiningInfo = false;
  timeLtrSubscription: Subscription;
  timeLtr: boolean;

  gradientColors = {
    '': ['#9339f4', '#105fb0'],
    bisq: ['#9339f4', '#105fb0'],
    liquid: ['#116761', '#183550'],
    'liquidtestnet': ['#494a4a', '#272e46'],
    testnet: ['#1d486f', '#183550'],
    signet: ['#6f1d5d', '#471850'],
  };

  constructor(
    public stateService: StateService,
    public cacheService: CacheService,
    private cd: ChangeDetectorRef,
    private location: Location,
  ) {
  }

  enabledMiningInfoIfNeeded(url) {
    this.showMiningInfo = url.indexOf('/mining') !== -1;
    this.cd.markForCheck(); // Need to update the view asap
  }

  ngOnInit() {
    if (['', 'testnet', 'signet'].includes(this.stateService.network)) {
      this.enabledMiningInfoIfNeeded(this.location.path());
      this.location.onUrlChange((url) => this.enabledMiningInfoIfNeeded(url));
    }

    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
      this.cd.markForCheck();
    });

    if (this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet') {
      this.feeRounding = '1.0-1';
    }
    this.emptyBlocks.forEach((b) => this.emptyBlockStyles.push(this.getStyleForEmptyBlock(b)));
    this.loadingBlocks$ = this.stateService.isLoadingWebSocket$;
    this.networkSubscription = this.stateService.networkChanged$.subscribe((network) => this.network = network);
    this.tabHiddenSubscription = this.stateService.isTabHidden$.subscribe((tabHidden) => this.tabHidden = tabHidden);
    if (!this.static) {
      this.blocksSubscription = this.stateService.blocks$
        .subscribe(([block, txConfirmed]) => {
          if (this.blocks.some((b) => b.height === block.height)) {
            return;
          }

          if (this.blocks.length && block.height !== this.blocks[0].height + 1) {
            this.blocks = [];
            this.blocksFilled = false;
          }

          this.blocks.unshift(block);
          this.blocks = this.blocks.slice(0, this.stateService.env.KEEP_BLOCKS_AMOUNT);

          if (this.blocksFilled && !this.tabHidden && block.extras) {
            block.extras.stage = block.extras.matchRate >= 66 ? 1 : 2;
          }

          if (txConfirmed) {
            this.markHeight = block.height;
            this.moveArrowToPosition(true, true);
          } else {
            this.moveArrowToPosition(true, false);
          }

          this.blockStyles = [];
          this.blocks.forEach((b, i) => this.blockStyles.push(this.getStyleForBlock(b, i)));
          setTimeout(() => {
            this.blockStyles = [];
            this.blocks.forEach((b, i) => this.blockStyles.push(this.getStyleForBlock(b, i)));
            this.cd.markForCheck();
          }, 50);

          if (this.blocks.length === this.stateService.env.KEEP_BLOCKS_AMOUNT) {
            this.blocksFilled = true;
          }
          this.cd.markForCheck();
        });
    } else {
      this.blockPageSubscription = this.cacheService.loadedBlocks$.subscribe((block) => {
        if (block.height <= this.height && block.height > this.height - this.count) {
          this.onBlockLoaded(block);
        }
      });
    }

    this.markBlockSubscription = this.stateService.markBlock$
      .subscribe((state) => {
        this.markHeight = undefined;
        if (state.blockHeight !== undefined) {
          this.markHeight = state.blockHeight;
        }
        this.moveArrowToPosition(false);
        this.cd.markForCheck();
      });

      if (this.static) {
        this.updateStaticBlocks();
      }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.static) {
      const animateSlide = changes.height && (changes.height.currentValue === changes.height.previousValue + 1);
      this.updateStaticBlocks(animateSlide);
    }
  }

  ngOnDestroy() {
    if (this.blocksSubscription) {
      this.blocksSubscription.unsubscribe();
    }
    if (this.blockPageSubscription) {
      this.blockPageSubscription.unsubscribe();
    }
    this.networkSubscription.unsubscribe();
    this.tabHiddenSubscription.unsubscribe();
    this.markBlockSubscription.unsubscribe();
    this.timeLtrSubscription.unsubscribe();
    clearInterval(this.interval);
  }

  moveArrowToPosition(animate: boolean, newBlockFromLeft = false) {
    if (this.markHeight === undefined) {
      this.arrowVisible = false;
      return;
    }
    const blockindex = this.blocks.findIndex((b) => b.height === this.markHeight);
    if (blockindex > -1) {
      if (!animate) {
        this.transition = 'inherit';
      }
      this.arrowVisible = true;
      if (newBlockFromLeft) {
        this.arrowLeftPx = blockindex * 155 + 30 - 205;
        setTimeout(() => {
          this.transition = '2s';
          this.arrowLeftPx = blockindex * 155 + 30;
          this.cd.markForCheck();
        }, 50);
      } else {
        this.arrowLeftPx = blockindex * 155 + 30;
        if (!animate) {
          setTimeout(() => {
            this.transition = '2s';
            this.cd.markForCheck();
          });
        }
      }
    } else {
      this.arrowVisible = false;
    }
  }

  trackByBlocksFn(index: number, item: BlockchainBlock) {
    return item.height;
  }

  updateStaticBlocks(animateSlide: boolean = false) {
    // reset blocks
    this.blocks = [];
    this.blockStyles = [];
    while (this.blocks.length < Math.min(this.height + 1, this.count)) {
      const height = this.height - this.blocks.length;
      if (height >= 0) {
        this.cacheService.loadBlock(height);
        const block = this.cacheService.getCachedBlock(height) || null;
        this.blocks.push(block || {
          loading: true,
          id: '',
          height,
          version: 0,
          timestamp: 0,
          bits: 0,
          nonce: 0,
          difficulty: 0,
          merkle_root: '',
          tx_count: 0,
          size: 0,
          weight: 0,
          previousblockhash: '',
        });
      }
    }
    this.blocks = this.blocks.slice(0, this.count);
    this.blockStyles = [];
    this.blocks.forEach((b, i) => this.blockStyles.push(this.getStyleForBlock(b, i, animateSlide)));
    if (animateSlide) {
      // animate blocks slide right
      setTimeout(() => {
        this.blockStyles = [];
        this.blocks.forEach((b, i) => this.blockStyles.push(this.getStyleForBlock(b, i)));
        this.cd.markForCheck();
      }, 50);
    }
  }

  onBlockLoaded(block: BlockExtended) {
    const blockIndex = this.height - block.height;
    if (blockIndex >= 0 && blockIndex < this.blocks.length) {
      this.blocks[blockIndex] = block;
      this.blockStyles[blockIndex] = this.getStyleForBlock(block, blockIndex);
    }
    this.cd.markForCheck();
  }

  getStyleForBlock(block: BlockchainBlock, index: number, animateSlideStart: boolean = false) {
    if (!block || block.loading) {
      return this.getStyleForLoadingBlock(index, animateSlideStart);
    }
    const greenBackgroundHeight = 100 - (block.weight / this.stateService.env.BLOCK_WEIGHT_UNITS) * 100;
    let addLeft = 0;

    if (animateSlideStart) {
      if (block?.extras) {
        block.extras.stage = 2;
      }
      addLeft = -205;
    }

    return {
      left: addLeft + 155 * index + 'px',
      background: `repeating-linear-gradient(
        #2d3348,
        #2d3348 ${greenBackgroundHeight}%,
        ${this.gradientColors[this.network][0]} ${Math.max(greenBackgroundHeight, 0)}%,
        ${this.gradientColors[this.network][1]} 100%
      )`,
    };
  }

  getStyleForLoadingBlock(index: number, animateSlideStart: boolean = false) {
    const addLeft = animateSlideStart ? -205 : 0;

    return {
      left: addLeft + (155 * index) + 'px',
      background: "#2d3348",
    };
  }

  getStyleForEmptyBlock(block: BlockExtended) {
    let addLeft = 0;

    if (block?.extras?.stage === 1) {
      block.extras.stage = 2;
      addLeft = -205;
    }

    return {
      left: addLeft + 155 * this.emptyBlocks.indexOf(block) + 'px',
      background: "#2d3348",
    };
  }

  mountEmptyBlocks() {
    const emptyBlocks = [];
    for (let i = 0; i < this.stateService.env.KEEP_BLOCKS_AMOUNT; i++) {
      emptyBlocks.push({
        id: '',
        height: 0,
        version: 0,
        timestamp: 0,
        bits: 0,
        nonce: 0,
        difficulty: 0,
        merkle_root: '',
        tx_count: 0,
        size: 0,
        weight: 0,
        previousblockhash: '',
        matchRate: 0,
        stage: 0,
      });
    }
    return emptyBlocks;
  }
}
