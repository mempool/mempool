import { Component, OnInit, OnDestroy } from '@angular/core';
import { WebsocketService } from '@app/services/websocket.service';
import { OptimizedMempoolStats } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { ActivatedRoute } from '@angular/router';
import { map, scan, startWith, switchMap, tap } from 'rxjs/operators';
import { interval, merge, Observable, Subscription } from 'rxjs';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-television',
  templateUrl: './television.component.html',
  styleUrls: ['./television.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TelevisionComponent implements OnInit, OnDestroy {

  mempoolStats: OptimizedMempoolStats[] = [];
  statsSubscription$: Observable<OptimizedMempoolStats[]>;
  fragment: string;
  timeLtrSubscription: Subscription;
  timeLtr: boolean = this.stateService.timeLtr.value;

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
    this.seoService.setDescription($localize`:@@meta.description.tv:See Bitcoin blocks and mempool congestion in real-time in a simplified format perfect for a TV.`);
    this.websocketService.want(['blocks', 'live-2h-chart', 'mempool-blocks']);

    this.timeLtrSubscription = this.stateService.timeLtr.subscribe((ltr) => {
      this.timeLtr = !!ltr;
    });

    this.statsSubscription$ = merge(
      this.stateService.live2Chart$.pipe(map(stats => [stats])),
      this.route.fragment
        .pipe(
          tap(fragment => { this.fragment = fragment ?? '2h'; }),
          switchMap((fragment) => {
            const minute = 60000; const hour = 3600000;
            switch (fragment) {
              case '24h': return this.apiService.list24HStatistics$();
              case '1w': return this.refreshStats(5 * minute, this.apiService.list1WStatistics$());
              case '1m': return this.refreshStats(30 * minute, this.apiService.list1MStatistics$());
              case '3m': return this.refreshStats(2 * hour, this.apiService.list3MStatistics$());
              case '6m': return this.refreshStats(3 * hour, this.apiService.list6MStatistics$());
              case '1y': return this.refreshStats(8 * hour, this.apiService.list1YStatistics$());
              case '2y': return this.refreshStats(8 * hour, this.apiService.list2YStatistics$());
              case '3y': return this.refreshStats(12 * hour, this.apiService.list3YStatistics$());
              default /* 2h */: return this.apiService.list2HStatistics$();
            }
          })
        )
    )
    .pipe(
      scan((mempoolStats, newStats) => {
        if (newStats.length > 1) {
          mempoolStats = newStats;
        } else if (['2h', '24h'].includes(this.fragment)) {
          mempoolStats.unshift(newStats[0]);
          const now = Date.now() / 1000;
          const start = now - (this.fragment === '2h' ? (2 * 60 * 60) : (24 * 60 * 60) );
          mempoolStats = mempoolStats.filter(p => p.added >= start);
        }
        return mempoolStats;
      })
    );
  }

  ngOnDestroy() {
    this.timeLtrSubscription.unsubscribe();
  }
}
