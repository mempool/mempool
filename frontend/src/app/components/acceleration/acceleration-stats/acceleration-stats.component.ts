import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit } from '@angular/core';
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
export class AccelerationStatsComponent implements OnInit, OnChanges {
  @Input() timespan: '3d' | '1w' | '1m' = '1w';
  accelerationStats$: Observable<AccelerationStats>;

  constructor(
    private servicesApiService: ServicesApiServices
  ) { }

  ngOnInit(): void {
    this.accelerationStats$ = this.servicesApiService.getAccelerationStats$({ timeframe: this.timespan });
  }

  ngOnChanges(): void {
    this.accelerationStats$ = this.servicesApiService.getAccelerationStats$({ timeframe: this.timespan });
  }
}
