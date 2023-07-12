import config from '../../config';
import axios, { AxiosRequestConfig } from 'axios';
import http from 'http';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import { IEsploraApi } from './esplora-api.interface';
import logger from '../../logger';

const axiosConnection = axios.create({
  httpAgent: new http.Agent({ keepAlive: true, })
});

class ElectrsApi implements AbstractBitcoinApi {
  private axiosConfigWithUnixSocket: AxiosRequestConfig = config.ESPLORA.UNIX_SOCKET_PATH ? {
    socketPath: config.ESPLORA.UNIX_SOCKET_PATH,
    timeout: 10000,
  } : {
    timeout: 10000,
  };
  private axiosConfigTcpSocketOnly: AxiosRequestConfig = {
    timeout: 10000,
  };

  unixSocketRetryTimeout;
  activeAxiosConfig;

  constructor() {
    this.activeAxiosConfig = this.axiosConfigWithUnixSocket;
  }

  fallbackToTcpSocket() {
    if (!this.unixSocketRetryTimeout) {
      logger.err(`Unable to connect to esplora unix socket. Falling back to tcp socket. Retrying unix socket in ${config.ESPLORA.RETRY_UNIX_SOCKET_AFTER / 1000} seconds`);
      // Retry the unix socket after a few seconds
      this.unixSocketRetryTimeout = setTimeout(() => {
        logger.info(`Retrying to use unix socket for esplora now (applied for the next query)`);
        this.activeAxiosConfig = this.axiosConfigWithUnixSocket;
        this.unixSocketRetryTimeout = undefined;
      }, config.ESPLORA.RETRY_UNIX_SOCKET_AFTER);
    }

    // Use the TCP socket (reach a different esplora instance through nginx)
    this.activeAxiosConfig = this.axiosConfigTcpSocketOnly;
  }

  $queryWrapper<T>(url, responseType = 'json'): Promise<T> {
    return axiosConnection.get<T>(url, { ...this.activeAxiosConfig, responseType: responseType })
      .then((response) => response.data)
      .catch((e) => {
        if (e?.code === 'ECONNREFUSED') {
          this.fallbackToTcpSocket();
          // Retry immediately
          return axiosConnection.get<T>(url, this.activeAxiosConfig)
            .then((response) => response.data)
            .catch((e) => {
              logger.warn(`Cannot query esplora through the unix socket nor the tcp socket. Exception ${e}`);
              throw e;
            });
        } else {
          throw e;
        }
      });
  }

  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]> {
    return this.$queryWrapper<IEsploraApi.Transaction['txid'][]>(config.ESPLORA.REST_API_URL + '/mempool/txids');
  }

  $getRawTransaction(txId: string): Promise<IEsploraApi.Transaction> {
    return this.$queryWrapper<IEsploraApi.Transaction>(config.ESPLORA.REST_API_URL + '/tx/' + txId);
  }

  $getTransactionHex(txId: string): Promise<string> {
    return this.$queryWrapper<string>(config.ESPLORA.REST_API_URL + '/tx/' + txId + '/hex');
  }

  $getBlockHeightTip(): Promise<number> {
    return this.$queryWrapper<number>(config.ESPLORA.REST_API_URL + '/blocks/tip/height');
  }

  $getBlockHashTip(): Promise<string> {
    return this.$queryWrapper<string>(config.ESPLORA.REST_API_URL + '/blocks/tip/hash');
  }

  $getTxIdsForBlock(hash: string): Promise<string[]> {
    return this.$queryWrapper<string[]>(config.ESPLORA.REST_API_URL + '/block/' + hash + '/txids');
  }

  $getBlockHash(height: number): Promise<string> {
    return this.$queryWrapper<string>(config.ESPLORA.REST_API_URL + '/block-height/' + height);
  }

  $getBlockHeader(hash: string): Promise<string> {
    return this.$queryWrapper<string>(config.ESPLORA.REST_API_URL + '/block/' + hash + '/header');
  }

  $getBlock(hash: string): Promise<IEsploraApi.Block> {
    return this.$queryWrapper<IEsploraApi.Block>(config.ESPLORA.REST_API_URL + '/block/' + hash);
  }

  $getRawBlock(hash: string): Promise<Buffer> {
    return this.$queryWrapper<any>(config.ESPLORA.REST_API_URL + '/block/' + hash + "/raw", 'arraybuffer')
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
    return this.$queryWrapper<IEsploraApi.Outspend>(config.ESPLORA.REST_API_URL + '/tx/' + txId + '/outspend/' + vout);
  }

  $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]> {
    return this.$queryWrapper<IEsploraApi.Outspend[]>(config.ESPLORA.REST_API_URL + '/tx/' + txId + '/outspends');
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
