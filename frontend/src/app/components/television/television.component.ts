import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';
import { OptimizedMempoolStats } from '../../interfaces/node-api.interface';
import { StateService } from 'src/app/services/state.service';
import { ApiService } from 'src/app/services/api.service';
import { SeoService } from 'src/app/services/seo.service';
import { ActivatedRoute } from '@angular/router';
import { map, startWith, switchMap, tap } from 'rxjs/operators';
import { interval, merge, Observable } from 'rxjs';
import { isArray } from 'src/app/shared/pipes/bytes-pipe/utils';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: ['./television.component.scss']
})
export class TelevisionComponent implements OnInit {

  mempoolStats: OptimizedMempoolStats[] = [];
  statsSubscription$: Observable<any>;
  fragment: string;

  constructor(
    private websocketService: WebsocketService,
    private apiService: ApiService,
    private stateService: StateService,
    private seoService: SeoService,
    private route: ActivatedRoute
  ) { }

  refreshStats(time: number, fn: Observable<OptimizedMempoolStats[]>) {
    return interval(time).pipe(startWith(0), switchMap(() => fn));
  }

  ngOnInit() {
    this.seoService.setTitle($localize`:@@46ce8155c9ab953edeec97e8950b5a21e67d7c4e:TV view`);
    this.websocketService.want(['blocks', 'live-2h-chart', 'mempool-blocks']);

    this.statsSubscription$ = merge(
      this.stateService.live2Chart$,
      this.route.fragment
        .pipe(
          tap(fragment => { this.fragment = fragment; }),
          switchMap((fragment) => {
            const minute = 60000; const hour = 3600000;
            switch (fragment) {
              case '2h': return this.apiService.list2HStatistics$();
              case '24h': return this.apiService.list24HStatistics$();
              case '1w': return this.refreshStats(5 * minute, this.apiService.list1WStatistics$());
              case '1m': return this.refreshStats(30 * minute, this.apiService.list1MStatistics$());
              case '3m': return this.refreshStats(2 * hour, this.apiService.list3MStatistics$());
              case '6m': return this.refreshStats(3 * hour, this.apiService.list6MStatistics$());
              case '1y': return this.refreshStats(8 * hour, this.apiService.list1YStatistics$());
              case '2y': return this.refreshStats(8 * hour, this.apiService.list2YStatistics$());
              case '3y': return this.refreshStats(12 * hour, this.apiService.list3YStatistics$());
              default: return this.apiService.list2HStatistics$();
            }
          })
        )
    )
    .pipe(
      map(stats => {
        if (isArray(stats)) {
          this.mempoolStats = stats as OptimizedMempoolStats[];
        } else if (['2h', '24h'].includes(this.fragment)) {
          this.mempoolStats.unshift(stats as OptimizedMempoolStats);
          this.mempoolStats = this.mempoolStats.slice(0, this.mempoolStats.length - 1);
        }
        return this.mempoolStats;
      })
    );
  }
}
