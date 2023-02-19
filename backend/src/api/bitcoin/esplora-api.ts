import config from '../../config';
import axios, { AxiosRequestConfig } from 'axios';
import http from 'http';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';

const axiosConnection = axios.create({
  httpAgent: new http.Agent({ keepAlive: true })
});

class ElectrsApi implements AbstractBitcoinApi {
  axiosConfig: AxiosRequestConfig = {
    timeout: 10000,
  };

  constructor() { }

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return axiosConnection.get<IEsploraApi.Transaction['txid'][]>(config.ESPLORA.REST_API_URL + '/mempool/txids', this.axiosConfig)
      .then((response) => response.data);
  }

  $getRawTransaction(txId: string): Promise<IEsploraApi.Transaction> {
    return axiosConnection.get<IEsploraApi.Transaction>(config.ESPLORA.REST_API_URL + '/tx/' + txId, this.axiosConfig)
      .then((response) => response.data);
  }

  $getTransactionHex(txId: string): Promise<string> {
    return axiosConnection.get<string>(config.ESPLORA.REST_API_URL + '/tx/' + txId + '/hex', this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHeightTip(): Promise<number> {
    return axiosConnection.get<number>(config.ESPLORA.REST_API_URL + '/blocks/tip/height', this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHashTip(): Promise<string> {
    return axiosConnection.get<string>(config.ESPLORA.REST_API_URL + '/blocks/tip/hash', this.axiosConfig)
      .then((response) => response.data);
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return axiosConnection.get<string[]>(config.ESPLORA.REST_API_URL + '/block/' + hash + '/txids', this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHash(height: number): Promise<string> {
    return axiosConnection.get<string>(config.ESPLORA.REST_API_URL + '/block-height/' + height, this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlockHeader(hash: string): Promise<string> {
    return axiosConnection.get<string>(config.ESPLORA.REST_API_URL + '/block/' + hash + '/header', this.axiosConfig)
      .then((response) => response.data);
  }

  $getBlock(hash: string): Promise<IEsploraApi.Block> {
    return axiosConnection.get<IEsploraApi.Block>(config.ESPLORA.REST_API_URL + '/block/' + hash, this.axiosConfig)
      .then((response) => response.data);
  }

  $getRawBlock(hash: string): Promise<Buffer> {
    return axiosConnection.get<string>(config.ESPLORA.REST_API_URL + '/block/' + hash + "/raw", { ...this.axiosConfig, responseType: 'arraybuffer' })
      .then((response) => { return Buffer.from(response.data); });
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

  $getOutspend(txId: string, vout: number): Promise<IEsploraApi.Outspend> {
    return axiosConnection.get<IEsploraApi.Outspend>(config.ESPLORA.REST_API_URL + '/tx/' + txId + '/outspend/' + vout, this.axiosConfig)
      .then((response) => response.data);
  }

  $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]> {
    return axiosConnection.get<IEsploraApi.Outspend[]>(config.ESPLORA.REST_API_URL + '/tx/' + txId + '/outspends', this.axiosConfig)
      .then((response) => response.data);
  }

  async $getBatchedOutspends(txId: string[]): Promise<IEsploraApi.Outspend[][]> {
    const outspends: IEsploraApi.Outspend[][] = [];
    for (const tx of txId) {
      const outspend = await this.$getOutspends(tx);
      outspends.push(outspend);
    }
    return outspends;
  }
}

export default ElectrsApi;
