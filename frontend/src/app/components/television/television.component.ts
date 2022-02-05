import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';
import { OptimizedMempoolStats } from '../../interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: ['./television.component.scss']
})
export class TelevisionComponent implements OnInit {

  mempoolStats: OptimizedMempoolStats[] = [];
  mempoolVsizeFeesData: any;

  constructor(
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private stateService: StateService,
    private seoService: SeoService,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.seoService.setTitle($localize`:@@46ce8155c9ab953edeec97e8950b5a21e67d7c4e:TV view`);
    this.websocketService.want(['blocks', 'live-2h-chart', 'mempool-blocks']);

    this.route.fragment
      .pipe(
        switchMap((fragment) => {
          switch (fragment) {
            case '2h': return this.apiService.list2HStatistics$();
            case '24h': return this.apiService.list24HStatistics$();
            case '1w': return this.apiService.list1WStatistics$();
            case '1m': return this.apiService.list1MStatistics$();
            case '3m': return this.apiService.list3MStatistics$();
            case '6m': return this.apiService.list6MStatistics$();
            case '1y': return this.apiService.list1YStatistics$();
            case '2y': return this.apiService.list2YStatistics$();
            case '3y': return this.apiService.list3YStatistics$();
            default: return this.apiService.list2HStatistics$();
          }
        })
      )
      .subscribe((mempoolStats) => {
        this.mempoolStats = mempoolStats;
      });

    this.stateService.live2Chart$
      .subscribe((mempoolStats) => {
        this.mempoolStats.unshift(mempoolStats);
        this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - 1);
      });
  }

}
