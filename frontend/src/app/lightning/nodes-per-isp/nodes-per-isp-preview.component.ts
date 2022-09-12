import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { catchError, map, switchMap, Observable, share, of } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { OpenGraphService } from 'src/app/services/opengraph.service';
import { getFlagEmoji } from 'src/app/shared/common.utils';
import { GeolocationData } from 'src/app/shared/components/geolocation/geolocation.component';

@Component({
  selector: 'app-nodes-per-isp-preview',
  templateUrl: './nodes-per-isp-preview.component.html',
  styleUrls: ['./nodes-per-isp-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerISPPreview implements OnInit {
  nodes$: Observable<any>;
  isp: {name: string, id: number};
  id: string;
  error: Error;

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private openGraphService: OpenGraphService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.nodes$ = this.route.paramMap
      .pipe(
        switchMap((params: ParamMap) => {
          this.id = params.get('isp');
          this.isp = null;
          this.openGraphService.waitFor('isp-map-' + this.id);
          this.openGraphService.waitFor('isp-data-' + this.id);
          return this.apiService.getNodeForISP$(params.get('isp'));
        }),
        map(response => {
          this.isp = {
            name: response.isp,
            id: this.route.snapshot.params.isp.split(',').join(', ')
          };
          this.seoService.setTitle($localize`Lightning nodes on ISP: ${response.isp} [AS${this.route.snapshot.params.isp}]`);

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
          const countries = {};
          const topCountry = {
            count: 0,
            country: '',
            iso: '',
            flag: '',
          };
          for (const node of response.nodes) {
            if (!node.geolocation.iso) {
              continue;
            }
            countries[node.geolocation.iso] = countries[node.geolocation.iso] ?? 0 + 1;
            if (countries[node.geolocation.iso] > topCountry.count) {
              topCountry.count = countries[node.geolocation.iso];
              topCountry.country = node.geolocation.country;
              topCountry.iso = node.geolocation.iso;
            }
          }
          topCountry.flag = getFlagEmoji(topCountry.iso);

          this.openGraphService.waitOver('isp-data-' + this.id);

          return {
            nodes: response.nodes,
            sumLiquidity: sumLiquidity,
            sumChannels: sumChannels,
            topCountry: topCountry,
          };
        }),
        catchError(err => {
          this.error = err;
          this.openGraphService.fail('isp-map-' + this.id);
          this.openGraphService.fail('isp-data-' + this.id);
          return of({
            nodes: [],
            sumLiquidity: 0,
            sumChannels: 0,
            topCountry: {},
          });
        })
      );
  }

  onMapReady() {
    this.openGraphService.waitOver('isp-map-' + this.id);
  }
}
