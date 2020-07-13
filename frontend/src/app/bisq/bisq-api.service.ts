import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BisqTransaction, BisqBlock } from './bisq.interfaces';

const API_BASE_URL = '/api/v1';

@Injectable({
  providedIn: 'root'
})
export class BisqApiService {
  apiBaseUrl: string;

  constructor(
    private httpClient: HttpClient,
  ) { }

  getTransaction$(txId: string): Observable<BisqTransaction> {
    return this.httpClient.get<BisqTransaction>(API_BASE_URL + '/bisq/tx/' + txId);
  }

  listTransactions$(start: number, length: number): Observable<HttpResponse<BisqTransaction[]>> {
    return this.httpClient.get<BisqTransaction[]>(API_BASE_URL + `/bisq/txs/${start}/${length}`, { observe: 'response' });
  }

  getBlock$(hash: string): Observable<BisqBlock> {
    return this.httpClient.get<BisqBlock>(API_BASE_URL + '/bisq/block/' + hash);
  }

  listBlocks$(start: number, length: number): Observable<HttpResponse<BisqBlock[]>> {
    return this.httpClient.get<BisqBlock[]>(API_BASE_URL + `/bisq/blocks/${start}/${length}`, { observe: 'response' });
  }

  getAddress$(address: string): Observable<BisqTransaction[]> {
    return this.httpClient.get<BisqTransaction[]>(API_BASE_URL + '/bisq/address/' + address);
  }
}
