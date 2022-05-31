import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';
import { Recommendedfees } from 'src/app/interfaces/websocket.interface';
import { feeLevels, mempoolFeeColors } from 'src/app/app.constants';
import { tap } from 'rxjs/operators';

@Component({
  selector: 'app-fees-box',
  templateUrl: './fees-box.component.html',
  styleUrls: ['./fees-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeesBoxComponent implements OnInit {
  isLoadingWebSocket$: Observable<boolean>;
  recommendedFees$: Observable<Recommendedfees>;
  defaultFee: number;
  startColor = '#557d00';
  endColor = '#557d00';

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.defaultFee = this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ? 0.1 : 1;

    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.recommendedFees$ = this.stateService.recommendedFees$
      .pipe(
        tap((fees) => {
          // fees.fastestFee = 400;
          // fees.halfHourFee = 75;
          // fees.hourFee = 50;
          // fees.economyFee = 40;
          // fees.minimumFee = 5;

          let feeLevelIndex = feeLevels.slice().reverse().findIndex((feeLvl) => fees.minimumFee >= feeLvl);
          feeLevelIndex = feeLevelIndex >= 0 ? feeLevels.length - feeLevelIndex : feeLevelIndex;
          this.startColor = '#' + (mempoolFeeColors[feeLevelIndex - 1] || mempoolFeeColors[mempoolFeeColors.length - 1]);

          feeLevelIndex = feeLevels.slice().reverse().findIndex((feeLvl) => fees.fastestFee >= feeLvl);
          feeLevelIndex = feeLevelIndex >= 0 ? feeLevels.length - feeLevelIndex : feeLevelIndex;
          this.endColor = '#' + (mempoolFeeColors[feeLevelIndex - 1] || mempoolFeeColors[mempoolFeeColors.length - 1]);
        }
      )
    );
  }
}
