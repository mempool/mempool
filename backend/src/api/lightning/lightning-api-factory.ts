import config from '../../config';
import CLightningClient from './clightning/clightning-client';
import GenericLightningClient from './ldk/lightning-client';
import { AbstractLightningApi } from './lightning-api-abstract-factory';
import LndApi from './lnd/lnd-api';

async function lightningApiFactory(): Promise<AbstractLightningApi> {
  switch (config.LIGHTNING.ENABLED === true && config.LIGHTNING.BACKEND) {
    case 'cln':
      return new CLightningClient(config.CLIGHTNING.SOCKET);
    case 'ldk':
      return await GenericLightningClient.build(config.LIGHTNING_NODE.PUBKEY, config.LIGHTNING_NODE.IP, config.LIGHTNING_NODE.PORT);
    case 'lnd':
    default:
      return new LndApi();
  }
}

export default lightningApiFactory();
