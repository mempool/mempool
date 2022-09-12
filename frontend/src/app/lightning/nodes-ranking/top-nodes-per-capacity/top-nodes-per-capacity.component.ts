import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { map, Observable } from 'rxjs';
import { INodesRanking, ITopNodesPerCapacity } from 'src/app/interfaces/node-api.interface';
import { SeoService } from 'src/app/services/seo.service';
import { isMobile } from 'src/app/shared/common.utils';
import { GeolocationData } from 'src/app/shared/components/geolocation/geolocation.component';
import { LightningApiService } from '../../lightning-api.service';

@Component({
  selector: 'app-top-nodes-per-capacity',
  templateUrl: './top-nodes-per-capacity.component.html',
  styleUrls: ['./top-nodes-per-capacity.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopNodesPerCapacity implements OnInit {
  @Input() nodes$: Observable<INodesRanking>;
  @Input() widget: boolean = false;
  
  topNodesPerCapacity$: Observable<ITopNodesPerCapacity[]>;
  skeletonRows: number[] = [];

  constructor(
    private apiService: LightningApiService,
    private seoService: SeoService
  ) {}

  ngOnInit(): void {
    if (!this.widget) {
      this.seoService.setTitle($localize`Liquidity Ranking`);
    }

    for (let i = 1; i <= (this.widget ? (isMobile() ? 8 : 7) : 100); ++i) {
      this.skeletonRows.push(i);
    }

    if (this.widget === false) {
      this.topNodesPerCapacity$ = this.apiService.getTopNodesByCapacity$().pipe(
        map((ranking) => {
          for (const i in ranking) {
            ranking[i].geolocation = <GeolocationData>{
              country: ranking[i].country?.en,
              city: ranking[i].city?.en,
              subdivision: ranking[i].subdivision?.en,
              iso: ranking[i].iso_code,
            };
          }
          return ranking;
        })
      );
    } else {
      this.topNodesPerCapacity$ = this.nodes$.pipe(
        map((ranking) => {
          return ranking.topByCapacity.slice(0, isMobile() ? 8 : 7);
        })
      );
    }
  }

}
