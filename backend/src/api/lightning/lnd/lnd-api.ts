import { AbstractLightningApi } from '../lightning-api-abstract-factory';
import { ILightningApi } from '../lightning-api.interface';
import * as fs from 'fs';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import type { LightningClient } from './types/lnrpc/Lightning';
import config from '../../../config';
import logger from '../../../logger';

const LND_PROTO_FILE_LOCATION = 'src/api/lightning/lnd/proto/lightning.proto';
process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA';

class LndApi implements AbstractLightningApi {
  private readonly lightningClient: void | LightningClient;

  constructor() {
    if (!config.LIGHTNING.ENABLED) {
      return;
    }
    try {
      const packageDef = <any>grpc.loadPackageDefinition(
        protoLoader.loadSync(
          LND_PROTO_FILE_LOCATION,
          {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true
          }
        )
      );
      const lndCert = fs.readFileSync(config.LND.TLS_CERT_PATH);
      const sslCreds = grpc.credentials.createSsl(lndCert);
      const macaroonCreds = grpc.credentials.createFromMetadataGenerator((_, cb) => {
        const metadata = new grpc.Metadata();
        metadata.add('macaroon', fs.readFileSync(config.LND.MACAROON_PATH).toString('hex'));
        cb(null, metadata);
      });
      this.lightningClient = new packageDef.lnrpc.Lightning(config.LND.SOCKET, grpc.credentials.combineChannelCredentials(sslCreds, macaroonCreds));
    } catch (e) {
      logger.err('Could not initiate the LND service handler: ' + (e instanceof Error ? e.message : e));
      process.exit(1);
    }
  }

  async $getNetworkInfo(): Promise<ILightningApi.NetworkInfo> {
    return new Promise((resolve, reject) => {
      this.lightningClient!.getNetworkInfo({}, (err, res) => {
        if (err || !res) {
          if (err) {
            logger.err(`LND GRPC Error: ${err?.message}`);
            logger.err(err?.details);
          } else {
            logger.err('LND GRPC Error: Empty `res` returned');
          }
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  async $getInfo(): Promise<ILightningApi.Info> {
    return new Promise((resolve, reject) => {
      this.lightningClient!.getInfo({}, (err, res) => {
        if (err || !res) {
          if (err) {
            logger.err(`LND GRPC Error: ${err?.message}`);
            logger.err(err?.details);
          } else {
            logger.err('LND GRPC Error: Empty `res` returned');
          }
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  async $getNetworkGraph(): Promise<ILightningApi.NetworkGraph> {
    return new Promise((resolve, reject) => {
      this.lightningClient!.describeGraph({}, (err, res) => {
        if (err || !res) {
          if (err) {
            logger.err(`LND GRPC Error: ${err?.message}`);
            logger.err(err?.details);
          } else {
            logger.err('LND GRPC Error: Empty `res` returned');
          }
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }
}

export default LndApi;
