import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { map, filter } from 'rxjs/operators';
import { Observable } from 'rxjs';

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

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.feeEstimations$ = this.stateService.mempoolBlocks$
      .pipe(
        filter((blocks) => !!blocks.length),
        map((pBlocks) => {
          let firstMedianFee = Math.ceil(pBlocks[0].medianFee);

          if (pBlocks.length === 1 && pBlocks[0].blockVSize <= 500000) {
            firstMedianFee = 1;
          }

          const secondMedianFee = pBlocks[1] ? Math.ceil(pBlocks[1].medianFee) : firstMedianFee;
          const thirdMedianFee = pBlocks[2] ? Math.ceil(pBlocks[2].medianFee) : secondMedianFee;

          return {
            'fastestFee': firstMedianFee,
            'halfHourFee': secondMedianFee,
            'hourFee': thirdMedianFee,
          };
        })
      );
  }

}
