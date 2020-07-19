import { Component, OnInit } from '@angular/core';
import { BisqApiService } from '../bisq-api.service';
import { BisqStats } from '../bisq.interfaces';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';

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
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle('BSQ Statistics', false);

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
