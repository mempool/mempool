import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';
import { StateService } from '@app/services/state.service';
import { environment } from '@environments/environment';
import { ElectrsApiService } from '@app/services/electrs-api.service';
import { Asset, AssetExtended, AssetRegistryItem, Transaction } from '@interfaces/electrs.interface';

@Injectable({
  providedIn: 'root'
})
export class AssetsService {
  getAssetsJson$: Observable<{ array: AssetExtended[]; objects: any}>;
  getAssetsMinimalJson$: Observable<any>;
  getWorldMapJson$: Observable<any>;
  registryAvailable = true;
  private apiBaseUrl = '';
  private nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
  private assetsMinimalCache: any = {
    [this.nativeAssetId]: this.stateService.network === 'liquid' ? [null, 'LBTC', 'Liquid Bitcoin', 8] : [null, 'tLBTC', 'Test Liquid Bitcoin', 8],
  };

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
      this.nativeAssetId = this.stateService.network === 'liquidtestnet' ? environment.nativeTestAssetId : environment.nativeAssetId;
      this.assetsMinimalCache = {
        [this.nativeAssetId]: this.stateService.network === 'liquid' ? [null, 'LBTC', 'Liquid Bitcoin', 8] : [null, 'tLBTC', 'Test Liquid Bitcoin', 8],
      };
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

  public async getLiquidAssetData(assetId: string): Promise<Partial<Asset>> {
    if (this.stateService.network === 'liquid' && assetId === environment.nativeAssetId) {
      return { asset_id: assetId, name: 'Liquid Bitcoin', ticker: 'LBTC', precision: 8 };
    } else if (this.stateService.network === 'liquidtestnet' && assetId === environment.nativeTestAssetId) {
      return { asset_id: assetId, name: 'Test Liquid Bitcoin', ticker: 'tLBTC', precision: 8 };
    } else if (this.registryAvailable) {
      try {
        const apiAsset = await firstValueFrom(this.electrsApiService.getAsset$(assetId));
        if (apiAsset.name || apiAsset.ticker || apiAsset.precision != null) {
          return apiAsset;
        }
      } catch (error: any) {
        if (![404, 501].includes(error?.status)) {
          throw error;
        }
      }
    }

    const assets = await firstValueFrom(this.getAssetsJson$);
    return assets.objects[assetId] || {};
  }

  public async getLiquidAssetMinimalData(assetId: string): Promise<any[]> {
    if (this.assetsMinimalCache[assetId]) {
      return this.assetsMinimalCache[assetId];
    }

    const asset: any = await this.getLiquidAssetData(assetId);
    if (asset.name || asset.ticker || asset.precision != null) {
      this.assetsMinimalCache[assetId] = [asset.entity?.domain || asset.domain || null, asset.ticker, asset.name, asset.precision || 0];
      return this.assetsMinimalCache[assetId];
    }
    return null;
  }

  public async getLiquidAssetsMinimalData(transactions: Transaction[]): Promise<any> {
    const assetIds = new Set<string>();
    for (const tx of transactions || []) {
      for (const vin of tx.vin || []) {
        if (vin.prevout?.asset && vin.prevout.asset !== this.nativeAssetId) {
          assetIds.add(vin.prevout.asset);
        }
      }
      for (const vout of tx.vout || []) {
        if (vout.asset && vout.asset !== this.nativeAssetId) {
          assetIds.add(vout.asset);
        }
      }
    }

    const missingAssetIds = Array.from(assetIds).filter((assetId) => !this.assetsMinimalCache[assetId]);
    await Promise.all(missingAssetIds.map((assetId) => this.getLiquidAssetMinimalData(assetId)));

    return this.assetsMinimalCache;
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

  public searchLiquidAssets$(searchText: string, limit: number): Observable<AssetRegistryItem[]> {
    const lowerSearchText = searchText.toLowerCase();
    return (this.registryAvailable ? this.electrsApiService.getLiquidAssetsRegistrySearch$(searchText).pipe(
      catchError((error) => {
        if (![404, 501].includes(error.status)) {
          return throwError(() => error);
        }
        this.registryAvailable = false;
        return of(null);
      }),
    ) : of(null)).pipe(
      switchMap((registryAssets) => registryAssets ? of(registryAssets) : this.getAssetsMinimalJson$.pipe(
        map((assets) => Object.entries(assets).map(([assetId, assetData]: [string, any[]]) => ({
          asset_id: assetId,
          entity: assetData[0] ? { domain: assetData[0] } : undefined,
          ticker: assetData[1] || '',
          name: assetData[2] || '',
        })).filter((asset) => asset.asset_id.indexOf(lowerSearchText) > -1
          || asset.name.toLowerCase().indexOf(lowerSearchText) > -1
          || (asset.ticker || '').toLowerCase().indexOf(lowerSearchText) > -1
          || (asset.entity && asset.entity.domain || '').toLowerCase().indexOf(lowerSearchText) > -1)),
      )),
      switchMap((assets) => {
        if (!/^[0-9a-f]{64}$/i.test(searchText) || assets.some((asset) => asset.asset_id.toLowerCase() === lowerSearchText)) {
          return of(assets);
        }
        return this.electrsApiService.getAsset$(searchText).pipe(
          map((asset) => asset.name || asset.ticker || asset.precision != null ? [{
            asset_id: asset.asset_id,
            entity: asset.entity,
            ticker: asset.ticker || '',
            name: asset.name || asset.asset_id,
          }, ...assets] : assets),
          catchError(() => of(assets)),
        );
      }),
      map((assets) => assets.map((asset) => ({
        ...asset,
        entity: asset.entity || (asset.domain ? { domain: asset.domain } : undefined),
      })).slice(0, limit)),
    );
  }
}
