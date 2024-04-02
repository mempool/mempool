import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ServicesApiServices } from '../../../services/services-api.service';

export type AccelerationStats = {
  totalRequested: number;
  totalBidBoost: number;
  successRate: number;
}

@Component({
  selector: 'app-acceleration-stats',
  templateUrl: './acceleration-stats.component.html',
  styleUrls: ['./acceleration-stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccelerationStatsComponent implements OnInit {
  accelerationStats$: Observable<AccelerationStats>;

  constructor(
    private servicesApiService: ServicesApiServices
  ) { }

  ngOnInit(): void {
    this.accelerationStats$ = this.servicesApiService.getAccelerationStats$();
  }
}
