import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { StateService } from './state.service';

@Injectable({
  providedIn: 'root',
})
export class AssetsService {
  getAssetsJson$: Observable<any>;
  getAssetsMinimalJson$: Observable<any>;
  getMiningPools$: Observable<any>;

  constructor(private httpClient: HttpClient, private stateService: StateService) {
    let apiBaseUrl = '';
    if (!this.stateService.isBrowser) {
      apiBaseUrl =
        this.stateService.env.NGINX_PROTOCOL +
        '://' +
        this.stateService.env.NGINX_HOSTNAME +
        ':' +
        this.stateService.env.NGINX_PORT;
    }

    this.getAssetsJson$ = this.httpClient.get(apiBaseUrl + '/resources/assets.json').pipe(shareReplay());
    this.getAssetsMinimalJson$ = this.httpClient.get(apiBaseUrl + '/resources/assets.minimal.json').pipe(shareReplay());
    this.getMiningPools$ = this.httpClient.get(apiBaseUrl + '/resources/pools.json').pipe(shareReplay());
  }
}
