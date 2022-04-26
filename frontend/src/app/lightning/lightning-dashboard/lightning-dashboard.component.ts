import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { map, share } from 'rxjs/operators';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-lightning-dashboard',
  templateUrl: './lightning-dashboard.component.html',
  styleUrls: ['./lightning-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningDashboardComponent implements OnInit {
  nodesByCapacity$: Observable<any>;
  nodesByChannels$: Observable<any>;
  statistics$: Observable<any>;

  constructor(
    private lightningApiService: LightningApiService,
  ) { }

  ngOnInit(): void {
    const sharedObservable = this.lightningApiService.listTopNodes$().pipe(share());

    this.nodesByCapacity$ = sharedObservable
      .pipe(
        map((object) => object.topByCapacity),
      );

    this.nodesByChannels$ = sharedObservable
      .pipe(
        map((object) => object.topByChannels),
      );

    this.statistics$ = this.lightningApiService.getLatestStatistics$();
  }

}
