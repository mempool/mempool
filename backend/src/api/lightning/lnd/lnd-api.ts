import axios, { AxiosRequestConfig } from 'axios';
import { Agent } from 'https';
import * as fs from 'fs';
import { AbstractLightningApi } from '../lightning-api-abstract-factory';
import { ILightningApi } from '../lightning-api.interface';
import { FeaturesMap } from '../features';
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

  /** @asyncUnsafe */
  async $getNetworkGraph(): Promise<ILightningApi.NetworkGraph> {
    const graph = await axios.get<ILightningApi.NetworkGraph>(config.LND.REST_API_URL + '/v1/graph', this.axiosConfig)
      .then((response) => response.data);

    for (const node of graph.nodes) {
      const nodeFeatures: ILightningApi.Feature[] = [];
      for (const bit in node.features) {
        const f = node.features[bit];
        const bitNum = parseInt(bit, 10);
        const lndName = f.name;
        const sharedName = FeaturesMap.get(bitNum);
        const finalName = f.is_known ? lndName : (sharedName ?? lndName);
        const isKnown = f.is_known || !!sharedName;
        nodeFeatures.push({
          bit: bitNum,
          name: finalName,
          is_required: f.is_required,
          is_known: isKnown,
        });
      }
      node.features = nodeFeatures;
    }

    return graph;
  }
}

export default LndApi;
