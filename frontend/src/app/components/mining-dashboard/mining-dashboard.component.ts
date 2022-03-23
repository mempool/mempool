import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { map } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-mining-dashboard',
  templateUrl: './mining-dashboard.component.html',
  styleUrls: ['./mining-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiningDashboardComponent implements OnInit {
  private blocks = [];

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
