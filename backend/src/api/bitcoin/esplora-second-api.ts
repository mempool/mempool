import config from '../../config';
import axios from 'axios';
import http from 'http';
import { IEsploraApi } from './esplora-api.interface';
import logger from '../../logger';

class EsploraSecondApi {
  private requestConnection = axios.create({
    httpAgent: new http.Agent({ keepAlive: true })
  });

  private async $query<T>(method: 'get' | 'post', path: string, data?: any, responseType = 'json'): Promise<T> {
    let axiosConfig: any;
    let url: string;

    if (config.SECOND_ESPLORA.UNIX_SOCKET_PATH) {
      axiosConfig = { socketPath: config.SECOND_ESPLORA.UNIX_SOCKET_PATH, timeout: config.SECOND_ESPLORA.REQUEST_TIMEOUT, responseType };
      url = 'http://api' + path;
    } else {
      axiosConfig = { timeout: config.SECOND_ESPLORA.REQUEST_TIMEOUT, responseType };
      url = config.SECOND_ESPLORA.REST_API_URL + path;
    }

    try {
      const response = method === 'post'
        ? await this.requestConnection.post<T>(url, data, axiosConfig)
        : await this.requestConnection.get<T>(url, axiosConfig);
      return response.data;
    } catch (e: any) {
      logger.warn(`Second esplora request failed: ${url}`);
      logger.warn(e instanceof Error ? e.message : e);
      throw e;
    }
  }

  async $getRawTransaction(txId: string): Promise<IEsploraApi.Transaction> {
    return this.$query<IEsploraApi.Transaction>('get', '/tx/' + txId);
  }

  async $getTransactionHex(txId: string): Promise<string> {
    return this.$query<string>('get', '/tx/' + txId + '/hex');
  }

  async $getBlockHeightTip(): Promise<number> {
    return this.$query<number>('get', '/blocks/tip/height');
  }

  async $getBlockHashTip(): Promise<string> {
    return this.$query<string>('get', '/blocks/tip/hash');
  }

  async $getBlockHash(height: number): Promise<string> {
    return this.$query<string>('get', '/block-height/' + height);
  }

  async $getBlock(hash: string): Promise<IEsploraApi.Block> {
    return this.$query<IEsploraApi.Block>('get', '/block/' + hash);
  }

  async $getBlockHeader(hash: string): Promise<string> {
    return this.$query<string>('get', '/block/' + hash + '/header');
  }

  async $getTxIdsForBlock(hash: string): Promise<string[]> {
    return this.$query<string[]>('get', '/block/' + hash + '/txids');
  }

  async $getTxsForBlock(hash: string): Promise<IEsploraApi.Transaction[]> {
    return this.$query<IEsploraApi.Transaction[]>('get', '/internal/block/' + hash + '/txs');
  }

  async $getAddress(address: string): Promise<IEsploraApi.Address> {
    return this.$query<IEsploraApi.Address>('get', '/address/' + address);
  }

  async $getAddressUtxos(address: string): Promise<IEsploraApi.UTXO[]> {
    return this.$query<IEsploraApi.UTXO[]>('get', '/address/' + address + '/utxo');
  }

  async $getOutspend(txId: string, vout: number): Promise<IEsploraApi.Outspend> {
    return this.$query<IEsploraApi.Outspend>('get', '/tx/' + txId + '/outspend/' + vout);
  }

  async $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]> {
    return this.$query<IEsploraApi.Outspend[]>('get', '/tx/' + txId + '/outspends');
  }
}

export default new EsploraSecondApi();
