import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { webSocket } from 'rxjs/webSocket';
import { HttpClient, HttpParams } from '@angular/common/http';
import { IMempoolDefaultResponse, IMempoolStats, IBlockTransaction } from '../blockchain/interfaces';
import { Observable } from 'rxjs';


let WEB_SOCKET_URL = 'wss://mempool.space:8999';
let API_BASE_URL = 'https://mempool.space:8999/api/v1';

if (!environment.production) {
  WEB_SOCKET_URL = 'ws://localhost:8999';
  API_BASE_URL = '/api/v1';
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  constructor(
    private httpClient: HttpClient,
  ) { }

  websocketSubject = webSocket<IMempoolDefaultResponse>(WEB_SOCKET_URL);

  listTransactionsForBlock$(height: number): Observable<IBlockTransaction[]> {
    return this.httpClient.get<IBlockTransaction[]>(API_BASE_URL + '/transactions/height/' + height);
  }

  listTransactionsForProjectedBlock$(index: number): Observable<IBlockTransaction[]> {
    return this.httpClient.get<IBlockTransaction[]>(API_BASE_URL + '/transactions/projected/' + index);
  }

  listLiveStatistics$(lastId: number): Observable<IMempoolStats[]> {
    const params = new HttpParams()
      .set('lastId', lastId.toString());

    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/live', {
      params: params
    });
  }

  list2HStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/2h');
  }

  list24HStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/24h');
  }

  list1WStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/1w');
  }

  list1MStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/1m');
  }

  list3MStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/3m');
  }

  list6MStatistics$(): Observable<IMempoolStats[]> {
    return this.httpClient.get<IMempoolStats[]>(API_BASE_URL + '/statistics/6m');
  }

}
