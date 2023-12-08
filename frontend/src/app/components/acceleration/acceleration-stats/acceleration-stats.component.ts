import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { StateService } from '../../../services/state.service';
import { Acceleration } from '../../../interfaces/node-api.interface';

@Component({
  selector: 'app-acceleration-stats',
  templateUrl: './acceleration-stats.component.html',
  styleUrls: ['./acceleration-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccelerationStatsComponent implements OnInit {
  @Input() timespan: '24h' | '1w' | '1m' = '24h';
  @Input() accelerations$: Observable<Acceleration[]>;
  public accelerationStats$: Observable<any>;

  constructor(
    private apiService: ApiService,
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.accelerationStats$ = this.accelerations$.pipe(
      switchMap(accelerations => {
        let totalFeesPaid = 0;
        let totalSucceeded = 0;
        let totalCanceled = 0;
        for (const acceleration of accelerations) {
          if (acceleration.status === 'completed') {
            totalSucceeded++;
            totalFeesPaid += acceleration.feePaid || 0;
          } else if (acceleration.status === 'failed') {
            totalCanceled++;
          }
        }
        return of({
          count: totalSucceeded,
          totalFeesPaid,
          successRate: (totalSucceeded + totalCanceled > 0) ? ((totalSucceeded / (totalSucceeded + totalCanceled)) * 100) : 0.0,
        });
      })
    );
  }
}
