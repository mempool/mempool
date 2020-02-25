import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { OptimizedMempoolStats } from '../interfaces/node-api.interface';
import { Observable } from 'rxjs';

const API_BASE_URL = '/api/v1';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private httpClient: HttpClient,
  ) { }

  list2HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(API_BASE_URL + '/statistics/2h');
  }

  list24HStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(API_BASE_URL + '/statistics/24h');
  }

  list1WStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(API_BASE_URL + '/statistics/1w');
  }

  list1MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(API_BASE_URL + '/statistics/1m');
  }

  list3MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(API_BASE_URL + '/statistics/3m');
  }

  list6MStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(API_BASE_URL + '/statistics/6m');
  }

  list1YStatistics$(): Observable<OptimizedMempoolStats[]> {
    return this.httpClient.get<OptimizedMempoolStats[]>(API_BASE_URL + '/statistics/1y');
  }
}
