import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, combineLatest, map, Observable, share, tap } from 'rxjs';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { getFlagEmoji } from '@app/shared/common.utils';
import { GeolocationData } from '@app/shared/components/geolocation/geolocation.component';

@Component({
  selector: 'app-nodes-per-country',
  templateUrl: './nodes-per-country.component.html',
  styleUrls: ['./nodes-per-country.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerCountry implements OnInit {
  nodes$: Observable<any>;
  country: {name: string, flag: string};
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
    private cd: ChangeDetectorRef,
    private route: ActivatedRoute,
  ) {
    for (let i = 0; i < this.pageSize; ++i) {
      this.skeletonLines.push(i);
    }
  }

  ngOnInit(): void {
    this.nodes$ = this.apiService.getNodeForCountry$(this.route.snapshot.params.country)
      .pipe(
        tap(() => this.isLoading = true),
        map(response => {
          this.seoService.setTitle($localize`Lightning nodes in ${response.country.en}`);
          this.seoService.setDescription($localize`:@@meta.description.lightning.nodes-country:Explore all the Lightning nodes hosted in ${response.country.en} and see an overview of each node's capacity, number of open channels, and more.`);

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
        tap(() => {
          this.isLoading = false
          this.cd.markForCheck();
        }),
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
