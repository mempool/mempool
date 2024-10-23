import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, share } from 'rxjs';
import { INodesRanking } from '@interfaces/node-api.interface';
import { SeoService } from '@app/services/seo.service';
import { LightningApiService } from '@app/lightning/lightning-api.service';

@Component({
  selector: 'app-nodes-rankings-dashboard',
  templateUrl: './nodes-rankings-dashboard.component.html',
  styleUrls: ['./nodes-rankings-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesRankingsDashboard implements OnInit {
  nodesRanking$: Observable<INodesRanking>;

  constructor(
    private lightningApiService: LightningApiService,
    private seoService: SeoService,
  ) {}

  ngOnInit(): void {
    this.seoService.setTitle($localize`Top lightning nodes`);
    this.seoService.setDescription($localize`:@@meta.description.lightning.rankings-dashboard:See the top Lightning network nodes ranked by liquidity, connectivity, and age.`);
    this.nodesRanking$ = this.lightningApiService.getNodesRanking$().pipe(share());
  }
}
