import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from '../../services/seo.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-accelerator-dashboard',
  templateUrl: './accelerator-dashboard.component.html',
  styleUrls: ['./accelerator-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AcceleratorDashboardComponent implements OnInit {
  constructor(
    private seoService: SeoService,
    private websocketService: WebsocketService,
  ) {
    this.seoService.setTitle($localize`:@@a681a4e2011bb28157689dbaa387de0dd0aa0c11:Accelerator Dashboard`);
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks', 'stats']);
  }
}
