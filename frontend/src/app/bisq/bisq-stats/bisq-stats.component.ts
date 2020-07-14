import { Component, OnInit } from '@angular/core';
import { BisqApiService } from '../bisq-api.service';
import { BisqStats } from '../bisq.interfaces';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-bisq-stats',
  templateUrl: './bisq-stats.component.html',
  styleUrls: ['./bisq-stats.component.scss']
})
export class BisqStatsComponent implements OnInit {
  isLoading = true;
  stats: BisqStats;

  constructor(
    private bisqApiService: BisqApiService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('BSQ Statistics', false);

    this.bisqApiService.getStats$()
      .subscribe((stats) => {
        this.isLoading = false;
        this.stats = stats;
      });
  }

}
