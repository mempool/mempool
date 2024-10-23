import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay, switchMap } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { environment } from '@environments/environment';
import { AssetExtended } from '@interfaces/electrs.interface';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;

  getAssetsJson$: Observable<{ array: AssetExtended[]; objects: any}>;
  getAssetsMinimalJson$: Observable<any>;
  getWorldMapJson$: Observable<any>;

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
        map((rawAssets) => {
          const assets: AssetExtended[] = Object.values(rawAssets);
  
          if (this.stateService.network === 'liquid') {
            // @ts-ignore
            assets.push({
              name: 'Liquid Bitcoin',
              ticker: 'L-BTC',
              asset_id: this.nativeAssetId,
            });
          } else if (this.stateService.network === 'liquidtestnet') {
            // @ts-ignore
            assets.push({
              name: 'Test Liquid Bitcoin',
              ticker: 'tL-BTC',
              asset_id: this.nativeAssetId,
            });
          }
  
          return {
            objects: rawAssets,
            array: assets.sort((a: any, b: any) => a.name.localeCompare(b.name)),
          };
        }),
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

    this.getWorldMapJson$ = this.httpClient.get(apiBaseUrl + '/resources/worldmap.json').pipe(shareReplay());
  }
}
