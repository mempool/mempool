import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { map, filter } from 'rxjs/operators';
import { merge, Observable } from 'rxjs';
import { MempoolBlock } from 'src/app/interfaces/websocket.interface';

interface FeeEstimations {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
}

@Component({
  selector: 'app-fees-box',
  templateUrl: './fees-box.component.html',
  styleUrls: ['./fees-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeesBoxComponent implements OnInit {
  feeEstimations$: Observable<FeeEstimations>;
  isLoadingWebSocket$: Observable<boolean>;
  defaultFee: number;

  constructor(private stateService: StateService) {}

  ngOnInit(): void {
    this.defaultFee = this.stateService.network === 'liquid' ? 0.1 : 1;

    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.feeEstimations$ = this.stateService.mempoolBlocks$.pipe(
      map(pBlocks => {
        if (!pBlocks.length) {
          return {
            fastestFee: this.defaultFee,
            halfHourFee: this.defaultFee,
            hourFee: this.defaultFee,
          };
        }

        const firstMedianFee = this.optimizeMedianFee(pBlocks[0], pBlocks[1]);
        const secondMedianFee = pBlocks[1]
          ? this.optimizeMedianFee(pBlocks[1], pBlocks[2], firstMedianFee)
          : this.defaultFee;
        const thirdMedianFee = pBlocks[2]
          ? this.optimizeMedianFee(pBlocks[2], pBlocks[3], secondMedianFee)
          : this.defaultFee;

        return {
          fastestFee: firstMedianFee,
          halfHourFee: secondMedianFee,
          hourFee: thirdMedianFee,
        };
      })
    );
  }

  private optimizeMedianFee(pBlock: MempoolBlock, nextBlock: MempoolBlock | undefined, previousFee?: number): number {
    const useFee = previousFee ? (pBlock.medianFee + previousFee) / 2 : pBlock.medianFee;
    if (pBlock.blockVSize <= 500000) {
      return this.defaultFee;
    }
    if (pBlock.blockVSize <= 950000 && !nextBlock) {
      const multiplier = (pBlock.blockVSize - 500000) / 500000;
      return Math.max(Math.round(useFee * multiplier), this.defaultFee);
    }
    return Math.ceil(useFee);
  }
}
