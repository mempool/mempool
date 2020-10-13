const config = require('../../mempool-config.json');
import * as fs from 'fs';
import * as process from 'process';
import memPool from './mempool';
import blocks from './blocks';
import logger from '../logger';

class DiskCache {
  static FILE_NAME = './cache.json';

  constructor() {
    if (process.env.workerId === '0' || !config.CLUSTER_NUM_CORES || config.CLUSTER_NUM_CORES === 1) {
      process.on('SIGINT', () => {
        this.saveCacheToDisk();
        process.exit(2);
      });

      process.on('SIGTERM', () => {
        this.saveCacheToDisk();
        process.exit(2);
      });
    }
  }

  saveCacheToDisk() {
    this.saveData(JSON.stringify({
      mempool: memPool.getMempool(),
      blocks: blocks.getBlocks(),
    }));
    logger.info('Mempool and blocks data saved to disk cache');
  }

  loadMempoolCache() {
    const cacheData = this.loadData();
    if (cacheData) {
      logger.info('Restoring mempool and blocks data from disk cache');
      const data = JSON.parse(cacheData);
      memPool.setMempool(data.mempool);
      blocks.setBlocks(data.blocks);
    }
  }

  private saveData(dataBlob: string) {
    fs.writeFileSync(DiskCache.FILE_NAME, dataBlob, 'utf8');
  }

  private loadData(): string {
    return fs.readFileSync(DiskCache.FILE_NAME, 'utf8');
  }
}

export default new DiskCache();
