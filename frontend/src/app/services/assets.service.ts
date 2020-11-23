import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
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
    let baseApiUrl = '';
    if (!this.stateService.isBrowser) {
      baseApiUrl = this.stateService.env.STATIC_WEBSERVER_URL;
    }

    this.getAssetsJson$ = this.httpClient.get(baseApiUrl + '/resources/assets.json').pipe(shareReplay());
    this.getAssetsMinimalJson$ = this.httpClient.get(baseApiUrl + '/resources/assets.minimal.json').pipe(shareReplay());
    this.getMiningPools$ = this.httpClient.get(baseApiUrl + '/resources/pools.json').pipe(shareReplay());
  }
}
