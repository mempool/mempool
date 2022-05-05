import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = '/lightning/api/v1';

@Injectable({
  providedIn: 'root'
})
export class LightningApiService {
  constructor(
    private httpClient: HttpClient,
  ) { }

  getNode$(publicKey: string): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/nodes/' + publicKey);
  }

  getChannel$(shortId: string): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/channels/' + shortId);
  }

  getChannelsByNodeId$(publicKey: string): Observable<any> {
    let params = new HttpParams()
      .set('public_key', publicKey)
    ;

    return this.httpClient.get<any>(API_BASE_URL + '/channels', { params });
  }

  getLatestStatistics$(): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/statistics/latest');
  }

  listNodeStats$(publicKey: string): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/nodes/' + publicKey + '/statistics');
  }

  listTopNodes$(): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/nodes/top');
  }
}
