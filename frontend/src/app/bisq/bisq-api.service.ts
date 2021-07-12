import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  BisqTransaction,
  BisqBlock,
  BisqStats,
  MarketVolume,
  Trade,
  Markets,
  Tickers,
  Offers,
  Currencies,
  HighLowOpenClose,
  SummarizedInterval,
} from './bisq.interfaces';

const API_BASE_URL = '/bisq/api';

@Injectable({
  providedIn: 'root',
})
export class BisqApiService {
  apiBaseUrl: string;

  constructor(private httpClient: HttpClient) {}

  getStats$(): Observable<BisqStats> {
    return this.httpClient.get<BisqStats>(API_BASE_URL + '/stats');
  }

  getTransaction$(txId: string): Observable<BisqTransaction> {
    return this.httpClient.get<BisqTransaction>(API_BASE_URL + '/tx/' + txId);
  }

  listTransactions$(start: number, length: number, types: string[]): Observable<HttpResponse<BisqTransaction[]>> {
    let params = new HttpParams();
    types.forEach((t: string) => {
      params = params.append('types[]', t);
    });
    return this.httpClient.get<BisqTransaction[]>(API_BASE_URL + `/txs/${start}/${length}`, {
      params,
      observe: 'response',
    });
  }

  getBlock$(hash: string): Observable<BisqBlock> {
    return this.httpClient.get<BisqBlock>(API_BASE_URL + '/block/' + hash);
  }

  listBlocks$(start: number, length: number): Observable<HttpResponse<BisqBlock[]>> {
    return this.httpClient.get<BisqBlock[]>(API_BASE_URL + `/blocks/${start}/${length}`, { observe: 'response' });
  }

  getAddress$(address: string): Observable<BisqTransaction[]> {
    return this.httpClient.get<BisqTransaction[]>(API_BASE_URL + '/address/' + address);
  }

  getMarkets$(): Observable<Markets> {
    return this.httpClient.get<Markets>(API_BASE_URL + '/markets/markets');
  }

  getMarketsTicker$(): Observable<Tickers> {
    return this.httpClient.get<Tickers>(API_BASE_URL + '/markets/ticker');
  }

  getMarketsCurrencies$(): Observable<Currencies> {
    return this.httpClient.get<Currencies>(API_BASE_URL + '/markets/currencies');
  }

  getMarketsHloc$(
    market: string,
    interval: 'minute' | 'half_hour' | 'hour' | 'half_day' | 'day' | 'week' | 'month' | 'year' | 'auto'
  ): Observable<SummarizedInterval[]> {
    return this.httpClient.get<SummarizedInterval[]>(
      API_BASE_URL + '/markets/hloc?market=' + market + '&interval=' + interval
    );
  }

  getMarketOffers$(market: string): Observable<Offers> {
    return this.httpClient.get<Offers>(API_BASE_URL + '/markets/offers?market=' + market);
  }

  getMarketTrades$(market: string): Observable<Trade[]> {
    return this.httpClient.get<Trade[]>(API_BASE_URL + '/markets/trades?market=' + market);
  }

  getMarketVolumesByTime$(period: string): Observable<HighLowOpenClose[]> {
    return this.httpClient.get<HighLowOpenClose[]>(API_BASE_URL + '/markets/volumes/' + period);
  }

  getAllVolumesDay$(): Observable<MarketVolume[]> {
    return this.httpClient.get<MarketVolume[]>(API_BASE_URL + '/markets/volumes?interval=week');
  }
}
