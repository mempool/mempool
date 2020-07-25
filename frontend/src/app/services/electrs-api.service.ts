import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Block, Transaction, Address, Outspend, Recent, Asset } from '../interfaces/electrs.interface';
import { StateService } from './state.service';
import { env } from '../app.constants';

const API_BASE_URL = '{network}/api';

@Injectable({
  providedIn: 'root'
})
export class ElectrsApiService {
  apiBaseUrl: string;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    this.apiBaseUrl = API_BASE_URL.replace('{network}', '');
    this.stateService.networkChanged$.subscribe((network) => {
      if (network === 'bisq') {
        network = '';
      }
      this.apiBaseUrl = API_BASE_URL.replace('{network}', network ? '/' + network : '');
    });
  }

  getBlock$(hash: string): Observable<Block> {
    return this.httpClient.get<Block>(this.apiBaseUrl + '/block/' + hash);
  }

  listBlocks$(height?: number): Observable<Block[]> {
    return this.httpClient.get<Block[]>(this.apiBaseUrl + '/blocks/' + (height || ''));
  }

  getTransaction$(txId: string): Observable<Transaction> {
    return this.httpClient.get<Transaction>(this.apiBaseUrl + '/tx/' + txId);
  }

  getRecentTransaction$(): Observable<Recent[]> {
    return this.httpClient.get<Recent[]>(this.apiBaseUrl + '/mempool/recent');
  }

  getOutspend$(hash: string, vout: number): Observable<Outspend> {
    return this.httpClient.get<Outspend>(this.apiBaseUrl + '/tx/' + hash + '/outspend/' + vout);
  }

  getOutspends$(hash: string): Observable<Outspend[]> {
    return this.httpClient.get<Outspend[]>(this.apiBaseUrl + '/tx/' + hash + '/outspends');
  }

  getBlockTransactions$(hash: string, index: number = 0): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + '/block/' + hash + '/txs/' + index);
  }

  getBlockHashFromHeight$(height: number): Observable<string> {
    return this.httpClient.get(this.apiBaseUrl + '/block-height/' + height, {responseType: 'text'});
  }

  getAddress$(address: string): Observable<Address> {
    return this.httpClient.get<Address>(this.apiBaseUrl + '/address/' + address);
  }

  getAddressTransactions$(address: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + '/address/' + address + '/txs');
  }

  getAddressTransactionsFromHash$(address: string, txid: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + '/address/' + address + '/txs/chain/' + txid);
  }

  getAsset$(assetId: string): Observable<Asset> {
    return this.httpClient.get<Asset>(this.apiBaseUrl + '/asset/' + assetId);
  }

  getAssetTransactions$(assetId: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + '/asset/' + assetId + '/txs');
  }

  getAssetTransactionsFromHash$(assetId: string, txid: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + '/asset/' + assetId + '/txs/chain/' + txid);
  }

  getAddressesByPrefix$(prefix: string): Observable<string[]> {
    return this.httpClient.get<string[]>(this.apiBaseUrl + '/address-prefix/' + prefix);
  }
}
