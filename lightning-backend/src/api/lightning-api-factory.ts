import config from '../config';
import { AbstractLightningApi } from './lightning-api-abstract-factory';
import LndApi from './lnd/lnd-api';

function lightningApiFactory(): AbstractLightningApi {
  switch (config.MEMPOOL.BACKEND) {
    case 'lnd':
    default:
      return new LndApi();
  }
}

export default lightningApiFactory();
