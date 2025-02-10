import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { catchError, map, switchMap, Observable, share, of } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { getFlagEmoji } from '@app/shared/common.utils';
import { GeolocationData } from '@app/shared/components/geolocation/geolocation.component';

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

  ogSession: number;

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
          this.ogSession = this.openGraphService.waitFor('isp-map-' + this.id);
          this.ogSession = this.openGraphService.waitFor('isp-data-' + this.id);
          return this.apiService.getNodeForISP$(params.get('isp'));
        }),
        map(response => {
          this.isp = {
            name: response.isp,
            id: this.route.snapshot.params.isp.split(',').join(', ')
          };
          this.seoService.setTitle($localize`Lightning nodes on ISP: ${response.isp} [AS${this.route.snapshot.params.isp}]`);
          this.seoService.setDescription($localize`:@@meta.description.lightning.nodes-isp:Browse all Bitcoin Lightning nodes using the ${response.isp} [AS${this.route.snapshot.params.isp}] ISP and see aggregate stats like total number of nodes, total capacity, and more for the ISP.`);

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

          this.openGraphService.waitOver({ event: 'isp-data-' + this.id, sessionId: this.ogSession });

          return {
            nodes: response.nodes,
            sumLiquidity: sumLiquidity,
            sumChannels: sumChannels,
            topCountry: topCountry,
          };
        }),
        catchError(err => {
          this.error = err;
          this.seoService.logSoft404();
          this.openGraphService.fail({ event: 'isp-map-' + this.id, sessionId: this.ogSession });
          this.openGraphService.fail({ event: 'isp-data-' + this.id, sessionId: this.ogSession });
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
    this.openGraphService.waitOver({ event: 'isp-map-' + this.id, sessionId: this.ogSession });
  }
}
