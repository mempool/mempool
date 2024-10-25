import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, map, Observable, share, tap } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { getFlagEmoji } from '@app/shared/common.utils';
import { GeolocationData } from '@app/shared/components/geolocation/geolocation.component';

@Component({
  selector: 'app-nodes-per-isp',
  templateUrl: './nodes-per-isp.component.html',
  styleUrls: ['./nodes-per-isp.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerISP implements OnInit {
  nodes$: Observable<any>;
  isp: {name: string, id: number};
  nodesPagination$: Observable<any>;
  startingIndexSubject: BehaviorSubject<number> = new BehaviorSubject(0);
  page = 1;
  pageSize = 15;
  maxSize = window.innerWidth <= 767.98 ? 3 : 5;
  isLoading = true;

  skeletonLines: number[] = [];

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private route: ActivatedRoute,
  ) {
    for (let i = 0; i < this.pageSize; ++i) {
      this.skeletonLines.push(i);
    }
  }

  ngOnInit(): void {
    this.nodes$ = this.apiService.getNodeForISP$(this.route.snapshot.params.isp)
      .pipe(
        tap(() => this.isLoading = true),
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
          
          return {
            nodes: response.nodes,
            sumLiquidity: sumLiquidity,
            sumChannels: sumChannels,
            topCountry: topCountry,
          };
        }),
        tap(() => this.isLoading = false),
        share()
      );

    this.nodesPagination$ = combineLatest([this.nodes$, this.startingIndexSubject]).pipe(
      map(([response, startingIndex]) => response.nodes.slice(startingIndex, startingIndex + this.pageSize))
    );
  }

  trackByPublicKey(index: number, node: any): string {
    return node.public_key;
  }

  pageChange(page: number): void {
    this.startingIndexSubject.next((page - 1) * this.pageSize);
    this.page = page;
  }
}
