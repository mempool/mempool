import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';
import { OptimizedMempoolStats } from '../../interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: ['./television.component.scss']
})
export class TelevisionComponent implements OnInit {
  loading = true;

  mempoolStats: OptimizedMempoolStats[] = [];
  mempoolVsizeFeesData: any;

  constructor(
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle('TV view');
    this.websocketService.want(['blocks', 'live-2h-chart', 'mempool-blocks']);

    this.apiService.list2HStatistics$()
      .subscribe((mempoolStats) => {
        this.mempoolStats = mempoolStats;
        this.loading = false;
      });

    this.stateService.live2Chart$
      .subscribe((mempoolStats) => {
        this.mempoolStats.unshift(mempoolStats);
        this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - 1);
      });
  }

}
