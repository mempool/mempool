import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import config from './config';
import backendInfo from './api/backend-info';
import logger from './logger';
import { SocksProxyAgent } from 'socks-proxy-agent';

const PATH = './';

class SyncAssets {
  constructor() { }

  public async syncAssets$() {
    for (const url of config.MEMPOOL.EXTERNAL_ASSETS) {
      try {
        await this.downloadFile$(url);
      } catch (e) {
        throw new Error(`Failed to download external asset. ` + (e instanceof Error ? e.message : e));
      }
    }
  }

  private async downloadFile$(url: string) {
    return new Promise((resolve, reject) => {
      const fileName = url.split('/').slice(-1)[0];

      try {
        if (config.SOCKS5PROXY.ENABLED) {
          const socksOptions: any = {
            agentOptions: {
              keepAlive: true,
            },
            hostname: config.SOCKS5PROXY.HOST,
            port: config.SOCKS5PROXY.PORT
          };

          if (config.SOCKS5PROXY.USERNAME && config.SOCKS5PROXY.PASSWORD) {
            socksOptions.username = config.SOCKS5PROXY.USERNAME;
            socksOptions.password = config.SOCKS5PROXY.PASSWORD;
          }

          const agent = new SocksProxyAgent(socksOptions);

          logger.info(`Downloading external asset ${fileName} over the Tor network...`);
          return axios.get(url, {
            headers: {
              'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
            },
            httpAgent: agent,
            httpsAgent: agent,
            responseType: 'stream',
            timeout: 30000
          }).then(function (response) {
            const writer = fs.createWriteStream(PATH + fileName);
            writer.on('finish', () => {
              logger.info(`External asset ${fileName} saved to ${PATH + fileName}`);
              resolve(0);
            });
            response.data.pipe(writer);
          });
        } else {
          logger.info(`Downloading external asset ${fileName} over clearnet...`);
          return axios.get(url, {
            headers: {
              'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
            },
            responseType: 'stream',
            timeout: 30000
          }).then(function (response) {
            const writer = fs.createWriteStream(PATH + fileName);
            writer.on('finish', () => {
              logger.info(`External asset ${fileName} saved to ${PATH + fileName}`);
              resolve(0);
            });
            response.data.pipe(writer);
          });
        }
      } catch (e: any) {
        reject(e);
      }
    });
  }
}

export default new SyncAssets();
