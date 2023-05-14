import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription, Observable, fromEvent, merge, of, combineLatest } from 'rxjs';
import { MempoolBlock } from '../../interfaces/websocket.interface';
import { StateService } from '../../services/state.service';
import { Router } from '@angular/router';
import { take, map, switchMap } from 'rxjs/operators';
import { feeLevels, mempoolFeeColors } from '../../app.constants';
import { specialBlocks } from '../../app.constants';
import { RelativeUrlPipe } from '../../shared/pipes/relative-url/relative-url.pipe';
import { Location } from '@angular/common';
import { DifficultyAdjustment, MempoolPosition } from '../../interfaces/node-api.interface';
import { animate, style, transition, trigger } from '@angular/animations';

@Component({
  selector: 'app-mempool-blocks',
  templateUrl: './mempool-blocks.component.html',
  styleUrls: ['./mempool-blocks.component.scss'],
  animations: [trigger('blockEntryTrigger', [
    transition(':enter', [
      style({ transform: 'translateX(-155px)' }),
      animate('2s 0s ease', style({ transform: '' })),
    ]),
  ])],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlocksComponent implements OnInit, OnChanges, OnDestroy {
  @Input() minimal: boolean = false;
  @Input() blockWidth: number = 125;
  @Input() count: number = null;
  @Input() spotlight: number = 0;

  specialBlocks = specialBlocks;
  mempoolBlocks: MempoolBlock[] = [];
  mempoolEmptyBlocks: MempoolBlock[] = this.mountEmptyBlocks();
  mempoolBlocks$: Observable<MempoolBlock[]>;
  difficultyAdjustments$: Observable<DifficultyAdjustment>;
  loadingBlocks$: Observable<boolean>;
  blocksSubscription: Subscription;

  mempoolBlocksFull: MempoolBlock[] = [];
  mempoolBlockStyles = [];
  mempoolEmptyBlockStyles = [];
  markBlocksSubscription: Subscription;
  isLoadingWebsocketSubscription: Subscription;
  blockSubscription: Subscription;
  networkSubscription: Subscription;
  chainTipSubscription: Subscription;
  network = '';
  now = new Date().getTime();
  timeOffset = 0;
  showMiningInfo = false;
  timeLtrSubscription: Subscription;
  timeLtr: boolean;
  animateEntry: boolean = false;

  blockOffset: number = 155;
  blockPadding: number = 30;
  containerOffset: number = 40;
  arrowVisible = false;
  tabHidden = false;
  feeRounding = '1.0-0';

  rightPosition = 0;
  transition = 'background 2s, right 2s, transform 1s';

  markIndex: number;
  txPosition: MempoolPosition;
  txFeePerVSize: number;

  resetTransitionTimeout: number;

  chainTip: number = -1;
  blockIndex = 1;

  constructor(
    private router: Router,
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    private relativeUrlPipe: RelativeUrlPipe,
    private location: Location
  ) { }

  enabledMiningInfoIfNeeded(url) {
    this.showMiningInfo = url.indexOf('/mining') !== -1;
    this.cd.markForCheck(); // Need to update the view asap
  }

  ngOnInit() {
    this.chainTip = this.stateService.latestBlockHeight;

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
    this.mempoolEmptyBlocks.forEach((b) => {
      this.mempoolEmptyBlockStyles.push(this.getStyleForMempoolEmptyBlock(b.index));
    });
    this.reduceEmptyBlocksToFitScreen(this.mempoolEmptyBlocks);

    this.mempoolBlocks.map(() => {
      this.updateMempoolBlockStyles();
      this.calculateTransactionPosition();
    });
    this.reduceMempoolBlocksToFitScreen(this.mempoolBlocks);
    this.stateService.isTabHidden$.subscribe((tabHidden) => this.tabHidden = tabHidden);
    this.loadingBlocks$ = this.stateService.isLoadingWebSocket$;

    this.mempoolBlocks$ = merge(
      of(true),
      fromEvent(window, 'resize')
    )
    .pipe(
      switchMap(() => combineLatest([
        this.stateService.blocks$.pipe(map(([block]) => block)),
        this.stateService.mempoolBlocks$
          .pipe(
            map((mempoolBlocks) => {
              if (!mempoolBlocks.length) {
                return [{ index: 0, blockSize: 0, blockVSize: 0, feeRange: [0, 0], medianFee: 0, nTx: 0, totalFees: 0 }];
              }
              return mempoolBlocks;
            }),
          )
      ])),
        map(([lastBlock, mempoolBlocks]) => {
          mempoolBlocks.forEach((block, i) => {
            block.index = this.blockIndex + i;
            block.height = lastBlock.height + i + 1;
            block.blink = specialBlocks[block.height]?.networks.includes(this.stateService.network || 'mainnet') ? true : false;
          });

          const stringifiedBlocks = JSON.stringify(mempoolBlocks);
          this.mempoolBlocksFull = JSON.parse(stringifiedBlocks);
          this.mempoolBlocks = this.reduceMempoolBlocksToFitScreen(JSON.parse(stringifiedBlocks));

          this.updateMempoolBlockStyles();
          this.calculateTransactionPosition();
          return this.mempoolBlocks;
        })
      );

    this.difficultyAdjustments$ = this.stateService.difficultyAdjustment$
      .pipe(
        map((da) => {
          this.now = new Date().getTime();
          return da;
        })
      );

    this.markBlocksSubscription = this.stateService.markBlock$
      .subscribe((state) => {
        this.markIndex = undefined;
        this.txPosition = undefined;
        this.txFeePerVSize = undefined;
        if (state.mempoolBlockIndex !== undefined) {
          this.markIndex = state.mempoolBlockIndex;
        }
        if (state.mempoolPosition) {
          this.txPosition = state.mempoolPosition;
        }
        if (state.txFeePerVSize) {
          this.txFeePerVSize = state.txFeePerVSize;
        }
        this.calculateTransactionPosition();
        this.cd.markForCheck();
      });

    this.blockSubscription = this.stateService.blocks$
      .subscribe(([block]) => {
        if (this.chainTip === -1) {
          this.animateEntry = block.height === this.stateService.latestBlockHeight;
        } else {
          this.animateEntry = block.height > this.chainTip;
        }

        this.chainTip = this.stateService.latestBlockHeight;
        if ((block?.extras?.similarity == null || block?.extras?.similarity > 0.5) && !this.tabHidden) {
          this.blockIndex++;
        }
      });

    this.chainTipSubscription = this.stateService.chainTip$.subscribe((height) => {
      if (this.chainTip === -1) {
        this.chainTip = height;
      }
    });

    this.networkSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);

    this.stateService.keyNavigation$.subscribe((event) => {
      if (this.markIndex === undefined) {
        return;
      }
      const prevKey = this.timeLtr ? 'ArrowLeft' : 'ArrowRight';
      const nextKey = this.timeLtr ? 'ArrowRight' : 'ArrowLeft';

      if (event.key === prevKey) {
        if (this.mempoolBlocks[this.markIndex - 1]) {
          this.router.navigate([this.relativeUrlPipe.transform('mempool-block/'), this.markIndex - 1]);
        } else {
          this.stateService.blocks$
            .pipe(take(this.stateService.env.MEMPOOL_BLOCKS_AMOUNT))
            .subscribe(([block]) => {
              if (this.stateService.latestBlockHeight === block.height) {
                this.router.navigate([this.relativeUrlPipe.transform('/block/'), block.id], { state: { data: { block } }});
              }
            });
        }
      } else if (event.key === nextKey) {
        if (this.mempoolBlocks[this.markIndex + 1]) {
          this.router.navigate([this.relativeUrlPipe.transform('/mempool-block/'), this.markIndex + 1]);
        }
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.blockWidth && this.blockWidth) {
      this.blockPadding = 0.24 * this.blockWidth;
      this.containerOffset = 0.32 * this.blockWidth;
      this.blockOffset = this.blockWidth + this.blockPadding;
    }
  }

  ngOnDestroy() {
    this.markBlocksSubscription.unsubscribe();
    this.blockSubscription.unsubscribe();
    this.networkSubscription.unsubscribe();
    this.timeLtrSubscription.unsubscribe();
    this.chainTipSubscription.unsubscribe();
    clearTimeout(this.resetTransitionTimeout);
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.animateEntry = false;
    this.reduceEmptyBlocksToFitScreen(this.mempoolEmptyBlocks);
  }

  trackByFn(index: number, block: MempoolBlock) {
    return (block.isStack) ? `stack-${block.index}` : block.index;
  }

  reduceEmptyBlocksToFitScreen(blocks: MempoolBlock[]): MempoolBlock[] {
    const innerWidth = this.stateService.env.BASE_MODULE !== 'liquid' && window.innerWidth <= 767.98 ? window.innerWidth : window.innerWidth / 2;
    const blocksAmount = Math.min(this.stateService.env.MEMPOOL_BLOCKS_AMOUNT, Math.floor(innerWidth / (this.blockWidth + this.blockPadding)));
    while (blocks.length < blocksAmount) {
      blocks.push({
        blockSize: 0,
        blockVSize: 0,
        feeRange: [],
        index: blocks.length,
        medianFee: 0,
        nTx: 0,
        totalFees: 0
      });
    }
    while (blocks.length > blocksAmount) {
      blocks.pop();
    }
    return blocks;
  }

  reduceMempoolBlocksToFitScreen(blocks: MempoolBlock[]): MempoolBlock[] {
    const innerWidth = this.stateService.env.BASE_MODULE !== 'liquid' && window.innerWidth <= 767.98 ? window.innerWidth : window.innerWidth / 2;
    let blocksAmount;
    if (this.count) {
      blocksAmount = 8;
    } else {
      blocksAmount = Math.min(this.stateService.env.MEMPOOL_BLOCKS_AMOUNT, Math.floor(innerWidth / (this.blockWidth + this.blockPadding)));
    }
    while (blocks.length > blocksAmount) {
      const block = blocks.pop();
      if (!this.count) {
        const lastBlock = blocks[blocks.length - 1];
        lastBlock.blockSize += block.blockSize;
        lastBlock.blockVSize += block.blockVSize;
        lastBlock.nTx += block.nTx;
        lastBlock.feeRange = lastBlock.feeRange.concat(block.feeRange);
        lastBlock.feeRange.sort((a, b) => a - b);
        lastBlock.medianFee = this.median(lastBlock.feeRange);
        lastBlock.totalFees += block.totalFees;
      }
    }
    if (blocks.length) {
      blocks[blocks.length - 1].isStack = blocks[blocks.length - 1].blockVSize > this.stateService.blockVSize;
    }
    return blocks;
  }

  median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    if (numsLen % 2 === 0) {
        medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else {
        medianNr = numbers[(numsLen - 1) / 2];
    }
    return medianNr;
  }

  updateMempoolBlockStyles() {
    this.mempoolBlockStyles = [];
    this.mempoolBlocksFull.forEach((block, i) => this.mempoolBlockStyles.push(this.getStyleForMempoolBlock(block, i)));
  }

  getStyleForMempoolBlock(mempoolBlock: MempoolBlock, index: number) {
    const emptyBackgroundSpacePercentage = Math.max(100 - mempoolBlock.blockVSize / this.stateService.blockVSize * 100, 0);
    const usedBlockSpace = 100 - emptyBackgroundSpacePercentage;
    const backgroundGradients = [`repeating-linear-gradient(to right,  #554b45, #554b45 ${emptyBackgroundSpacePercentage}%`];
    const gradientColors = [];

    const trimmedFeeRange = index === 0 ? mempoolBlock.feeRange.slice(0, -1) : mempoolBlock.feeRange;

    trimmedFeeRange.forEach((fee: number) => {
      let feeLevelIndex = feeLevels.slice().reverse().findIndex((feeLvl) => fee >= feeLvl);
      feeLevelIndex = feeLevelIndex >= 0 ? feeLevels.length - feeLevelIndex : feeLevelIndex;
      gradientColors.push(mempoolFeeColors[feeLevelIndex - 1] || mempoolFeeColors[mempoolFeeColors.length - 1]);
    });

    gradientColors.forEach((color, i, gc) => {
      backgroundGradients.push(`
        #${i === 0 ? color : gc[i - 1]} ${ i === 0 ? emptyBackgroundSpacePercentage : ((i / gradientColors.length) * 100) * usedBlockSpace / 100 + emptyBackgroundSpacePercentage }%,
        #${color} ${Math.round(((i + 1) / gradientColors.length) * 100) * usedBlockSpace / 100 + emptyBackgroundSpacePercentage}%
      `);
    });

    return {
      'right': this.containerOffset + index * this.blockOffset + 'px',
      'background': backgroundGradients.join(',') + ')'
    };
  }

  getStyleForMempoolEmptyBlock(index: number) {
    return {
      'right': this.containerOffset + index * this.blockOffset + 'px',
      'background': '#554b45',
    };
  }

  calculateTransactionPosition() {
    if ((!this.txPosition && !this.txFeePerVSize && (this.markIndex === undefined || this.markIndex === -1)) || !this.mempoolBlocks) {
      this.arrowVisible = false;
      return;
    } else if (this.markIndex > -1) {
      clearTimeout(this.resetTransitionTimeout);
      this.transition = 'inherit';
      this.rightPosition = this.markIndex * (this.blockWidth + this.blockPadding) + 0.5 * this.blockWidth;
      this.arrowVisible = true;

      this.resetTransitionTimeout = window.setTimeout(() => {
        this.transition = 'background 2s, right 2s, transform 1s';
        this.cd.markForCheck();
      }, 100);
      return;
    }

    this.arrowVisible = true;

    if (this.txPosition) {
      if (this.txPosition.block >= this.mempoolBlocks.length) {
        this.rightPosition = ((this.mempoolBlocks.length - 1) * (this.blockWidth + this.blockPadding)) + this.blockWidth;
      } else {
        const positionInBlock = Math.min(1, this.txPosition.vsize / this.stateService.blockVSize) * this.blockWidth;
        const positionOfBlock = this.txPosition.block * (this.blockWidth + this.blockPadding);
        this.rightPosition = positionOfBlock + positionInBlock;
      }
    } else {
      let found = false;
      for (let txInBlockIndex = 0; txInBlockIndex < this.mempoolBlocks.length && !found; txInBlockIndex++) {
        const block = this.mempoolBlocks[txInBlockIndex];
        for (let i = 0; i < block.feeRange.length - 1 && !found; i++) {
          if (this.txFeePerVSize < block.feeRange[i + 1] && this.txFeePerVSize >= block.feeRange[i]) {
            const feeRangeIndex = i;
            const feeRangeChunkSize = 1 / (block.feeRange.length - 1);

            const txFee = this.txFeePerVSize - block.feeRange[i];
            const max = block.feeRange[i + 1] - block.feeRange[i];
            const blockLocation = txFee / max;

            const chunkPositionOffset = blockLocation * feeRangeChunkSize;
            const feePosition = feeRangeChunkSize * feeRangeIndex + chunkPositionOffset;

            const blockedFilledPercentage = (block.blockVSize > this.stateService.blockVSize ? this.stateService.blockVSize : block.blockVSize) / this.stateService.blockVSize;
            const arrowRightPosition = txInBlockIndex * (this.blockWidth + this.blockPadding)
              + ((1 - feePosition) * blockedFilledPercentage * this.blockWidth);

            this.rightPosition = arrowRightPosition;
            found = true;
          }
        }
        if (this.txFeePerVSize >= block.feeRange[block.feeRange.length - 1]) {
          this.rightPosition = txInBlockIndex * (this.blockWidth + this.blockPadding);
          found = true;
        }
      }
    }
  }

  mountEmptyBlocks() {
    const emptyBlocks = [];
    const numberOfBlocks = this.stateService.env.MEMPOOL_BLOCKS_AMOUNT;
    for (let i = 0; i < numberOfBlocks; i++) {
      emptyBlocks.push({
        blockSize: 0,
        blockVSize: 0,
        feeRange: [],
        index: i,
        medianFee: 0,
        nTx: 0,
        totalFees: 0
      });
    }
    return emptyBlocks;
  }
}