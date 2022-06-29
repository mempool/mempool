import config from '../../config';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import EsploraApi from './esplora-api';
import BitcoinApi from './bitcoin-api';
import bitcoinClient from './bitcoin-client';

function bitcoinApiFactory(): AbstractBitcoinApi {
  if (config.ESPLORA.REST_API_URL) {
    return new EsploraApi();
  } else {
    return new BitcoinApi(bitcoinClient);
  }
}

export default bitcoinApiFactory();
