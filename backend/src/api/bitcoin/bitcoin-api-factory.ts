import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import EsploraApi from './esplora-api';
import BitcoinApi from './bitcoin-api';
import ElectrumApi from './electrum-api';
import bitcoinClient from './bitcoin-client';
import mempool from '../mempool';

function bitcoinApiFactory(): AbstractBitcoinApi {
  switch (config.MEMPOOL.BACKEND) {
    case 'esplora':
      return new EsploraApi();
    case 'electrum':
      return new ElectrumApi(bitcoinClient, mempool);
    case 'none':
    default:
      return new BitcoinApi(bitcoinClient, mempool);
  }
}

export const bitcoinCoreApi = new BitcoinApi(bitcoinClient, mempool);

export default bitcoinApiFactory();
