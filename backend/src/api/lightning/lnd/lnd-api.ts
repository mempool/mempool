import axios, { AxiosRequestConfig } from 'axios';
import { Agent } from 'https';
import * as fs from 'fs';
import { AbstractLightningApi } from '../lightning-api-abstract-factory';
import { ILightningApi } from '../lightning-api.interface';
import config from '../../../config';
import logger from '../../../logger';

class LndApi implements AbstractLightningApi {
  axiosConfig: AxiosRequestConfig = {};

  constructor() {
    if (!config.LIGHTNING.ENABLED) {
      return;
    }
    try {
      this.axiosConfig = {
        headers: {
          'Grpc-Metadata-macaroon': fs.readFileSync(config.LND.MACAROON_PATH).toString('hex'),
        },
        httpsAgent: new Agent({
          ca: fs.readFileSync(config.LND.TLS_CERT_PATH)
        }),
        timeout: config.LND.TIMEOUT
      };
    } catch (e) {
      config.LIGHTNING.ENABLED = false;
      logger.updateNetwork();
      logger.err(`Could not initialize LND Macaroon/TLS Cert. Disabling LIGHTNING. ` + (e instanceof Error ? e.message : e));
    }
  }

  async $getNetworkInfo(): Promise<ILightningApi.NetworkInfo> {
    return axios.get<ILightningApi.NetworkInfo>(config.LND.REST_API_URL + '/v1/graph/info', this.axiosConfig)
      .then((response) => response.data);
  }

  async $getInfo(): Promise<ILightningApi.Info> {
    return axios.get<ILightningApi.Info>(config.LND.REST_API_URL + '/v1/getinfo', this.axiosConfig)
      .then((response) => response.data);
  }

  async $getNetworkGraph(): Promise<ILightningApi.NetworkGraph> {
    return axios.get<ILightningApi.NetworkGraph>(config.LND.REST_API_URL + '/v1/graph', this.axiosConfig)
      .then((response) => response.data);
  }
}

export default LndApi;
