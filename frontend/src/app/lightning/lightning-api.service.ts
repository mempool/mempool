import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, filter, of, shareReplay, take, tap } from 'rxjs';
import { StateService } from '@app/services/state.service';
import { IChannel, INodesRanking, IOldestNodes, ITopNodesPerCapacity, ITopNodesPerChannels } from '@interfaces/node-api.interface';

@Injectable({
  providedIn: 'root'
})
export class LightningApiService {
  private apiBaseUrl: string; // base URL is protocol, hostname, and port
  private apiBasePath = ''; // network path is /testnet, etc. or '' for mainnet
  
  private requestCache = new Map<string, { subject: BehaviorSubject<any>, expiry: number }>;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.apiBasePath = ''; // assume mainnet by default
    this.stateService.networkChanged$.subscribe((network) => {
      this.apiBasePath = network && network !== this.stateService.env.ROOT_NETWORK ? '/' + network : '';
    });
  }

  private generateCacheKey(functionName: string, params: any[]): string {
    return functionName + JSON.stringify(params);
  }

  // delete expired cache entries
  private cleanExpiredCache(): void {
    this.requestCache.forEach((value, key) => {
      if (value.expiry < Date.now()) {
        this.requestCache.delete(key);
      }
    });
  }

  cachedRequest<T, F extends (...args: any[]) => Observable<T>>(
    apiFunction: F,
    expireAfter: number, // in ms
    ...params: Parameters<F>
  ): Observable<T> {
    this.cleanExpiredCache();

    const cacheKey = this.generateCacheKey(apiFunction.name, params);
    if (!this.requestCache.has(cacheKey)) {
      const subject = new BehaviorSubject<T | null>(null);
      this.requestCache.set(cacheKey, { subject, expiry: Date.now() + expireAfter });

      apiFunction.bind(this)(...params).pipe(
        tap(data => {
          subject.next(data as T);
        }),
        catchError((error) => {
          subject.error(error);
          return of(null);
        }),
        shareReplay(1),
      ).subscribe();
    }

    return this.requestCache.get(cacheKey).subject.asObservable().pipe(filter(val => val !== null), take(1));
  }

  getNode$(publicKey: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/' + publicKey);
  }

  getNodeGroup$(name: string): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/group/' + name);
  }

  getChannel$(shortId: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/channels/' + shortId);
  }

  getChannelsByNodeId$(publicKey: string, index: number = 0, status = 'open'): Observable<any> {
    const params = new HttpParams()
      .set('public_key', publicKey)
      .set('index', index)
      .set('status', status)
    ;

    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/channels', { params, observe: 'response' });
  }

  getLatestStatistics$(): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/statistics/latest');
  }

  listNodeStats$(publicKey: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/' + publicKey + '/statistics');
  }

  getNodeFeeHistogram$(publicKey: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/' + publicKey + '/fees/histogram');
  }

  getNodesRanking$(): Observable<INodesRanking> {
    return this.httpClient.get<INodesRanking>(this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/rankings');
  }

  listChannelStats$(publicKey: string): Observable<any> {
    return this.httpClient.get<any>(this.apiBaseUrl + this.apiBasePath + '/channels/' + publicKey + '/statistics');
  }

  listStatistics$(interval: string | undefined): Observable<any> {
    return this.httpClient.get<any>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/statistics' +
      (interval !== undefined ? `/${interval}` : ''), { observe: 'response' }
    );
  }

  getTopNodesByCapacity$(): Observable<ITopNodesPerCapacity[]> {
    return this.httpClient.get<ITopNodesPerCapacity[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/rankings/liquidity'
    );
  }

  getTopNodesByChannels$(): Observable<ITopNodesPerChannels[]> {
    return this.httpClient.get<ITopNodesPerChannels[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/rankings/connectivity'
    );
  }

  getPenaltyClosedChannels$(): Observable<IChannel[]> {
    return this.httpClient.get<IChannel[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/penalties'
    );
  }

  getOldestNodes$(): Observable<IOldestNodes[]> {
    return this.httpClient.get<IOldestNodes[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/v1/lightning/nodes/rankings/age'
    );
  }
}
