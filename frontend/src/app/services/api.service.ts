import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { Observable } from 'rxjs';
import { StateService } from './state.service';
import { env } from '../app.constants';
import { WebsocketResponse } from '../interfaces/websocket.interface';

const API_BASE_URL = '{network}/api/v1';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiBaseUrl: string;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    this.stateService.networkChanged$.subscribe((network) => {
      if (network === 'bisq' && !env.BISQ_SEPARATE_BACKEND) {
        network = '';
      }
      this.apiBaseUrl = API_BASE_URL.replace('{network}', network ? '/' + network : '');
      if (!stateService.isBrowser) {
        this.apiBaseUrl = 'http://localhost:8999' + this.apiBaseUrl;
      }
    });

    this.apiBaseUrl = API_BASE_URL.replace('{network}', '');
    if (!stateService.isBrowser) {
      this.apiBaseUrl = 'http://localhost:8999' + this.apiBaseUrl;
    }
  }

  list2HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + '/statistics/2h');
  }

  list24HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + '/statistics/24h');
  }

  list1WStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + '/statistics/1w');
  }

  list1MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + '/statistics/1m');
  }

  list3MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + '/statistics/3m');
  }

  list6MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + '/statistics/6m');
  }

  list1YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(this.apiBaseUrl + '/statistics/1y');
  }

  getTransactionTimes$(txIds: string[]): Observable<number[]> {
    let params = new HttpParams();
    txIds.forEach((txId: string) => {
      params = params.append('txId[]', txId);
    });
    return this.httpClient.get<number[]>(this.apiBaseUrl + '/transaction-times', { params });
  }

  requestDonation$(amount: number, orderId: string): Observable<any> {
    const params = {
      amount: amount,
      orderId: orderId,
    };
    return this.httpClient.post<any>(this.apiBaseUrl + '/donations', params);
  }

  getDonation$(): Observable<any[]> {
    return this.httpClient.get<any[]>(this.apiBaseUrl + '/donations');
  }

  getInitData$(): Observable<WebsocketResponse> {
    return this.httpClient.get<WebsocketResponse>(this.apiBaseUrl + '/init-data');
  }
}
