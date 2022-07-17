import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { map, Observable } from 'rxjs';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-nodes-per-isp',
  templateUrl: './nodes-per-isp.component.html',
  styleUrls: ['./nodes-per-isp.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesPerISP implements OnInit {
  nodes$: Observable<any>;
  isp: {name: string, id: number};

  constructor(
    private apiService: ApiService,
    private seoService: SeoService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    this.nodes$ = this.apiService.getNodeForISP$(this.route.snapshot.params.isp)
      .pipe(
        map(response => {
          this.isp = {
            name: response.isp,
            id: this.route.snapshot.params.isp
          };
          this.seoService.setTitle($localize`Lightning nodes on ISP: ${response.isp} [AS${this.route.snapshot.params.isp}]`);
          return response.nodes;
        })
      );
  }

  trackByPublicKey(index: number, node: any) {
    return node.public_key;
  }
}
