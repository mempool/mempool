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
  @Input() timespan: '24h' | '1w' = '24h';
  public accelerationStats$: Observable<any>;

  constructor(
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    this.accelerationStats$ = this.apiService.getAccelerations$(this.timespan).pipe(
      switchMap(accelerations => {
        let totalFeeDelta = 0;
        let totalMined = 0;
        let totalCanceled = 0;
        for (const acceleration of accelerations) {
          if (acceleration.mined) {
            totalMined++;
            totalFeeDelta += acceleration.feeDelta;
          } else if (acceleration.canceled) {
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
