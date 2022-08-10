import config from '../../config';
import CLightningClient from './clightning/clightning-client';
import { AbstractLightningApi } from './lightning-api-abstract-factory';
import LndApi from './lnd/lnd-api';

function lightningApiFactory(): AbstractLightningApi {
  switch (config.LIGHTNING.ENABLED === true && config.LIGHTNING.BACKEND) {
    case 'cln':
      return new CLightningClient(config.CLIGHTNING.SOCKET);
    case 'lnd':
    default:
      return new LndApi();
  }
}

export default lightningApiFactory();
