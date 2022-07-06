import { AbstractLightningApi } from '../lightning-api-abstract-factory';
import { ILightningApi } from '../lightning-api.interface';
import * as fs from 'fs';
import * as lnService from 'ln-service';
import config from '../../../config';
import logger from '../../../logger';

class LndApi implements AbstractLightningApi {
  private lnd: any;
  constructor() {
    if (!config.LIGHTNING.ENABLED) {
      return;
    }
    try {
      const tls = fs.readFileSync(config.LND.TLS_CERT_PATH).toString('base64');
      const macaroon = fs.readFileSync(config.LND.MACAROON_PATH).toString('base64');

      const { lnd } = lnService.authenticatedLndGrpc({
        cert: tls,
        macaroon: macaroon,
        socket: config.LND.SOCKET,
      });

      this.lnd = lnd;
    } catch (e) {
      logger.err('Could not initiate the LND service handler: ' + (e instanceof Error ? e.message : e));
      process.exit(1);
    }
  }

  async $getNetworkInfo(): Promise<ILightningApi.NetworkInfo> {
    return await lnService.getNetworkInfo({ lnd: this.lnd });
  }

  async $getNetworkGraph(): Promise<ILightningApi.NetworkGraph> {
    return await lnService.getNetworkGraph({ lnd: this.lnd });
  }

  async $getChanInfo(id: string): Promise<ILightningApi.Channel> {
    return await lnService.getChannel({ lnd: this.lnd, id });
  }
}

export default LndApi;
