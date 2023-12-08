import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ApiService } from '../../../services/api.service';
import { Acceleration } from '../../../interfaces/node-api.interface';

@Component({
  selector: 'app-pending-stats',
  templateUrl: './pending-stats.component.html',
  styleUrls: ['./pending-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PendingStatsComponent implements OnInit {
  @Input() accelerations$: Observable<Acceleration[]>;
  public accelerationStats$: Observable<any>;

  constructor(
    private apiService: ApiService,
  ) { }

  ngOnInit(): void {
    this.accelerationStats$ = (this.accelerations$ || this.apiService.getAccelerations$()).pipe(
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
          avgFeeDelta: totalAccelerations ? totalFeeDelta / totalAccelerations : 0,
          totalVsize,
        });
      })
    );
  }
}
