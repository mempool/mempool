const config = require('../../../mempool-config.json');
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import BitcoindApi from './bitcoind-api';
import EsploraApi from './esplora-api';

function factory(): AbstractBitcoinApi {
  switch (config.BACKEND_API) {
    case 'esplora':
      return new EsploraApi();
    case 'bitcoind':
    default:
      return new BitcoindApi();
  }
}

export default factory();
