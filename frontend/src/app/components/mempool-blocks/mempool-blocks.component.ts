import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription, pipe } from 'rxjs';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { StateService } from 'src/app/services/state.service';
import { Router } from '@angular/router';
import { take, map } from 'rxjs/operators';
import { feeLevels, mempoolFeeColors } from 'src/app/app.constants';

@Component({
  selector: 'app-mempool-blocks',
  templateUrl: './mempool-blocks.component.html',
  styleUrls: ['./mempool-blocks.component.scss'],
})
export class MempoolBlocksComponent implements OnInit, OnDestroy {
  mempoolBlocks: MempoolBlock[];
  mempoolBlocksFull: MempoolBlock[];
  mempoolBlockStyles = [];
  mempoolBlocksSubscription: Subscription;
  network = '';

  blockWidth = 125;
  blockPadding = 30;
  arrowVisible = false;
  tabHidden = true;

  rightPosition = 0;
  transition = '2s';

  markIndex: number;
  txFeePerVSize: number;

  resetTransitionTimeout: number;

  blockIndex = 1;

  constructor(
    private router: Router,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.stateService.isTabHidden$.subscribe((tabHidden) => this.tabHidden = tabHidden);

    this.mempoolBlocksSubscription = this.stateService.mempoolBlocks$
      .pipe(
        map((blocks) => {
          if (!blocks.length) {
            return [{ index: 0, blockSize: 0, blockVSize: 0, feeRange: [0, 0], medianFee: 0, nTx: 0, totalFees: 0 }];
          }
          return blocks;
        }),
      )
      .subscribe((blocks) => {
        blocks.forEach((block, i) => {
          block.index = this.blockIndex + i;
        });
        const stringifiedBlocks = JSON.stringify(blocks);
        this.mempoolBlocksFull = JSON.parse(stringifiedBlocks);
        this.mempoolBlocks = this.reduceMempoolBlocksToFitScreen(JSON.parse(stringifiedBlocks));
        this.updateMempoolBlockStyles();
        this.calculateTransactionPosition();
      });

    this.stateService.markBlock$
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
      });

    this.stateService.blocks$
      .subscribe(([block]) => {
        if (block.matchRate >= 66 && !this.tabHidden) {
          this.blockIndex++;
        }
      });

    this.stateService.networkChanged$
      .subscribe((network) => this.network = network);

    this.stateService.keyNavigation$.subscribe((event) => {
      if (this.markIndex === undefined) {
        return;
      }

      if (event.key === 'ArrowRight') {
        if (this.mempoolBlocks[this.markIndex - 1]) {
          this.router.navigate([(this.network ? '/' + this.network : '') + '/mempool-block/', this.markIndex - 1]);
        } else {
          this.stateService.blocks$
            .pipe(take(8))
            .subscribe(([block]) => {
              if (this.stateService.latestBlockHeight === block.height) {
                this.router.navigate([(this.network ? '/' + this.network : '') + '/block/', block.id], { state: { data: { block } }});
              }
            });
        }
      } else if (event.key === 'ArrowLeft') {
        if (this.mempoolBlocks[this.markIndex + 1]) {
          this.router.navigate([(this.network ? '/' + this.network : '') + '/mempool-block/', this.markIndex + 1]);
        }
      }
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    if (this.mempoolBlocks && this.mempoolBlocks.length) {
      this.mempoolBlocks = this.reduceMempoolBlocksToFitScreen(JSON.parse(JSON.stringify(this.mempoolBlocksFull)));
    }
  }

  ngOnDestroy() {
    this.mempoolBlocksSubscription.unsubscribe();
  }

  trackByFn(index: number, block: MempoolBlock) {
    return block.index;
  }

  reduceMempoolBlocksToFitScreen(blocks: MempoolBlock[]): MempoolBlock[] {
    const blocksAmount = Math.max(2, Math.floor(window.innerWidth / 2 / (this.blockWidth + this.blockPadding)));
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
    const emptyBackgroundSpacePercentage = Math.max(100 - mempoolBlock.blockVSize / 1000000 * 100, 0);
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

  calculateTransactionPosition() {
    if ((!this.txFeePerVSize && (this.markIndex === undefined || this.markIndex === -1)) || !this.mempoolBlocks) {
      this.arrowVisible = false;
      return;
    } else if (this.markIndex > -1) {
      clearTimeout(this.resetTransitionTimeout);
      this.transition = 'inherit';
      this.rightPosition = this.markIndex * (this.blockWidth + this.blockPadding) + 0.5 * this.blockWidth;
      this.arrowVisible = true;
      this.resetTransitionTimeout = window.setTimeout(() => this.transition = '2s', 100);
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

          const blockedFilledPercentage = (block.blockVSize > 1000000 ? 1000000 : block.blockVSize) / 1000000;
          const arrowRightPosition = txInBlockIndex * (this.blockWidth + this.blockPadding)
            + ((1 - feePosition) * blockedFilledPercentage * this.blockWidth);

          this.rightPosition = arrowRightPosition;
          break;
        }
      }
    }
  }

}
