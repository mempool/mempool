import { AfterViewInit, ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { share } from 'rxjs/operators';
import { INodesRanking } from '../../interfaces/node-api.interface';
import { SeoService } from '../../services/seo.service';
import { StateService } from '../../services/state.service';
import { LightningApiService } from '../lightning-api.service';

@Component({
  selector: 'app-lightning-dashboard',
  templateUrl: './lightning-dashboard.component.html',
  styleUrls: ['./lightning-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningDashboardComponent implements OnInit, AfterViewInit {
  statistics$: Observable<any>;
  nodesRanking$: Observable<INodesRanking>;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private lightningApiService: LightningApiService,
    private seoService: SeoService,
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@142e923d3b04186ac6ba23387265d22a2fa404e0:Lightning Explorer`);
    this.seoService.setDescription($localize`:@@meta.description.lightning.dashboard:Get stats on the Lightning network (aggregate capacity, connectivity, etc), Lightning nodes (channels, liquidity, etc) and Lightning channels (status, fees, etc).`);

    this.nodesRanking$ = this.lightningApiService.getNodesRanking$().pipe(share());
    this.statistics$ = this.lightningApiService.getLatestStatistics$().pipe(share());
  }

  ngAfterViewInit(): void {
    this.stateService.focusSearchInputDesktop();
  }
}
