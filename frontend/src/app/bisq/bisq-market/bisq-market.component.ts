import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { filter, map, mergeAll, switchMap, tap } from 'rxjs/operators';
import { BisqApiService } from '../bisq-api.service';

@Component({
  selector: 'app-bisq-market',
  templateUrl: './bisq-market.component.html',
  styleUrls: ['./bisq-market.component.scss']
})
export class BisqMarketComponent implements OnInit {
  hlocData$: Observable<any>;
  currency$: Observable<any>;
  radioGroupForm: FormGroup;
  defaultInterval = 'half_hour';

  constructor(
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
          console.log(markets);
          return {
            pair: pair.replace('_', '/').toUpperCase(),
            market: markets[pair],
          };
        })
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
      map((hloc) => {
        return hloc.map((h) => {
          h.time = h.period_start;
          return h;
        });
      }),
      tap((data) => {
        console.log(data);
      }),
    );
  }

}
