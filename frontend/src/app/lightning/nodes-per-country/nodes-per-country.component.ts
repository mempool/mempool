import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable, share } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { getFlagEmoji } from 'src/app/shared/common.utils';
import { GeolocationData } from 'src/app/shared/components/geolocation/geolocation.component';

@Component({
  selector: 'app-nodes-per-country',
  templateUrl: './nodes-per-country.component.html',
  styleUrls: ['./nodes-per-country.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerCountry implements OnInit {
  nodes$: Observable<any>;
  country: {name: string, flag: string};

  skeletonLines: number[] = [];

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private route: ActivatedRoute,
  ) {
    for (let i = 0; i < 20; ++i) {
      this.skeletonLines.push(i);
    }
  }

  ngOnInit(): void {
    this.nodes$ = this.apiService.getNodeForCountry$(this.route.snapshot.params.country)
      .pipe(
        map(response => {
          this.seoService.setTitle($localize`Lightning nodes in ${response.country.en}`);

          this.country = {
            name: response.country.en,
            flag: getFlagEmoji(this.route.snapshot.params.country)
          };

          for (const i in response.nodes) {
            response.nodes[i].geolocation = <GeolocationData>{
              country: response.nodes[i].country?.en,
              city: response.nodes[i].city?.en,
              subdivision: response.nodes[i].subdivision?.en,
              iso: response.nodes[i].iso_code,
            };
          }
          
          const sumLiquidity = response.nodes.reduce((partialSum, a) => partialSum + a.capacity, 0);
          const sumChannels = response.nodes.reduce((partialSum, a) => partialSum + a.channels, 0);
          const isps = {};
          const topIsp = {
            count: 0,
            id: '',
            name: '',
          };
          for (const node of response.nodes) {
            if (!node.isp) {
              continue;
            }
            if (!isps[node.isp]) {
              isps[node.isp] = {
                count: 0,
                asns: [],
              };
            }
            if (isps[node.isp].asns.indexOf(node.as_number) === -1) {
              isps[node.isp].asns.push(node.as_number);
            }
            isps[node.isp].count++;
            
            if (isps[node.isp].count > topIsp.count) {
              topIsp.count = isps[node.isp].count;
              topIsp.id = isps[node.isp].asns.join(',');
              topIsp.name = node.isp;
            }
          }
          
          return {
            nodes: response.nodes,
            sumLiquidity: sumLiquidity,
            sumChannels: sumChannels,
            topIsp: topIsp,
            ispCount: Object.keys(isps).length
          };
        }),
        share()
      );
  }

  trackByPublicKey(index: number, node: any): string {
    return node.public_key;
  }
}
