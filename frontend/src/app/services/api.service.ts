import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CpfpInfo, OptimizedMempoolStats, DifficultyAdjustment, AddressInformation, LiquidPegs, ITranslators, PoolsStats } from '../interfaces/node-api.interface';
import { Observable } from 'rxjs';
import { StateService } from './state.service';
import { WebsocketResponse } from '../interfaces/websocket.interface';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiBaseUrl: string; // base URL is protocol, hostname, and port
  private apiBasePath: string; // network path is /testnet, etc. or '' for mainnet

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
      if (network === 'bisq' && !this.stateService.env.BISQ_SEPARATE_BACKEND) {
        network = '';
      }
      this.apiBasePath = network ? '/' + network : '';
    });
  }

  list2HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/2h');
  }

  list24HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/24h');
  }

  list1WStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1w');
  }

  list1MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1m');
  }

  list3MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/3m');
  }

  list6MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/6m');
  }

  list1YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/1y');
  }

  list2YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/2y');
  }

  list3YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/statistics/3y');
  }

  getTransactionTimes$(txIds: string[]): Observable<number[]> {
    let params = new HttpParams();
    txIds.forEach((txId: string) => {
      params = params.append('txId[]', txId);
    });
    return this.httpClient.get<number[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/transaction-times', { params });
  }

  requestDonation$(amount: number, orderId: string): Observable<any> {
    const params = {
      amount: amount,
      orderId: orderId,
    };
    return this.httpClient.post<any>(this.apiBaseUrl + this.apiBasePath + '/api/v1/donations', params);
  }

  getDonation$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/donations');
  }

  getTranslators$(): Observable<ITranslators> {
    return this.httpClient.get<ITranslators>(this.apiBaseUrl + this.apiBasePath + '/api/v1/translators');
  }

  getContributor$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/contributors');
  }

  checkDonation$(orderId: string): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/donations/check?order_id=' + orderId);
  }

  getInitData$(): Observable<WebsocketResponse> {
    return this.httpClient.get<WebsocketResponse>(this.apiBaseUrl + this.apiBasePath + '/api/v1/init-data');
  }

  getCpfpinfo$(txid: string): Observable<CpfpInfo> {
    return this.httpClient.get<CpfpInfo>(this.apiBaseUrl + this.apiBasePath + '/api/v1/cpfp/' + txid);
  }

  getDifficultyAdjustment$(): Observable<DifficultyAdjustment> {
    return this.httpClient.get<DifficultyAdjustment>(this.apiBaseUrl + this.apiBasePath + '/api/v1/difficulty-adjustment');
  }

  validateAddress$(address: string): Observable<AddressInformation> {
    return this.httpClient.get<AddressInformation>(this.apiBaseUrl + this.apiBasePath + '/api/v1/validate-address/' + address);
  }

  listLiquidPegsMonth$(): Observable<LiquidPegs[]> {
    return this.httpClient.get<LiquidPegs[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/liquid/pegs/month');
  }

  listFeaturedAssets$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/assets/featured');
  }

  getAssetGroup$(id: string): Observable<any> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + this.apiBasePath + '/api/v1/assets/group/' + id);
  }

  postTransaction$(hexPayload: string): Observable<any> {
    return this.httpClient.post<any>(this.apiBaseUrl + this.apiBasePath + '/api/tx', hexPayload, { responseType: 'text' as 'json'});
  }

  listPools$(interval: string | null) : Observable<PoolsStats> {
    return this.httpClient.get<PoolsStats>(this.apiBaseUrl + this.apiBasePath + `/api/v1/mining/pools/${interval}`);
  }
}
