import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { environment } from '@environments/environment';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { Asset, AssetExtended, AssetRegistryItem } from '@interfaces/electrs.interface';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;

  getAssetsJson$: Observable<{ array: AssetExtended[]; objects: any}>;
  getAssetsMinimalJson$: Observable<any>;
  getWorldMapJson$: Observable<any>;
  registryAvailable = true;
  private apiBaseUrl = '';

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
    private electrsApiService: ElectrsApiService,
  ) {
    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.stateService.networkChanged$.subscribe(() => {
      this.registryAvailable = true;
    });

    this.getAssetsJson$ = this.stateService.networkChanged$
      .pipe(
        switchMap(() => this.httpClient.get(`${this.apiBaseUrl}/resources/assets${this.stateService.network === 'liquidtestnet' ? '-testnet' : ''}.json`)),
        map((rawAssets) => {
          const assets: AssetExtended[] = Object.values(rawAssets);

          if (this.stateService.network === 'liquid') {
            // @ts-ignore
            assets.push({
              name: 'Liquid Bitcoin',
              ticker: 'LBTC',
              asset_id: this.nativeAssetId,
            });
          } else if (this.stateService.network === 'liquidtestnet') {
            // @ts-ignore
            assets.push({
              name: 'Test Liquid Bitcoin',
              ticker: 'tLBTC',
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
      switchMap(() => this.httpClient.get(`${this.apiBaseUrl}/resources/assets${this.stateService.network === 'liquidtestnet' ? '-testnet' : ''}.minimal.json`)),
      map((assetsMinimal) => {
        if (this.stateService.network === 'liquidtestnet') {
          // Hard coding the Liquid Testnet native asset
          assetsMinimal['144c654344aa716d6f3abcc1ca90e5641e4e2a7f633bc09fe3baf64585819a49'] = [null, 'tLBTC', 'Test Liquid Bitcoin', 8];
        }
        return assetsMinimal;
      }),
      shareReplay(1),
    );

    this.getWorldMapJson$ = this.httpClient.get(this.apiBaseUrl + '/resources/worldmap.json').pipe(shareReplay());
  }

  public enrichLiquidAsset$(asset: Asset): Observable<Asset> {
    if (asset.name || asset.ticker || asset.precision != null) {
      return of(asset);
    } else if (this.stateService.network === 'liquid' && asset.asset_id === environment.nativeAssetId) {
      return of({ ...asset, name: 'Liquid Bitcoin', ticker: 'LBTC', precision: 8 });
    } else if (this.stateService.network === 'liquidtestnet' && asset.asset_id === environment.nativeTestAssetId) {
      return of({ ...asset, name: 'Test Liquid Bitcoin', ticker: 'tLBTC', precision: 8 });
    } else {
      return this.getAssetsJson$.pipe(
        map((assets) => assets.objects[asset.asset_id] ? { ...asset, ...assets.objects[asset.asset_id] } : asset),
      );
    }
  }

  public getLiquidAssetsPage$(startIndex: number, limit: number): Observable<{ assets: AssetRegistryItem[]; total: number }> {
    return (this.registryAvailable ? this.electrsApiService.getLiquidAssetsRegistry$(startIndex, limit).pipe(
      map((response) => {
        const assets = response.body || [];
        const total = parseInt(response.headers.get('X-Total-Results') || `${assets.length}`, 10);
        if (!total && !assets.length) {
          this.registryAvailable = false;
          return null;
        }
        return { assets, total };
      }),
      catchError((error) => {
        if (![404, 501].includes(error.status)) {
          return throwError(() => error);
        }
        this.registryAvailable = false;
        return of(null);
      }),
    ) : of(null)).pipe(
      switchMap((registryPage) => registryPage ? of(registryPage) : this.getAssetsJson$.pipe(
        map((assets) => ({
          assets: assets.array.slice(startIndex, startIndex + limit),
          total: assets.array.length,
        })),
      )),
      map((page) => ({
        ...page,
        assets: page.assets.map((asset) => ({
          ...asset,
          entity: asset.entity || (asset.domain ? { domain: asset.domain } : undefined),
        })),
      })),
    );
  }
}
