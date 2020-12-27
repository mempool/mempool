import config from '../../config';
import * as bitcoin from '@mempool/bitcoin';
import { IBitcoinApi } from './bitcoin-api.interface';

class BitcoinBaseApi {
  bitcoindClient: any;

  constructor() {
    this.bitcoindClient = new bitcoin.Client({
      host: config.BITCOIND.HOST,
      port: config.BITCOIND.PORT,
      user: config.BITCOIND.USERNAME,
      pass: config.BITCOIND.PASSWORD,
      timeout: 60000,
    });
  }

  $getMempoolInfo(): Promise<IBitcoinApi.MempoolInfo> {
    return this.bitcoindClient.getMempoolInfo();
  }

  $getRawTransaction(txId: string): Promise<IBitcoinApi.Transaction> {
    return this.bitcoindClient.getRawTransaction(txId, true);
  }

  $getMempoolEntry(txid: string): Promise<IBitcoinApi.MempoolEntry> {
    return this.bitcoindClient.getMempoolEntry(txid);
  }

  $getRawMempoolVerbose(): Promise<IBitcoinApi.RawMempool> {
    return this.bitcoindClient.getRawMemPool(true);
  }

  $validateAddress(address: string): Promise<IBitcoinApi.AddressInformation> {
    return this.bitcoindClient.validateAddress(address);
  }

}

export default new BitcoinBaseApi();
