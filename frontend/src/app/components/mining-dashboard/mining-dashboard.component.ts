import { AfterViewInit, ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '../../services/seo.service';
import { WebsocketService } from '../../services/websocket.service';
import { StateService } from '../../services/state.service';
import { EventType, NavigationStart, Router } from '@angular/router';

@Component({
  selector: 'app-mining-dashboard',
  templateUrl: './mining-dashboard.component.html',
  styleUrls: ['./mining-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiningDashboardComponent implements OnInit, AfterViewInit {
  constructor(
    private seoService: SeoService,
    private websocketService: WebsocketService,
    private stateService: StateService,
    private router: Router
  ) {
    this.seoService.setTitle($localize`:@@a681a4e2011bb28157689dbaa387de0dd0aa0c11:Mining Dashboard`);
    this.seoService.setDescription($localize`:@@meta.description.mining.dashboard:Get real-time Bitcoin mining stats like hashrate, difficulty adjustment, block rewards, pool dominance, and more.`);
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks', 'stats']);
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
}
