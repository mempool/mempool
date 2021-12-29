import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay, switchMap } from 'rxjs/operators';
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
      shareReplay(1),
    );
    this.getMiningPools$ = this.httpClient.get(apiBaseUrl + '/resources/pools.json').pipe(shareReplay(1));
  }
}
