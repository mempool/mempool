import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { SeoService } from '../../services/seo.service';
import { WebsocketService } from '../../services/websocket.service';
import { BisqApiService } from '../bisq-api.service';
import { OffersMarket, Trade } from '../bisq.interfaces';

@Component({
  selector: 'app-bisq-market',
  templateUrl: './bisq-market.component.html',
  styleUrls: ['./bisq-market.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BisqMarketComponent implements OnInit, OnDestroy {
  hlocData$: Observable<any>;
  currency$: Observable<any>;
  offers$: Observable<OffersMarket>;
  trades$: Observable<Trade[]>;
  radioGroupForm: FormGroup;
  defaultInterval = 'day';

  isLoadingGraph = false;

  constructor(
    private websocketService: WebsocketService,
    private route: ActivatedRoute,
    private bisqApiService: BisqApiService,
    private formBuilder: FormBuilder,
    private seoService: SeoService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.radioGroupForm = this.formBuilder.group({
      interval: [this.defaultInterval],
    });

    if (['half_hour', 'hour', 'half_day', 'day', 'week', 'month', 'year', 'auto'].indexOf(this.route.snapshot.fragment) > -1) {
      this.radioGroupForm.controls.interval.setValue(this.route.snapshot.fragment, { emitEvent: false });
    }

    this.currency$ = this.bisqApiService.getMarkets$()
      .pipe(
        switchMap((markets) => combineLatest([of(markets), this.route.paramMap])),
        map(([markets, routeParams]) => {
          const pair = routeParams.get('pair');
          const pairUpperCase = pair.replace('_', '/').toUpperCase();
          this.seoService.setTitle(`Bisq market: ${pairUpperCase}`);

          return {
            pair: pairUpperCase,
            market: markets[pair],
          };
        })
      );

    this.trades$ = this.route.paramMap
      .pipe(
        map(routeParams => routeParams.get('pair')),
        switchMap((marketPair) => this.bisqApiService.getMarketTrades$(marketPair)),
      );

    this.offers$ = this.route.paramMap
      .pipe(
        map(routeParams => routeParams.get('pair')),
        switchMap((marketPair) => this.bisqApiService.getMarketOffers$(marketPair)),
        map((offers) => offers[Object.keys(offers)[0]])
      );

    this.hlocData$ = combineLatest([
      this.route.paramMap,
      merge(this.radioGroupForm.get('interval').valueChanges, of(this.radioGroupForm.get('interval').value)),
    ])
    .pipe(
      switchMap(([routeParams, interval]) => {
        this.isLoadingGraph = true;
        const pair = routeParams.get('pair');
        return this.bisqApiService.getMarketsHloc$(pair, interval);
      }),
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

          const period = this.getUnixTimestampFromInterval(this.radioGroupForm.get('interval').value); // temp
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

        return {
          hloc: hlocData,
          volume: hlocVolume,
        };
      }),
    );
  }

  setFragment(fragment: string) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParamsHandling: 'merge',
      fragment: fragment
    });
  }

  ngOnDestroy(): void {
    this.websocketService.stopTrackingBisqMarket();
  }

  getUnixTimestampFromInterval(interval: string): number {
    switch (interval) {
      case 'minute': return 60;
      case 'half_hour': return 1800;
      case 'hour': return 3600;
      case 'half_day': return 43200;
      case 'day': return 86400;
      case 'week': return 604800;
      case 'month': return 2592000;
      case 'year': return 31579200;
    }
  }

}
