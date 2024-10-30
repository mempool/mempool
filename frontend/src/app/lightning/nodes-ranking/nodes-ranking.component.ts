import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LightningApiService } from '@app/lightning/lightning-api.service';
import { share } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { INodesStatistics } from '@interfaces/node-api.interface';

@Component({
  selector: 'app-nodes-ranking',
  templateUrl: './nodes-ranking.component.html',
  styleUrls: ['./nodes-ranking.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodesRanking implements OnInit {
  type: string;
  statistics$: Observable<INodesStatistics>;

  constructor(
    private route: ActivatedRoute,
    private lightningApiService: LightningApiService,
  ) {}

  ngOnInit(): void {
    this.statistics$ = this.lightningApiService.getLatestStatistics$().pipe(share());
    this.route.data.subscribe(data => {
      this.type = data.type;
    });
  }
}
