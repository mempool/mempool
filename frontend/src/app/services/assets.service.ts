import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { StateService } from './state.service';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  getAssetsJson$: Observable<any>;
  getAssetsMinimalJson$: Observable<any>;
  getMiningPools$: Observable<any>;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    let apiBaseUrl = '';
    if (!this.stateService.isBrowser) {
      apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }

    this.getAssetsJson$ = this.stateService.networkChanged$
      .pipe(
        switchMap(() => this.httpClient.get(`${apiBaseUrl}/resources/assets${this.stateService.network === 'liquidtestnet' ? '-testnet' : ''}.json`)),
        shareReplay(1),
      );
    this.getAssetsMinimalJson$ = this.stateService.networkChanged$
    .pipe(
      switchMap(() => this.httpClient.get(`${apiBaseUrl}/resources/assets${this.stateService.network === 'liquidtestnet' ? '-testnet' : ''}.minimal.json`)),
      map((assetsMinimal) => {
        if (this.stateService.network === 'liquidtestnet') {
          // Hard coding the Liquid Testnet native asset
          assetsMinimal['144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49'] = [null, "tL-BTC", "Test Liquid Bitcoin", 8];
        }
        return assetsMinimal;
      }),
      shareReplay(1),
    );
    this.getMiningPools$ = this.httpClient.get(apiBaseUrl + '/resources/pools.json').pipe(shareReplay(1));
  }
}
