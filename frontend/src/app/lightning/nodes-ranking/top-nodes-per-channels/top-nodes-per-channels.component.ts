import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { INodesRanking, INodesStatistics, ITopNodesPerChannels } from '@interfaces/node-api.interface';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { GeolocationData } from '@app/shared/components/geolocation/geolocation.component';
import { LightningApiService } from '@app/lightning/lightning-api.service';

@Component({
  selector: 'app-top-nodes-per-channels',
  templateUrl: './top-nodes-per-channels.component.html',
  styleUrls: ['./top-nodes-per-channels.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNodesPerChannels implements OnInit {
  @Input() nodes$: Observable<INodesRanking>;
  @Input() statistics$: Observable<INodesStatistics>;
  @Input() widget: boolean = false;
  
  topNodesPerChannels$: Observable<{ nodes: ITopNodesPerChannels[]; statistics: { totalChannels: number; totalCapacity?: number; } }>;
  skeletonRows: number[] = [];
  currency$: Observable<string>;
  
  constructor(
    private apiService: LightningApiService,
    private stateService: StateService,
    private seoService: SeoService,
  ) {}

  ngOnInit(): void {
    this.currency$ = this.stateService.fiatCurrency$;
    
    for (let i = 1; i <= (this.widget ? 6 : 100); ++i) {
      this.skeletonRows.push(i);
    }

    if (this.widget === false) {
      this.seoService.setTitle($localize`:@@c50bf442cf99f6fc5f8b687c460f33234b879869:Connectivity Ranking`);
      this.seoService.setDescription($localize`:@@meta.description.lightning.ranking.channels:See Lightning nodes with the most channels open along with high-level stats like total node capacity, node age, and more.`);

      this.topNodesPerChannels$ = combineLatest([
        this.apiService.getTopNodesByChannels$(),
        this.statistics$
      ])
      .pipe(
        map(([ranking, statistics]) => {
          for (const i in ranking) {
            ranking[i].geolocation = <GeolocationData>{
              country: ranking[i].country?.en,
              city: ranking[i].city?.en,
              subdivision: ranking[i].subdivision?.en,
              iso: ranking[i].iso_code,
            };
          }
          return {
            nodes: ranking,
            statistics: {
              totalChannels: statistics.latest.channel_count,
              totalCapacity: statistics.latest.total_capacity,
            }
          }
        })
      );
    } else {
      this.topNodesPerChannels$ = combineLatest([
        this.nodes$,
        this.statistics$
      ])
      .pipe(
        map(([ranking, statistics]) => {
          for (const i in ranking.topByChannels) {
            ranking.topByChannels[i].geolocation = <GeolocationData>{
              country: ranking.topByChannels[i].country?.en,
              city: ranking.topByChannels[i].city?.en,
              subdivision: ranking.topByChannels[i].subdivision?.en,
              iso: ranking.topByChannels[i].iso_code,
            };
          }
          return {
            nodes: ranking.topByChannels.slice(0, 6),
            statistics: {
              totalChannels: statistics.latest.channel_count,
            }
          }
        })
      );
    }
  }

}
