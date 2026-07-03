import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, merge, catchError, debounceTime, distinctUntilChanged, filter, switchMap, tap, throttleTime } from 'rxjs';
import { ServicesApiServices } from '@app/services/services-api.service';
import { StateService } from '@app/services/state.service';

export type AccelerationStats = {
  totalRequested: number;
  totalAccepted: number;
  totalCompleted: number;
  totalBidBoost: number;
  totalVsize: number;
}

@Component({
  selector: 'app-acceleration-stats',
  templateUrl: './acceleration-stats.component.html',
  styleUrls: ['./acceleration-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class AccelerationStatsComponent implements OnInit, OnChanges {
  @Input() timespan: '24h' | '1m' | '1y' | 'all' = '1y';
  accelerationStats$: Observable<AccelerationStats>;
  blocksInPeriod: number = 7 * 144;
  private timespan$ = new BehaviorSubject<'24h' | '1m' | '1y' | 'all'>(
    this.timespan
  );

  constructor(
    private servicesApiService: ServicesApiServices,
    private stateService: StateService
  ) {}

  ngOnInit(): void {
    const websocketRefresh$ = this.stateService.accelerations$.pipe(
      filter(
        (delta) =>
          !delta.reset && (!!delta.added.length || !!delta.removed.length)
      ),
      throttleTime(2000)
    );

    this.accelerationStats$ = merge(
      this.timespan$.pipe(tap(() => this.updateBlocksInPeriod())),
      websocketRefresh$,
      this.stateService.chainTip$.pipe(distinctUntilChanged())
    ).pipe(
      debounceTime(0),
      switchMap(() =>
        this.servicesApiService
          .getAccelerationStats$({ timeframe: this.timespan })
          .pipe(
            catchError(() => EMPTY)
          )
      )
    );
  }

  ngOnChanges(): void {
    this.timespan$.next(this.timespan);
  }

  private updateBlocksInPeriod(): void {
    switch (this.timespan) {
      case '24h':
        this.blocksInPeriod = 144;
        break;
      case '1m':
        this.blocksInPeriod = 30.5 * 144;
        break;
      case '1y':
        this.blocksInPeriod = 30.5 * 144 * 365;
        break;
      case 'all':
        this.blocksInPeriod = Infinity;
        break;
    }
  }
}
