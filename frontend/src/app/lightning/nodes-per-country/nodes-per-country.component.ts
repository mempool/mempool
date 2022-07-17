import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { getFlagEmoji } from 'src/app/shared/graphs.utils';

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
          this.seoService.setTitle($localize`Lightning nodes in ${this.country.name}`);
          return response.nodes;
        })
      );
  }

  trackByPublicKey(index: number, node: any) {
    return node.public_key;
  }
}
