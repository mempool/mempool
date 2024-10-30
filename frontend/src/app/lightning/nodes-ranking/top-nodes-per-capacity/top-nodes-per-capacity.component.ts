import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { INodesRanking, INodesStatistics, ITopNodesPerCapacity } from '@interfaces/node-api.interface';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { GeolocationData } from '@app/shared/components/geolocation/geolocation.component';
import { LightningApiService } from '@app/lightning/lightning-api.service';

@Component({
  selector: 'app-top-nodes-per-capacity',
  templateUrl: './top-nodes-per-capacity.component.html',
  styleUrls: ['./top-nodes-per-capacity.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNodesPerCapacity implements OnInit {
  @Input() nodes$: Observable<INodesRanking>;
  @Input() statistics$: Observable<INodesStatistics>;
  @Input() widget: boolean = false;

  topNodesPerCapacity$: Observable<{ nodes: ITopNodesPerCapacity[]; statistics: { totalCapacity: number; totalChannels?: number; } }>;
  skeletonRows: number[] = [];
  currency$: Observable<string>;

  constructor(
    private apiService: LightningApiService,
    private seoService: SeoService,
    private stateService: StateService,
  ) {}

  ngOnInit(): void {
    this.currency$ = this.stateService.fiatCurrency$;

    if (!this.widget) {
      this.seoService.setTitle($localize`:@@2d9883d230a47fbbb2ec969e32a186597ea27405:Liquidity Ranking`);
      this.seoService.setDescription($localize`:@@meta.description.lightning.ranking.liquidity:See Lightning nodes with the most BTC liquidity deployed along with high-level stats like number of open channels, location, node age, and more.`);
    }

    for (let i = 1; i <= (this.widget ? 6 : 100); ++i) {
      this.skeletonRows.push(i);
    }

    if (this.widget === false) {
      this.topNodesPerCapacity$ = combineLatest([
        this.apiService.getTopNodesByCapacity$(),
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
              totalCapacity: statistics.latest.total_capacity,
              totalChannels: statistics.latest.channel_count,
            }
          }
        })
      );
    } else {
      this.topNodesPerCapacity$ = combineLatest([
        this.nodes$,
        this.statistics$
      ])
      .pipe(
        map(([ranking, statistics]) => {
          return {
            nodes: ranking.topByCapacity.slice(0, 6),
            statistics: {
              totalCapacity: statistics.latest.total_capacity,
            }
          }
        })
      );
    }
  }

}
