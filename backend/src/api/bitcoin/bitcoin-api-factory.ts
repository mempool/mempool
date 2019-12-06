const config = require('../../../mempool-config.json');
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import BitcoindApi from './bitcoind-api';
import ElectrsApi from './electrs-api';

function factory(): AbstractBitcoinApi {
  switch (config.BACKEND_API) {
    case 'electrs':
      return new ElectrsApi();
    case 'bitcoind':
    default:
      return new BitcoindApi();
  }
}

export default factory();
