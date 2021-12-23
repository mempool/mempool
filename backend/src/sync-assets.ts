import axios from 'axios';
import * as fs from 'fs';
const fsPromises = fs.promises;
import config from './config';
import logger from './logger';

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
    logger.info(`Downloading external asset: ${fileName}...`);
    try {
      const response = await axios.get(url, {
        responseType: 'stream', timeout: 30000
      });
      await fsPromises.writeFile(PATH + fileName, response.data);
    } catch (e: any) {
      throw new Error(`Failed to download external asset. ` + e);
    }
  }
}

export default new SyncAssets();
