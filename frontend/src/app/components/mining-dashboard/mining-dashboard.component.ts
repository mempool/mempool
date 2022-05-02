import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { SeoService } from 'src/app/services/seo.service';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-mining-dashboard',
  templateUrl: './mining-dashboard.component.html',
  styleUrls: ['./mining-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiningDashboardComponent implements OnInit {
  constructor(
    private seoService: SeoService,
    private websocketService: WebsocketService,
  ) {
    this.seoService.setTitle($localize`:@@mining.mining-dashboard:Mining Dashboard`);
  }

  ngOnInit(): void {
    this.websocketService.want(['blocks', 'mempool-blocks']);
  }
}
