import { AfterViewInit, ChangeDetectionStrategy, Component, HostListener, OnInit } from '@angular/core';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { WebsocketService } from '@app/services/websocket.service';
import { StateService } from '@app/services/state.service';
import { EventType, NavigationStart, Router } from '@angular/router';

@Component({
  selector: 'app-mining-dashboard',
  templateUrl: './mining-dashboard.component.html',
  styleUrls: ['./mining-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiningDashboardComponent implements OnInit, AfterViewInit {
  hashrateGraphHeight = 335;
  poolGraphHeight = 375;

  constructor(
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.onResize();
    this.websocketService.want(['blocks', 'mempool-blocks', 'stats']);
    this.seoService.setTitle($localize`:@@a681a4e2011bb28157689dbaa387de0dd0aa0c11:Mining Dashboard`);
    this.seoService.setDescription($localize`:@@meta.description.mining.dashboard:Get real-time Bitcoin mining stats like hashrate, difficulty adjustment, block rewards, pool dominance, and more.`);
    this.ogService.setManualOgImage('mining.jpg');
  }

  ngAfterViewInit(): void {
    this.stateService.focusSearchInputDesktop();
    this.router.events.subscribe((e: NavigationStart) => {
      if (e.type === EventType.NavigationStart) {
        if (e.url.indexOf('graphs') === -1) { // The mining dashboard and the graph component are part of the same module so we can't use ngAfterViewInit in graphs.component.ts to blur the input
          this.stateService.focusSearchInputDesktop();
        }
      }
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    if (window.innerWidth >= 992) {
      this.hashrateGraphHeight = 335;
      this.poolGraphHeight = 375;
    } else if (window.innerWidth >= 768) {
      this.hashrateGraphHeight = 245;
      this.poolGraphHeight = 265;
    } else {
      this.hashrateGraphHeight = 240;
      this.poolGraphHeight = 240;
    }
  }
}
