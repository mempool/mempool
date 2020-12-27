import config from '../../config';
import axios from 'axios';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';

class ElectrsApi implements AbstractBitcoinApi {

  constructor() { }

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return axios.get<IEsploraApi.Transaction['txid'][]>(config.ELECTRS.REST_API_URL + '/mempool/txids')
      .then((response) => response.data);
  }

  $getRawTransaction(txId: string): Promise<IEsploraApi.Transaction> {
    return axios.get<IEsploraApi.Transaction>(config.ELECTRS.REST_API_URL + '/tx/' + txId)
      .then((response) => response.data);
  }

  $getBlockHeightTip(): Promise<number> {
    return axios.get<number>(config.ELECTRS.REST_API_URL + '/blocks/tip/height')
      .then((response) => response.data);
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return axios.get<string[]>(config.ELECTRS.REST_API_URL + '/block/' + hash + '/txids')
      .then((response) => response.data);
  }

  $getBlockHash(height: number): Promise<string> {
    return axios.get<string>(config.ELECTRS.REST_API_URL + '/block-height/' + height)
      .then((response) => response.data);
  }

  $getBlock(hash: string): Promise<IEsploraApi.Block> {
    return axios.get<IEsploraApi.Block>(config.ELECTRS.REST_API_URL + '/block/' + hash)
      .then((response) => response.data);
  }

  $getAddress(address: string): Promise<IEsploraApi.Address> {
    throw new Error('Method getAddress not implemented.');
  }

  $getAddressTransactions(address: string, txId?: string): Promise<IEsploraApi.Transaction[]> {
    throw new Error('Method getAddressTransactions not implemented.');
  }

  $getRawTransactionBitcoind(txId: string): Promise<IEsploraApi.Transaction> {
    return axios.get<IEsploraApi.Transaction>(config.ELECTRS.REST_API_URL + '/tx/' + txId)
      .then((response) => response.data);
  }

}

export default ElectrsApi;
