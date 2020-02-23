import { Component, OnInit, OnDestroy, Input, OnChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { Block } from 'src/app/interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-blockchain-blocks',
  templateUrl: './blockchain-blocks.component.html',
  styleUrls: ['./blockchain-blocks.component.scss']
})
export class BlockchainBlocksComponent implements OnInit, OnChanges, OnDestroy {
  @Input() markHeight = 0;
  @Input() txFeePerVSize: number;

  blocks: Block[] = [];
  blocksSubscription: Subscription;
  interval: any;
  trigger = 0;

  blockWidth = 125;
  blockPadding = 30;
  arrowLeftPx = 30;
  rightPosition = 0;
  arrowVisible = false;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.blocksSubscription = this.stateService.blocks$
      .subscribe((block) => {
        if (this.blocks.some((b) => b.height === block.height)) {
          return;
        }
        this.blocks.unshift(block);
        this.blocks = this.blocks.slice(0, 8);

        this.moveArrowToPosition();
      });

    this.interval = setInterval(() => this.trigger++, 10 * 1000);
  }

  ngOnChanges() {
    this.moveArrowToPosition();
  }

  ngOnDestroy() {
    this.blocksSubscription.unsubscribe();
    clearInterval(this.interval);
  }

  moveArrowToPosition() {
    if (!this.markHeight) {
      this.arrowVisible = false;
      return;
    }
    const block = this.blocks.find((b) => b.height === this.markHeight);
    if (!block) {
      return;
    }
    const blockindex = this.blocks.indexOf(block);

    this.arrowVisible = true;
    this.rightPosition = blockindex * -(this.blockWidth + this.blockPadding) - 30;

    if (!this.txFeePerVSize) {
      return;
    }

    for (let i = 0; i < block.feeRange.length - 1; i++) {
      if (this.txFeePerVSize < block.feeRange[i + 1] && this.txFeePerVSize >= block.feeRange[i]) {
        const feeRangeIndex = block.feeRange.findIndex((val, index) => this.txFeePerVSize < block.feeRange[index + 1]);
        const feeRangeChunkSize = 1 / (block.feeRange.length - 1);

        const txFee = this.txFeePerVSize - block.feeRange[i];
        const max = block.feeRange[i + 1] - block.feeRange[i];
        const blockLocation = txFee / max;

        const chunkPositionOffset = blockLocation * feeRangeChunkSize;
        const feePosition = feeRangeChunkSize * feeRangeIndex + chunkPositionOffset;

        const blockedFilledPercentage = (block.weight > 4000000 ? 4000000 : block.weight) / 4000000;
        const arrowRightPosition = blockindex * (-this.blockWidth + this.blockPadding)
          + ((1 - feePosition) * blockedFilledPercentage * this.blockWidth);

        this.rightPosition = arrowRightPosition - 93;
        break;
      }
    }
  }

  trackByBlocksFn(index: number, item: Block) {
    return item.height;
  }

  getStyleForBlock(block: Block) {
    const greenBackgroundHeight = 100 - (block.weight / 4000000) * 100;
    if (window.innerWidth <= 768) {
      return {
        top: 155 * this.blocks.indexOf(block) + 'px',
        background: `repeating-linear-gradient(to right, #2d3348, #2d3348 ${greenBackgroundHeight}%,
          #9339f4 ${Math.max(greenBackgroundHeight, 0)}%, #105fb0 100%)`,
      };
    } else {
      return {
        left: 155 * this.blocks.indexOf(block) + 'px',
        background: `repeating-linear-gradient(to right, #2d3348, #2d3348 ${greenBackgroundHeight}%,
          #9339f4 ${Math.max(greenBackgroundHeight, 0)}%, #105fb0 100%)`,
      };
    }
  }

}
