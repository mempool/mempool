import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = '/lightning/api/v1';

@Injectable({
  providedIn: 'root'
})
export class LightningApiService {
  constructor(
    private httpClient: HttpClient,
  ) { }

  getLatestStatistics$(): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/statistics/latest');
  }

  listTopNodes$(): Observable<any> {
    return this.httpClient.get<any>(API_BASE_URL + '/nodes/top');
  }
}
