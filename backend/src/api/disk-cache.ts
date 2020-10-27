import config from '../config';
import * as fs from 'fs';
import * as process from 'process';
import memPool from './mempool';
import blocks from './blocks';
import logger from '../logger';

class DiskCache {
  private static FILE_NAME = './cache.json';
  private enabled = true;

  constructor() {
    if (process.env.workerId === '0' || !config.MEMPOOL.SPAWN_CLUSTER_PROCS) {
      if (!fs.existsSync(DiskCache.FILE_NAME)) {
        fs.closeSync(fs.openSync(DiskCache.FILE_NAME, 'w'));
        logger.info('Disk cache file created');
      }

      process.on('SIGINT', () => {
        this.saveCacheToDisk();
        process.exit(2);
      });

      process.on('SIGTERM', () => {
        this.saveCacheToDisk();
        process.exit(2);
      });
    } else {
      this.enabled = false;
    }
  }

  async $saveCacheToDiskAsync(): Promise<void> {
    if (!this.enabled) {
      return;
    }
    try {
      await this.$saveDataAsync(JSON.stringify({
        mempool: memPool.getMempool(),
        blocks: blocks.getBlocks(),
      }));
      logger.debug('Mempool and blocks data saved to disk cache');
    } catch (e) {
      logger.warn('Error writing to cache file asynchronously');
    }
  }

  loadMempoolCache() {
    const cacheData = this.loadDataSync();
    if (cacheData) {
      logger.info('Restoring mempool and blocks data from disk cache');
      const data = JSON.parse(cacheData);
      memPool.setMempool(data.mempool);
      blocks.setBlocks(data.blocks);
    }
  }

  private saveCacheToDisk() {
    this.saveDataSync(JSON.stringify({
      mempool: memPool.getMempool(),
      blocks: blocks.getBlocks(),
    }));
    logger.info('Mempool and blocks data saved to disk cache');
  }

  private $saveDataAsync(dataBlob: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(DiskCache.FILE_NAME, dataBlob, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  }

  private saveDataSync(dataBlob: string) {
    fs.writeFileSync(DiskCache.FILE_NAME, dataBlob, 'utf8');
  }

  private loadDataSync(): string {
    return fs.readFileSync(DiskCache.FILE_NAME, 'utf8');
  }
}

export default new DiskCache();
