import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';
import { OptimizedMempoolStats } from '../../interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: ['./television.component.scss'],
})
export class TelevisionComponent implements OnInit {
  isLoading$: Observable<boolean>;

  mempoolStats: OptimizedMempoolStats[] = [];
  mempoolVsizeFeesData: any;

  constructor(
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private stateService: StateService,
    private seoService: SeoService
  ) {}

  ngOnInit() {
    this.seoService.setTitle($localize`:@@46ce8155c9ab953edeec97e8950b5a21e67d7c4e:TV view`);
    this.websocketService.want(['blocks', 'live-2h-chart', 'mempool-blocks']);
    this.isLoading$ = this.stateService.isLoadingWebSocket$;

    this.apiService.list2HStatistics$().subscribe(mempoolStats => {
      this.mempoolStats = mempoolStats;
    });

    this.stateService.live2Chart$.subscribe(mempoolStats => {
      this.mempoolStats.unshift(mempoolStats);
      this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - 1);
    });
  }
}
