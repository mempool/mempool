import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable } from 'rxjs';
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

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.nodes$ = this.apiService.getNodeForCountry$(this.route.snapshot.params.country)
      .pipe(
        map(response => {
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

          this.seoService.setTitle($localize`Lightning nodes in ${this.country.name}`);
          return response.nodes;
        })
      );
  }

  trackByPublicKey(index: number, node: any) {
    return node.public_key;
  }
}
