import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from '../../services/state.service';
import { Observable, combineLatest } from 'rxjs';
import { Recommendedfees } from '../../interfaces/websocket.interface';
import { feeLevels, mempoolFeeColors } from '../../app.constants';
import { map, startWith, tap } from 'rxjs/operators';

@Component({
  selector: 'app-fees-box',
  templateUrl: './fees-box.component.html',
  styleUrls: ['./fees-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeesBoxComponent implements OnInit {
  isLoading$: Observable<boolean>;
  recommendedFees$: Observable<Recommendedfees>;
  gradient = 'linear-gradient(to right, #2e324e, #2e324e)';
  noPriority = '#2e324e';

  constructor(
    private stateService: StateService
  ) { }

  ngOnInit(): void {
    this.isLoading$ = combineLatest(
      this.stateService.isLoadingWebSocket$.pipe(startWith(false)),
      this.stateService.loadingIndicators$.pipe(startWith({ mempool: 0 })),
    ).pipe(map(([socket, indicators]) => {
      return socket || (indicators.mempool != null && indicators.mempool !== 100);
    }));
    this.recommendedFees$ = this.stateService.recommendedFees$
      .pipe(
        tap((fees) => {
          const startColorIndex = feeLevels.findIndex((feeLvl) => fees.minimumFee <= feeLvl);
          const startColor = '#' + mempoolFeeColors[startColorIndex === -1 ? mempoolFeeColors.length - 1 : startColorIndex];

          const endColorIndex = feeLevels.findIndex((feeLvl) => fees.fastestFee <= feeLvl);
          const endColor = '#' + mempoolFeeColors[endColorIndex === -1 ? mempoolFeeColors.length - 1 : endColorIndex];

          this.gradient = `linear-gradient(to right, ${startColor}, ${endColor})`;
          this.noPriority = startColor;
        }
      )
    );
  }
}
