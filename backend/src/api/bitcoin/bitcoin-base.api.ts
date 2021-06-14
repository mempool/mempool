import config from '../../config';
import * as bitcoin from '@mempool/bitcoin';
import { IBitcoinApi } from './bitcoin-api.interface';

class BitcoinBaseApi {
  bitcoindClient: any;
  bitcoindClientMempoolInfo: any;

  constructor() {
    this.bitcoindClient = new bitcoin.Client({
      host: config.CORE_RPC.HOST,
      port: config.CORE_RPC.PORT,
      user: config.CORE_RPC.USERNAME,
      pass: config.CORE_RPC.PASSWORD,
      timeout: 60000,
    });

    if (config.CORE_RPC_MINFEE.ENABLED) {
      this.bitcoindClientMempoolInfo = new bitcoin.Client({
        host: config.CORE_RPC_MINFEE.HOST,
        port: config.CORE_RPC_MINFEE.PORT,
        user: config.CORE_RPC_MINFEE.USERNAME,
        pass: config.CORE_RPC_MINFEE.PASSWORD,
        timeout: 60000,
      });
    }
  }

  $getMempoolInfo(): Promise<IBitcoinApi.MempoolInfo> {
    if (config.CORE_RPC_MINFEE.ENABLED) {
      return Promise.all([this.bitcoindClient.getMempoolInfo(), this.bitcoindClientMempoolInfo.getMempoolInfo()]).then(
        ([mempoolInfo, secondMempoolInfo]) => {
          mempoolInfo.maxmempool = secondMempoolInfo.maxmempool;
          mempoolInfo.mempoolminfee = secondMempoolInfo.mempoolminfee;
          mempoolInfo.minrelaytxfee = secondMempoolInfo.minrelaytxfee;
          return mempoolInfo;
        }
      );
    }
    return this.bitcoindClient.getMempoolInfo();
  }
}

export default new BitcoinBaseApi();
