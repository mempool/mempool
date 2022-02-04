import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, Input } from '@angular/core';
import { Subscription, Observable, fromEvent, merge, of, combineLatest, timer } from 'rxjs';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { StateService } from 'src/app/services/state.service';
import { Router } from '@angular/router';
import { take, map, switchMap } from 'rxjs/operators';
import { feeLevels, mempoolFeeColors } from 'src/app/app.constants';
import { specialBlocks } from 'src/app/app.constants';
import { RelativeUrlPipe } from 'src/app/shared/pipes/relative-url/relative-url.pipe';

@Component({
  selector: 'app-mempool-blocks',
  templateUrl: './mempool-blocks.component.html',
  styleUrls: ['./mempool-blocks.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MempoolBlocksComponent implements OnInit, OnDestroy {
  specialBlocks = specialBlocks;
  mempoolBlocks: MempoolBlock[] = [];
  mempoolEmptyBlocks: MempoolBlock[] = this.mountEmptyBlocks();
  mempoolBlocks$: Observable<MempoolBlock[]>;
  timeAvg$: Observable<number>;
  loadingBlocks$: Observable<boolean>;
  blocksSubscription: Subscription;

  mempoolBlocksFull: MempoolBlock[] = [];
  mempoolBlockStyles = [];
  mempoolEmptyBlockStyles = [];
  markBlocksSubscription: Subscription;
  isLoadingWebsocketSubscription: Subscription;
  blockSubscription: Subscription;
  networkSubscription: Subscription;
  network = '';
  now = new Date().getTime();

  blockWidth = 125;
  blockPadding = 30;
  arrowVisible = false;
  tabHidden = false;
  feeRounding = '1.0-0';

  rightPosition = 0;
  transition = '2s';

  markIndex: number;
  txFeePerVSize: number;

  resetTransitionTimeout: number;

  blockIndex = 1;

  constructor(
    private router: Router,
    public stateService: StateService,
    private cd: ChangeDetectorRef,
    private relativeUrlPipe: RelativeUrlPipe,
  ) { }

  ngOnInit() {
    if (this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet') {
      this.feeRounding = '1.0-1';
    }
    this.mempoolEmptyBlocks.forEach((b) => {
      this.mempoolEmptyBlockStyles.push(this.getStyleForMempoolEmptyBlock(b.index));
    });
    this.reduceMempoolBlocksToFitScreen(this.mempoolEmptyBlocks);

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
            if (this.stateService.network === '') {
              block.blink = specialBlocks[block.height] ? true : false;
            }
          });

          const stringifiedBlocks = JSON.stringify(mempoolBlocks);
          this.mempoolBlocksFull = JSON.parse(stringifiedBlocks);
          this.mempoolBlocks = this.reduceMempoolBlocksToFitScreen(JSON.parse(stringifiedBlocks));

          this.updateMempoolBlockStyles();
          this.calculateTransactionPosition();
          return this.mempoolBlocks;
        })
      );

    this.timeAvg$ = timer(0, 1000)
      .pipe(
        switchMap(() => combineLatest([
          this.stateService.blocks$.pipe(map(([block]) => block)),
          this.stateService.lastDifficultyAdjustment$
        ])),
        map(([block, DATime]) => {
          this.now = new Date().getTime();
          const now = new Date().getTime() / 1000;
          const diff = now - DATime;
          const blocksInEpoch = block.height % 2016;
          let difficultyChange = 0;
          if (blocksInEpoch > 0) {
            difficultyChange = (600 / (diff / blocksInEpoch ) - 1) * 100;
          }
          const timeAvgDiff = difficultyChange * 0.1;

          let timeAvgMins = 10;
          if (timeAvgDiff > 0 ){
            timeAvgMins -= Math.abs(timeAvgDiff);
          } else {
            timeAvgMins += Math.abs(timeAvgDiff);
          }

          return timeAvgMins * 60 * 1000;
        })
      );

    this.markBlocksSubscription = this.stateService.markBlock$
      .subscribe((state) => {
        this.markIndex = undefined;
        this.txFeePerVSize = undefined;
        if (state.mempoolBlockIndex !== undefined) {
          this.markIndex = state.mempoolBlockIndex;
        }
        if (state.txFeePerVSize) {
          this.txFeePerVSize = state.txFeePerVSize;
        }
        this.calculateTransactionPosition();
        this.cd.markForCheck();
      });

    this.blockSubscription = this.stateService.blocks$
      .subscribe(([block]) => {
        if (block?.extra?.matchRate >= 66 && !this.tabHidden) {
          this.blockIndex++;
        }
      });

    this.networkSubscription = this.stateService.networkChanged$
      .subscribe((network) => this.network = network);

    this.stateService.keyNavigation$.subscribe((event) => {
      if (this.markIndex === undefined) {
        return;
      }

      if (event.key === 'ArrowRight') {
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
      } else if (event.key === 'ArrowLeft') {
        if (this.mempoolBlocks[this.markIndex + 1]) {
          this.router.navigate([this.relativeUrlPipe.transform('/mempool-block/'), this.markIndex + 1]);
        }
      }
    });
  }

  ngOnDestroy() {
    this.markBlocksSubscription.unsubscribe();
    this.blockSubscription.unsubscribe();
    this.networkSubscription.unsubscribe();
    clearTimeout(this.resetTransitionTimeout);
  }

  trackByFn(index: number, block: MempoolBlock) {
    return block.index;
  }

  reduceMempoolBlocksToFitScreen(blocks: MempoolBlock[]): MempoolBlock[] {
    const innerWidth = this.stateService.env.BASE_MODULE !== 'liquid' && window.innerWidth <= 767.98 ? window.innerWidth : window.innerWidth / 2;
    const blocksAmount = Math.min(this.stateService.env.MEMPOOL_BLOCKS_AMOUNT, Math.floor(innerWidth / (this.blockWidth + this.blockPadding)));
    while (blocks.length > blocksAmount) {
      const block = blocks.pop();
      const lastBlock = blocks[blocks.length - 1];
      lastBlock.blockSize += block.blockSize;
      lastBlock.blockVSize += block.blockVSize;
      lastBlock.nTx += block.nTx;
      lastBlock.feeRange = lastBlock.feeRange.concat(block.feeRange);
      lastBlock.feeRange.sort((a, b) => a - b);
      lastBlock.medianFee = this.median(lastBlock.feeRange);
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
      'right': 40 + index * 155 + 'px',
      'background': backgroundGradients.join(',') + ')'
    };
  }

  getStyleForMempoolEmptyBlock(index: number) {
    return {
      'right': 40 + index * 155 + 'px',
      'background': '#554b45',
    };
  }

  calculateTransactionPosition() {
    if ((!this.txFeePerVSize && (this.markIndex === undefined || this.markIndex === -1)) || !this.mempoolBlocks) {
      this.arrowVisible = false;
      return;
    } else if (this.markIndex > -1) {
      clearTimeout(this.resetTransitionTimeout);
      this.transition = 'inherit';
      this.rightPosition = this.markIndex * (this.blockWidth + this.blockPadding) + 0.5 * this.blockWidth;
      this.arrowVisible = true;

      this.resetTransitionTimeout = window.setTimeout(() => {
        this.transition = '2s';
        this.cd.markForCheck();
      }, 100);
      return;
    }

    this.arrowVisible = true;

    for (const block of this.mempoolBlocks) {
      for (let i = 0; i < block.feeRange.length - 1; i++) {
        if (this.txFeePerVSize < block.feeRange[i + 1] && this.txFeePerVSize >= block.feeRange[i]) {
          const txInBlockIndex = this.mempoolBlocks.indexOf(block);
          const feeRangeIndex = block.feeRange.findIndex((val, index) => this.txFeePerVSize < block.feeRange[index + 1]);
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
          break;
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
