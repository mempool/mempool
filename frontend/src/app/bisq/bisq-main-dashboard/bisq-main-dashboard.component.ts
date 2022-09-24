import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, combineLatest, BehaviorSubject, of } from 'rxjs';
import { map, share, switchMap } from 'rxjs/operators';
import { SeoService } from '../../services/seo.service';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';
import { BisqApiService } from '../bisq-api.service';
import { Trade } from '../bisq.interfaces';

@Component({
  selector: 'app-main-bisq-dashboard',
  templateUrl: './bisq-main-dashboard.component.html',
  styleUrls: ['./bisq-main-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqMainDashboardComponent implements OnInit {
  tickers$: Observable<any>;
  volumes$: Observable<any>;
  trades$: Observable<Trade[]>;
  sort$ = new BehaviorSubject<string>('trades');
  hlocData$: Observable<any>;
  usdPrice$: Observable<number>;
  isLoadingGraph = true;
  bisqMarketPrice = 0;

  allowCryptoCoins = ['usdc', 'l-btc', 'bsq'];

  constructor(
    private websocketService: WebsocketService,
    private bisqApiService: BisqApiService,
    public stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.resetTitle();
    this.websocketService.want(['blocks']);

    this.usdPrice$ = this.stateService.conversions$.asObservable().pipe(
      map((conversions) => conversions.USD)
    );

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
        return tickers.slice(0, 10);
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
        })).slice(0, 10);
      })
    );

    this.hlocData$ = this.bisqApiService.getMarketsHloc$('btc_usd', 'day')
      .pipe(
      map((hlocData) => {
        this.isLoadingGraph = false;

        hlocData = hlocData.map((h) => {
          h.time = h.period_start;
          return h;
        });

        const hlocVolume = hlocData.map((h) => {
          return {
            time: h.time,
            value: h.volume_right,
            color: h.close > h.avg ? 'rgba(0, 41, 74, 0.7)' : 'rgba(0, 41, 74, 1)',
          };
        });

        // Add whitespace
        if (hlocData.length > 1) {
          const newHloc = [];
          newHloc.push(hlocData[0]);

          const period = 86400;
          let periods = 0;
          const startingDate = hlocData[0].period_start;
          let index = 1;
          while (true) {
            periods++;
            if (hlocData[index].period_start > startingDate + period * periods) {
              newHloc.push({
                time: startingDate + period * periods,
              });
            } else {
              newHloc.push(hlocData[index]);
              index++;
              if (!hlocData[index]) {
                break;
              }
            }
          }
          hlocData = newHloc;
        }

        this.bisqMarketPrice = hlocData[hlocData.length - 1].close;

        return {
          hloc: hlocData,
          volume: hlocVolume,
        };
      }),
    );
  }

  trackByFn(index: number) {
    return index;
  }

  sort(by: string) {
    this.sort$.next(by);
  }

}
