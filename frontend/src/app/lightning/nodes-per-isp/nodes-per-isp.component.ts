import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { GeolocationData } from 'src/app/shared/components/geolocation/geolocation.component';

@Component({
  selector: 'app-nodes-per-isp',
  templateUrl: './nodes-per-isp.component.html',
  styleUrls: ['./nodes-per-isp.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerISP implements OnInit {
  nodes$: Observable<any>;
  isp: {name: string, id: number};

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
    this.nodes$ = this.apiService.getNodeForISP$(this.route.snapshot.params.isp)
      .pipe(
        map(response => {
          this.isp = {
            name: response.isp,
            id: this.route.snapshot.params.isp
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

          return response.nodes;
        })
      );
  }

  trackByPublicKey(index: number, node: any) {
    return node.public_key;
  }
}
