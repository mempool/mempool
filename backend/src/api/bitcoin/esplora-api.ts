import config from '../../config';
import axios, { AxiosRequestConfig } from 'axios';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';

class ElectrsApi implements AbstractBitcoinApi {
  axiosConfig: AxiosRequestConfig = {
    timeout: 10000,
  };

  constructor() { }

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return axios.get<IEsploraApi.Transaction['txid'][]>(config.ESPLORA.REST_API_URL + '/mempool/txids', this.axiosConfig)
      .then((response) => response.data);
  }

  $getRawTransaction(txId: string): Promise<IEsploraApi.Transaction> {
    return axios.get<IEsploraApi.Transaction>(config.ESPLORA.REST_API_URL + '/tx/' + txId, this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHeightTip(): Promise<number> {
    return axios.get<number>(config.ESPLORA.REST_API_URL + '/blocks/tip/height', this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHashTip(): Promise<string> {
    return axios.get<string>(config.ESPLORA.REST_API_URL + '/blocks/tip/hash', this.axiosConfig)
      .then((response) => response.data);
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return axios.get<string[]>(config.ESPLORA.REST_API_URL + '/block/' + hash + '/txids', this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHash(height: number): Promise<string> {
    return axios.get<string>(config.ESPLORA.REST_API_URL + '/block-height/' + height, this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHeader(hash: string): Promise<string> {
    return axios.get<string>(config.ESPLORA.REST_API_URL + '/block/' + hash + '/header', this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlock(hash: string): Promise<IEsploraApi.Block> {
    return axios.get<IEsploraApi.Block>(config.ESPLORA.REST_API_URL + '/block/' + hash, this.axiosConfig)
      .then((response) => response.data);
  }

  $getAddress(address: string): Promise<IEsploraApi.Address> {
    throw new Error('Method getAddress not implemented.');
  }

  $getAddressTransactions(address: string, txId?: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getAddressTransactions not implemented.');
  }

  $getAddressPrefix(prefix: string): string[] {
    throw new Error('Method not implemented.');
  }

  $sendRawTransaction(rawTransaction: string): Promise<string> {
    throw new Error('Method not implemented.');
  }

  $getOutspends(): Promise<IEsploraApi.Outspend[]> {
    throw new Error('Method not implemented.');
  }
}

export default ElectrsApi;
