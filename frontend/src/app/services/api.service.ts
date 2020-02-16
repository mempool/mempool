import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MempoolStats, BlockTransaction } from '../interfaces/node-api.interface';
import { Observable } from 'rxjs';

const API_BASE_URL = '/api/v1';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private httpClient: HttpClient,
  ) { }

  list2HStatistics$(): Observable<MempoolStats[]> {
    return this.httpClient.get<MempoolStats[]>(API_BASE_URL + '/statistics/2h');
  }

  list24HStatistics$(): Observable<MempoolStats[]> {
    return this.httpClient.get<MempoolStats[]>(API_BASE_URL + '/statistics/24h');
  }

  list1WStatistics$(): Observable<MempoolStats[]> {
    return this.httpClient.get<MempoolStats[]>(API_BASE_URL + '/statistics/1w');
  }

  list1MStatistics$(): Observable<MempoolStats[]> {
    return this.httpClient.get<MempoolStats[]>(API_BASE_URL + '/statistics/1m');
  }

  list3MStatistics$(): Observable<MempoolStats[]> {
    return this.httpClient.get<MempoolStats[]>(API_BASE_URL + '/statistics/3m');
  }

  list6MStatistics$(): Observable<MempoolStats[]> {
    return this.httpClient.get<MempoolStats[]>(API_BASE_URL + '/statistics/6m');
  }
}
