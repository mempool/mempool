import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, filter, from, of, shareReplay, switchMap, take, tap } from 'rxjs';
import { Transaction, Address, Outspend, Recent, Asset, ScriptHash, AddressTxSummary, Utxo } from '../interfaces/electrs.interface';
import { StateService } from '@app/services/state.service';
import { BlockExtended } from '@interfaces/node-api.interface';
import { calcScriptHash$ } from '@app/bitcoin.utils';

@Injectable({
  providedIn: 'root'
})
export class ElectrsApiService {
  private apiBaseUrl: string; // base URL is protocol, hostname, and port
  private apiBasePath: string; // network path is /testnet, etc. or '' for mainnet

  private requestCache = new Map<string, { subject: BehaviorSubject<any>, expiry: number }>;

  constructor(
    private httpClient: HttpClient,
    private stateService: StateService,
  ) {
    this.apiBaseUrl = ''; // use relative URL by default
    if (!stateService.isBrowser) { // except when inside AU SSR process
      this.apiBaseUrl = this.stateService.env.NGINX_PROTOCOL + '://' + this.stateService.env.NGINX_HOSTNAME + ':' + this.stateService.env.NGINX_PORT;
    }
    this.apiBasePath = ''; // assume mainnet by default
    this.stateService.networkChanged$.subscribe((network) => {
      this.apiBasePath = network && network !== this.stateService.env.ROOT_NETWORK ? '/' + network : '';
    });
  }

  private generateCacheKey(functionName: string, params: any[]): string {
    return functionName + JSON.stringify(params);
  }

  // delete expired cache entries
  private cleanExpiredCache(): void {
    this.requestCache.forEach((value, key) => {
      if (value.expiry < Date.now()) {
        this.requestCache.delete(key);
      }
    });
  }

  cachedRequest<T, F extends (...args: any[]) => Observable<T>>(
    apiFunction: F,
    expireAfter: number, // in ms
    ...params: Parameters<F>
  ): Observable<T> {
    this.cleanExpiredCache();

    const cacheKey = this.generateCacheKey(apiFunction.name, params);
    if (!this.requestCache.has(cacheKey)) {
      const subject = new BehaviorSubject<T | null>(null);
      this.requestCache.set(cacheKey, { subject, expiry: Date.now() + expireAfter });

      apiFunction.bind(this)(...params).pipe(
        tap(data => {
          subject.next(data as T);
        }),
        catchError((error) => {
          subject.error(error);
          return of(null);
        }),
        shareReplay(1),
      ).subscribe();
    }

    return this.requestCache.get(cacheKey).subject.asObservable().pipe(filter(val => val !== null), take(1));
  }

  getBlock$(hash: string): Observable<BlockExtended> {
    return this.httpClient.get<BlockExtended>(this.apiBaseUrl + this.apiBasePath + '/api/block/' + hash);
  }

  listBlocks$(height?: number): Observable<BlockExtended[]> {
    return this.httpClient.get<BlockExtended[]>(this.apiBaseUrl + this.apiBasePath + '/api/blocks/' + (height || ''));
  }

  getTransaction$(txId: string): Observable<Transaction> {
    return this.httpClient.get<Transaction>(this.apiBaseUrl + this.apiBasePath + '/api/tx/' + txId);
  }

  getRecentTransaction$(): Observable<Recent[]> {
    return this.httpClient.get<Recent[]>(this.apiBaseUrl + this.apiBasePath + '/api/mempool/recent');
  }

  getOutspend$(hash: string, vout: number): Observable<Outspend> {
    return this.httpClient.get<Outspend>(this.apiBaseUrl + this.apiBasePath + '/api/tx/' + hash + '/outspend/' + vout);
  }

  getOutspends$(hash: string): Observable<Outspend[]> {
    return this.httpClient.get<Outspend[]>(this.apiBaseUrl + this.apiBasePath + '/api/tx/' + hash + '/outspends');
  }

  getOutspendsBatched$(txids: string[]): Observable<Outspend[][]> {
    let params = new HttpParams();
    params = params.append('txids', txids.join(','));
    return this.httpClient.get<Outspend[][]>(this.apiBaseUrl + this.apiBasePath + '/api/txs/outspends', { params });
  }

  getBlockTransactions$(hash: string, index: number = 0): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/block/' + hash + '/txs/' + index);
  }

  getBlockHashFromHeight$(height: number): Observable<string> {
    return this.httpClient.get(this.apiBaseUrl + this.apiBasePath + '/api/block-height/' + height, {responseType: 'text'});
  }

  getBlockTxId$(hash: string, index: number): Observable<string> {
    return this.httpClient.get(this.apiBaseUrl + this.apiBasePath + '/api/block/' + hash + '/txid/' + index, { responseType: 'text' });
  }

  getAddress$(address: string): Observable<Address> {
    return this.httpClient.get<Address>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address);
  }

  getPubKeyAddress$(pubkey: string): Observable<Address> {
    const scriptpubkey = (pubkey.length === 130 ? '41' : '21') + pubkey + 'ac';
    return this.getScriptHash$(scriptpubkey).pipe(
      switchMap((scripthash: ScriptHash) => {
        return of({
          ...scripthash,
          address: pubkey,
          is_pubkey: true,
        });
      })
    );
  }

  getScriptHash$(script: string): Observable<ScriptHash> {
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<ScriptHash>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash))
    );
  }

  getAddressTransactions$(address: string,  txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address + '/txs', { params });
  }

  getAddressesTransactions$(addresses: string[], txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.post<Transaction[]>(
      this.apiBaseUrl + this.apiBasePath + '/api/addresses/txs',
      addresses,
      { params }
    );
  }

  getAddressSummary$(address: string,  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.get<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address + '/txs/summary', { params });
  }

  getAddressesSummary$(addresses: string[],  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return this.httpClient.post<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/addresses/txs/summary', addresses, { params });
  }

  getScriptHashTransactions$(script: string,  txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash + '/txs', { params })),
    );
  }

  getScriptHashesTransactions$(scripts: string[],  txid?: string): Observable<Transaction[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(Promise.all(scripts.map(script => calcScriptHash$(script)))).pipe(
      switchMap(scriptHashes => this.httpClient.post<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthashes/txs', scriptHashes, { params })),
    );
  }

  getScriptHashSummary$(script: string,  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash + '/txs/summary', { params })),
    );
  }

  getAddressUtxos$(address: string): Observable<Utxo[]> {
    return this.httpClient.get<Utxo[]>(this.apiBaseUrl + this.apiBasePath + '/api/address/' + address + '/utxo');
  }

  getScriptHashUtxos$(script: string): Observable<Utxo[]> {
    return from(calcScriptHash$(script)).pipe(
      switchMap(scriptHash => this.httpClient.get<Utxo[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthash/' + scriptHash + '/utxo')),
    );
  }

  getScriptHashesSummary$(scripts: string[],  txid?: string): Observable<AddressTxSummary[]> {
    let params = new HttpParams();
    if (txid) {
      params = params.append('after_txid', txid);
    }
    return from(Promise.all(scripts.map(script => calcScriptHash$(script)))).pipe(
      switchMap(scriptHashes => this.httpClient.post<AddressTxSummary[]>(this.apiBaseUrl + this.apiBasePath + '/api/scripthashes/txs/summary', scriptHashes, { params })),
    );
  }

  getAsset$(assetId: string): Observable<Asset> {
    return this.httpClient.get<Asset>(this.apiBaseUrl + this.apiBasePath + '/api/asset/' + assetId);
  }

  getAssetTransactions$(assetId: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/asset/' + assetId + '/txs');
  }

  getAssetTransactionsFromHash$(assetId: string, txid: string): Observable<Transaction[]> {
    return this.httpClient.get<Transaction[]>(this.apiBaseUrl + this.apiBasePath + '/api/asset/' + assetId + '/txs/chain/' + txid);
  }

  getAddressesByPrefix$(prefix: string): Observable<string[]> {
    if (prefix.toLowerCase().indexOf('bc1') === 0) {
      prefix = prefix.toLowerCase();
    }
    return this.httpClient.get<string[]>(this.apiBaseUrl + this.apiBasePath + '/api/address-prefix/' + prefix);
  }
}
