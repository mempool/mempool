import config from '../../config';
import * as bitcoin from '@mempool/bitcoin';
import { IBitcoinApi } from './bitcoin-api.interface';

class BitcoinBaseApi {
  bitcoindClient: any;

  constructor() {
    this.bitcoindClient = new bitcoin.Client({
      host: config.CORE_RPC.HOST,
      port: config.CORE_RPC.PORT,
      user: config.CORE_RPC.USERNAME,
      pass: config.CORE_RPC.PASSWORD,
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

}

export default new BitcoinBaseApi();
