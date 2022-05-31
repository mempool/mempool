import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { map, filter, tap } from 'rxjs/operators';
import { merge, Observable } from 'rxjs';
import { MempoolBlock, Recommendedfees } from 'src/app/interfaces/websocket.interface';

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
  isLoadingWebSocket$: Observable<boolean>;
  recommendedFees$: Observable<Recommendedfees>;
  defaultFee: number;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.defaultFee = this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ? 0.1 : 1;

    this.isLoadingWebSocket$ = this.stateService.isLoadingWebSocket$;
    this.recommendedFees$ = this.stateService.recommendedFees$;
  }
}
