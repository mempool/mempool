import { Component, OnInit } from '@angular/core';
import { BisqApiService } from '../bisq-api.service';
import { BisqStats } from '../bisq.interfaces';
import { SeoService } from '../../services/seo.service';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-bisq-stats',
  templateUrl: './bisq-stats.component.html',
  styleUrls: ['./bisq-stats.component.scss']
})
export class BisqStatsComponent implements OnInit {
  isLoading = true;
  stats: BisqStats;
  price: number;

  constructor(
    private websocketService: WebsocketService,
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks']);

    this.seoService.setTitle($localize`:@@2a30a4cdb123a03facc5ab8c5b3e6d8b8dbbc3d4:BSQ statistics`);
    this.stateService.bsqPrice$
      .subscribe((bsqPrice) => {
        this.price = bsqPrice;
      });

    this.bisqApiService.getStats$()
      .subscribe((stats) => {
        this.isLoading = false;
        this.stats = stats;
      });
  }

}
