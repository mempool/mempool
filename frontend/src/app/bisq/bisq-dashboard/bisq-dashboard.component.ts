import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map, share } from 'rxjs/operators';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';
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

  allowCryptoCoins = ['usdc', 'l-btc', 'bsq'];

  constructor(
    private websocketService: WebsocketService,
    private bisqApiService: BisqApiService,
    private stateService: StateService,
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

          if (!this.stateService.env.OFFICIAL_BISQ_MARKETS) {
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
          newTickers.push(mappedTicker);
        }

        newTickers.sort((a, b) => (b.volume && b.volume.num_trades || 0) - (a.volume && a.volume.num_trades || 0));

        return newTickers;
      })
    );

    this.trades$ = combineLatest([
      this.bisqApiService.getMarketTrades$('all'),
      getMarkets,
    ])
    .pipe(
      map(([trades, markets]) => {
      return trades.map((trade => {
        trade._market = markets[trade.market];
        return trade;
      }));
    }));
  }

  trackByFn(index: number) {
    return index;
  }

}
