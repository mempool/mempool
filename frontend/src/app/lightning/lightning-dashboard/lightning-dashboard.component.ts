import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';
import { INodesRanking } from 'src/app/interfaces/node-api.interface';
import { SeoService } from 'src/app/services/seo.service';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-lightning-dashboard',
  templateUrl: './lightning-dashboard.component.html',
  styleUrls: ['./lightning-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningDashboardComponent implements OnInit {
  statistics$: Observable<any>;
  nodesRanking$: Observable<INodesRanking>;

  constructor(
    private lightningApiService: LightningApiService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle($localize`Lightning Network`);

    this.nodesRanking$ = this.lightningApiService.getNodesRanking$().pipe(share());
    this.statistics$ = this.lightningApiService.getLatestStatistics$().pipe(share());
  }

}
