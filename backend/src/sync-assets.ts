import axios, { AxiosResponse } from 'axios';
import * as fs from 'fs';
import config from './config';
import logger from './logger';
import { SocksProxyAgent } from 'socks-proxy-agent';

const PATH = './';

class SyncAssets {
  constructor() { }

  public async syncAssets() {
    for (const url of config.MEMPOOL.EXTERNAL_ASSETS) {
      await this.downloadFile(url);
    }
  }

  private async downloadFile(url: string) {
    const fileName = url.split('/').slice(-1)[0];

    try {
      if (config.SOCKS5PROXY.ENABLED) {
        let socksOptions: any = {
          agentOptions: {
            keepAlive: true,
          },
          host: config.SOCKS5PROXY.HOST,
          port: config.SOCKS5PROXY.PORT
        };

        if (config.SOCKS5PROXY.USERNAME && config.SOCKS5PROXY.PASSWORD) {
          socksOptions.username = config.SOCKS5PROXY.USERNAME;
          socksOptions.password = config.SOCKS5PROXY.PASSWORD;
        }

        const agent = new SocksProxyAgent(socksOptions);

        logger.info(`Downloading external asset ${fileName} over the Tor network...`);
        await axios.get(url, {
          httpAgent: agent,
          httpsAgent: agent,
          responseType: 'stream',
          timeout: 30000
        }).then(function (response) {
          response.data.pipe(fs.createWriteStream(PATH + fileName));
          logger.info(`External asset ${fileName} saved to ${PATH + fileName}`);
        });
      } else {
        logger.info(`Downloading external asset ${fileName} over clearnet...`);
        await axios.get(url, {
          responseType: 'stream',
          timeout: 30000
        }).then(function (response) {
          response.data.pipe(fs.createWriteStream(PATH + fileName));
          logger.info(`External asset ${fileName} saved to ${PATH + fileName}`);
        });
      }
    } catch (e: any) {
      throw new Error(`Failed to download external asset. ` + e);
    }
  }
}

export default new SyncAssets();
