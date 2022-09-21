import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, combineLatest, BehaviorSubject, of } from 'rxjs';
import { map, share, switchMap } from 'rxjs/operators';
import { SeoService } from '../../services/seo.service';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { BisqApiService } from '../bisq-api.service';
import { Trade } from '../bisq.interfaces';

@Component({
  selector: 'app-bisq-dashboard',
  templateUrl: './bisq-dashboard.component.html',
  styleUrls: ['./bisq-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqDashboardComponent implements OnInit {
  tickers$: Observable<any>;
  volumes$: Observable<any>;
  trades$: Observable<Trade[]>;
  sort$ = new BehaviorSubject<string>('trades');

  allowCryptoCoins = ['usdc', 'l-btc', 'bsq'];

  constructor(
    private websocketService: WebsocketService,
    private bisqApiService: BisqApiService,
    public stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle(`Markets`);
    this.websocketService.want(['blocks']);

    this.volumes$ = this.bisqApiService.getAllVolumesDay$()
      .pipe(
        map((volumes) => {
          const data = volumes.map((volume) => {
            return {
              time: volume.period_start,
              value: volume.volume,
            };
          });

          const linesData = volumes.map((volume) => {
            return {
              time: volume.period_start,
              value: volume.num_trades,
            };
          });

          return {
            data: data,
            linesData: linesData,
          };
        })
      );

    const getMarkets = this.bisqApiService.getMarkets$().pipe(share());

    this.tickers$ = combineLatest([
      this.bisqApiService.getMarketsTicker$(),
      getMarkets,
      this.bisqApiService.getMarketVolumesByTime$('7d'),
    ])
    .pipe(
      map(([tickers, markets, volumes]) => {

        const newTickers = [];
        for (const t in tickers) {

          if (this.stateService.env.BASE_MODULE !== 'bisq') {
            const pair = t.split('_');
            if (pair[1] === 'btc' && this.allowCryptoCoins.indexOf(pair[0]) === -1) {
              continue;
            }
          }

          const mappedTicker: any = tickers[t];

          mappedTicker.pair_url = t;
          mappedTicker.pair = t.replace('_', '/').toUpperCase();
          mappedTicker.market = markets[t];
          mappedTicker.volume = volumes[t];
          mappedTicker.name = `${mappedTicker.market.rtype === 'crypto' ? mappedTicker.market.lname : mappedTicker.market.rname} (${mappedTicker.market.rtype === 'crypto' ? mappedTicker.market.lsymbol : mappedTicker.market.rsymbol}`;
          newTickers.push(mappedTicker);
        }
        return newTickers;
      }),
      switchMap((tickers) => combineLatest([this.sort$, of(tickers)])),
      map(([sort, tickers]) => {
        if (sort === 'trades') {
          tickers.sort((a, b) => (b.volume && b.volume.num_trades || 0) - (a.volume && a.volume.num_trades || 0));
        } else if (sort === 'volumes') {
          tickers.sort((a, b) => (b.volume && b.volume.volume || 0) - (a.volume && a.volume.volume || 0));
        } else if (sort === 'name') {
          tickers.sort((a, b) => a.name.localeCompare(b.name));
        }
        return tickers;
      })
    );

    this.trades$ = combineLatest([
      this.bisqApiService.getMarketTrades$('all'),
      getMarkets,
    ])
    .pipe(
      map(([trades, markets]) => {
        if (this.stateService.env.BASE_MODULE !== 'bisq') {
          trades = trades.filter((trade) => {
            const pair = trade.market.split('_');
            return !(pair[1] === 'btc' && this.allowCryptoCoins.indexOf(pair[0]) === -1);
          });
        }
        return trades.map((trade => {
          trade._market = markets[trade.market];
          return trade;
        }));
      })
    );
  }

  trackByFn(index: number) {
    return index;
  }

  sort(by: string) {
    this.sort$.next(by);
  }

}
