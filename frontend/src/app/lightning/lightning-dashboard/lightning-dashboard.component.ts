import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { Observable, merge } from 'rxjs';
import { share } from 'rxjs/operators';
import { INodesRanking, INodesStatistics } from '@interfaces/node-api.interface';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { StateService } from '@app/services/state.service';
import { LightningApiService } from '@app/lightning/lightning-api.service';

@Component({
  selector: 'app-lightning-dashboard',
  templateUrl: './lightning-dashboard.component.html',
  styleUrls: ['./lightning-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningDashboardComponent implements OnInit, AfterViewInit {
  statistics$: Observable<INodesStatistics>;
  nodesRanking$: Observable<INodesRanking>;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  graphHeight: number = 300;

  constructor(
    private lightningApiService: LightningApiService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private stateService: StateService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.onResize();

    this.seoService.setTitle($localize`:@@142e923d3b04186ac6ba23387265d22a2fa404e0:Lightning Explorer`);
    this.seoService.setDescription($localize`:@@meta.description.lightning.dashboard:Get stats on the Lightning network (aggregate capacity, connectivity, etc), Lightning nodes (channels, liquidity, etc) and Lightning channels (status, fees, etc).`);
    this.ogService.setManualOgImage('lightning.jpg');

    this.nodesRanking$ = this.lightningApiService.getNodesRanking$().pipe(share());
    this.statistics$ = this.lightningApiService.getLatestStatistics$().pipe(share());

    if (!this.stateService.isBrowser) {
      merge(this.nodesRanking$, this.statistics$).subscribe(() => {
        this.cd.markForCheck();
      });
    }
  }

  ngAfterViewInit(): void {
    this.stateService.focusSearchInputDesktop();
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 992) {
      this.graphHeight = 340;
    } else if (window.innerWidth >= 768) {
      this.graphHeight = 245;
    } else {
      this.graphHeight = 210;
    }
  }
}
