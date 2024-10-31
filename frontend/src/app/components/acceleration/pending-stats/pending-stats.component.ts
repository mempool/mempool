import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Acceleration } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';

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
    private stateService: StateService,
    private websocketService: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.accelerationStats$ = (this.accelerations$ || this.stateService.liveAccelerations$).pipe(
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
