import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { filter, map, mergeAll, switchMap, tap } from 'rxjs/operators';
import { WebsocketService } from 'src/app/services/websocket.service';
import { BisqApiService } from '../bisq-api.service';

@Component({
  selector: 'app-bisq-market',
  templateUrl: './bisq-market.component.html',
  styleUrls: ['./bisq-market.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqMarketComponent implements OnInit, OnDestroy {
  hlocData$: Observable<any>;
  currency$: Observable<any>;
  offers$: Observable<any>;
  radioGroupForm: FormGroup;
  defaultInterval = 'half_hour';

  constructor(
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private bisqApiService: BisqApiService,
    private formBuilder: FormBuilder,
  ) { }

  ngOnInit(): void {
    this.radioGroupForm = this.formBuilder.group({
      interval: [this.defaultInterval],
    });

    this.currency$ = this.bisqApiService.getMarkets$()
      .pipe(
        switchMap((markets) => combineLatest([of(markets), this.route.paramMap])),
        map(([markets, routeParams]) => {
          const pair = routeParams.get('pair');
          return {
            pair: pair.replace('_', '/').toUpperCase(),
            market: markets[pair],
          };
        })
      );

    this.offers$ = this.route.paramMap
      .pipe(
        map(routeParams => routeParams.get('pair')),
        switchMap((marketPair) => this.bisqApiService.getMarketOffers$(marketPair)),
        map((offers) => offers[Object.keys(offers)[0]])
      );

    this.hlocData$ = combineLatest([
      this.route.paramMap,
      merge(this.radioGroupForm.get('interval').valueChanges, of(this.defaultInterval)),
    ])
    .pipe(
      switchMap(([routeParams, interval]) => {
        const pair = routeParams.get('pair');
        return this.bisqApiService.getMarketsHloc$(pair, interval);
      }),
      map((hlocData) => {
        hlocData = hlocData.map((h) => {
          h.time = h.period_start;
          return h;
        });
        return {
          hloc: hlocData,
          volume: hlocData.map((h) => {
            return {
              time: h.time,
              value: h.volume_right,
              color: h.close > h.avg ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255,82,82, 0.8)',
            };
          })
        };
      }),
    );
  }

  ngOnDestroy(): void {
    this.websocketService.stopTrackingBisqMarket();
  }

}
