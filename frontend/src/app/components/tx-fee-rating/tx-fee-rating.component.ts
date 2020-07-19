import { Component, ChangeDetectionStrategy, OnChanges, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { Transaction, Block } from 'src/app/interfaces/electrs.interface';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-tx-fee-rating',
  templateUrl: './tx-fee-rating.component.html',
  styleUrls: ['./tx-fee-rating.component.scss'],
})
export class TxFeeRatingComponent implements OnInit, OnChanges {
  @Input() tx: Transaction;

  medianFeeNeeded: number;
  overpaidTimes: number;
  feeRating: number;

  blocks: Block[] = [];

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.stateService.blocks$.subscribe(([block]) => {
      this.blocks.push(block);
      if (this.tx.status.confirmed && this.tx.status.block_height === block.height) {
        this.calculateRatings(block);
      }
    });
  }

  ngOnChanges() {
    this.feeRating = undefined;
    if (!this.tx.status.confirmed) {
      return;
    }

    const foundBlock = this.blocks.find((b) => b.height === this.tx.status.block_height);
    if (foundBlock) {
      this.calculateRatings(foundBlock);
    }
  }

  calculateRatings(block: Block) {
    const feePervByte = this.tx.fee / (this.tx.weight / 4);
    this.medianFeeNeeded = Math.round(block.feeRange[Math.round(block.feeRange.length * 0.5)]);

    // Block not filled
    if (block.weight < 4000000 * 0.95) {
      this.medianFeeNeeded = 1;
    }

    this.overpaidTimes = Math.round(feePervByte / this.medianFeeNeeded);

    if (feePervByte <= this.medianFeeNeeded || this.overpaidTimes < 2) {
      this.feeRating = 1;
    } else {
      this.feeRating = 2;
      if (this.overpaidTimes > 10) {
        this.feeRating = 3;
      }
    }
  }
}
