import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Block, Transaction, Address, Outspend, Recent } from '../interfaces/electrs.interface';

const API_BASE_URL = 'https://www.blockstream.info/testnet/api';

@Injectable({
  providedIn: 'root'
})
export class ElectrsApiService {
  constructor(
    private httpClient: HttpClient,
  ) {
  }

  getBlock$(hash: string): Observable<Block> {
    return this.httpClient.get<Block>(API_BASE_URL + '/block/' + hash);
  }

  listBlocks$(height?: number): Observable<Block[]> {
    return this.httpClient.get<Block[]>(API_BASE_URL + '/blocks/' + (height || ''));
  }

  getTransaction$(txId: string): Observable<Transaction> {
    return this.httpClient.get<Transaction>(API_BASE_URL + '/tx/' + txId);
  }

  getRecentTransaction$(): Observable<Recent[]> {
    return this.httpClient.get<Recent[]>(API_BASE_URL + '/mempool/recent');
  }

  getOutspend$(hash: string, vout: number): Observable<Outspend> {
    return this.httpClient.get<Outspend>(API_BASE_URL + '/tx/' + hash + '/outspend/' + vout);
  }

  getOutspends$(hash: string): Observable<Outspend[]> {
    return this.httpClient.get<Outspend[]>(API_BASE_URL + '/tx/' + hash + '/outspends');
  }

  getBlockTransactions$(hash: string, index: number = 0): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(API_BASE_URL + '/block/' + hash + '/txs/' + index);
  }

  getAddress$(address: string): Observable<Address> {
    return this.httpClient.get<Address>(API_BASE_URL + '/address/' + address);
  }

  getAddressTransactions$(address: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(API_BASE_URL + '/address/' + address + '/txs');
  }

  getAddressTransactionsFromHash$(address: string, txid: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(API_BASE_URL + '/address/' + address + '/txs/chain/' + txid);
  }

}
