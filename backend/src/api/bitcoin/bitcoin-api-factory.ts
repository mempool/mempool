import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import EsploraApi from './esplora-api';
import BitcoinApi from './bitcoin-api';
import ElectrumApi from './electrum-api';

function bitcoinApiFactory(): AbstractBitcoinApi {
  switch (config.MEMPOOL.BACKEND) {
    case 'esplora':
      return new EsploraApi();
    case 'electrum':
      return new ElectrumApi();
    case 'none':
    default:
      return new BitcoinApi();
  }
}

export default bitcoinApiFactory();
