import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import BitcoindElectrsApi from './bitcoind-electrs-api';
import BitcoindApi from './bitcoind-api';
import ElectrsApi from './electrs-api';

function bitcoinApiFactory(): AbstractBitcoinApi {
  switch (config.MEMPOOL.BACKEND) {
    case 'electrs':
      return new ElectrsApi();
    case 'bitcoind-electrs':
      return new BitcoindElectrsApi();
    case 'bitcoind':
    default:
      return new BitcoindApi();
  }
}

export default bitcoinApiFactory();
