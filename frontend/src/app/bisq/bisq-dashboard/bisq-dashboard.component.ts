import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StateService } from 'src/app/services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { BisqApiService } from '../bisq-api.service';

@Component({
  selector: 'app-bisq-dashboard',
  templateUrl: './bisq-dashboard.component.html',
  styleUrls: ['./bisq-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqDashboardComponent implements OnInit {
  tickers$: Observable<any>;
  allowCryptoCoins = ['usdc', 'l-btc', 'bsq'];

  constructor(
    private websocketService: WebsocketService,
    private bisqApiService: BisqApiService,
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);

    this.tickers$ = combineLatest([
      this.bisqApiService.getMarketsTicker$(),
      this.bisqApiService.getMarkets$(),
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

          tickers[t].pair_url = t;
          tickers[t].pair = t.replace('_', '/').toUpperCase();
          tickers[t].market = markets[t];
          tickers[t].volume = volumes[t];
          newTickers.push(tickers[t]);
        }

        newTickers.sort((a, b) => (b.volume && b.volume.num_trades || 0) - (a.volume && a.volume.num_trades || 0));

        return newTickers;
      })
    );
  }

  trackByFn(index: number) {
    return index;
  }

}
