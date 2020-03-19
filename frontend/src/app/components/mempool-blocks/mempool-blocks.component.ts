import { Component, OnInit, OnDestroy, Input, EventEmitter, Output, OnChanges, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-mempool-blocks',
  templateUrl: './mempool-blocks.component.html',
  styleUrls: ['./mempool-blocks.component.scss']
})
export class MempoolBlocksComponent implements OnInit, OnChanges, OnDestroy {
  mempoolBlocks: MempoolBlock[];
  mempoolBlocksFull: MempoolBlock[];
  mempoolBlocksSubscription: Subscription;

  blockWidth = 125;
  blockPadding = 30;
  arrowVisible = false;

  rightPosition = 0;

  @Input() txFeePerVSize: number;
  @Input() markIndex: number;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.mempoolBlocksSubscription = this.stateService.mempoolBlocks$
      .subscribe((blocks) => {
        this.mempoolBlocksFull = JSON.parse(JSON.stringify(blocks));
        this.mempoolBlocks = this.reduceMempoolBlocksToFitScreen(blocks);
        this.calculateTransactionPosition();
      });
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    console.log('onResize');
    if (this.mempoolBlocks.length) {
      this.mempoolBlocks = this.reduceMempoolBlocksToFitScreen(JSON.parse(JSON.stringify(this.mempoolBlocksFull)));
    }
  }

  ngOnChanges() {
    this.calculateTransactionPosition();
  }

  ngOnDestroy() {
    this.mempoolBlocksSubscription.unsubscribe();
  }

  trackByFn(index: number) {
    return index;
  }

  reduceMempoolBlocksToFitScreen(blocks: MempoolBlock[]): MempoolBlock[] {
    const blocksAmount = Math.max(1, Math.floor(window.innerWidth / 2 / (this.blockWidth + this.blockPadding)));
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

  getStyleForMempoolBlockAtIndex(index: number) {
    const greenBackgroundHeight = 100 - this.mempoolBlocks[index].blockVSize / 1000000 * 100;
    return {
      'right': 40 + index * 155 + 'px',
      'background': `repeating-linear-gradient(to right,  #554b45, #554b45 ${greenBackgroundHeight}%,
        #bd7c13 ${Math.max(greenBackgroundHeight, 0)}%, #c5345a 100%)`,
    };
  }

  calculateTransactionPosition() {
    if ((!this.txFeePerVSize && (this.markIndex === undefined || this.markIndex === -1)) || !this.mempoolBlocks) {
      this.arrowVisible = false;
      return;
    } else if (this.markIndex > -1) {
      this.rightPosition = this.markIndex * (this.blockWidth + this.blockPadding) + 0.5 * this.blockWidth;
      this.arrowVisible = true;
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
