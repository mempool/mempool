import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-acceleration-stats',
  templateUrl: './acceleration-stats.component.html',
  styleUrls: ['./acceleration-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccelerationStatsComponent implements OnInit {
  @Input() timespan: 'now' | '24h' | '1w' = '24h';
  public accelerationStats$: Observable<any>;

  constructor(
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    if (this.timespan === 'now') {
      this.accelerationStats$ = this.apiService.getAccelerations$().pipe(
        switchMap(accelerations => {
          let totalAccelerations = 0;
          let totalFeeDelta = 0;
          let totalVsize = 0;
          for (const acceleration of accelerations) {
            totalAccelerations++;
            totalFeeDelta += acceleration.feeDelta || 0;
            totalVsize += acceleration.effectiveVsize || 0;
          }
          return of({
            count: totalAccelerations,
            totalFeeDelta,
            totalVsize,
          });
        })
      );
    } else {
      this.accelerationStats$ = this.apiService.getAccelerationHistory$(this.timespan).pipe(
        switchMap(accelerations => {
          let totalFeeDelta = 0;
          let totalMined = 0;
          let totalCanceled = 0;
          for (const acceleration of accelerations) {
            if (acceleration.status === 'completed') {
              totalMined++;
              totalFeeDelta += acceleration.feeDelta || 0;
            } else if (acceleration.status === 'failed') {
              totalCanceled++;
            }
          }
          return of({
            count: totalMined,
            totalFeeDelta,
            successRate: (totalMined + totalCanceled > 0) ? ((totalMined / (totalMined + totalCanceled)) * 100) : 0.0,
          });
        })
      );
    }
  }


}
