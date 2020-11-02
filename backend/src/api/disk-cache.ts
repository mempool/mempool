import * as fs from 'fs';
const fsPromises = fs.promises;
import * as process from 'process';
import * as cluster from 'cluster';
import memPool from './mempool';
import blocks from './blocks';
import logger from '../logger';

class DiskCache {
  private static FILE_NAME = './cache.json';
  private static FILE_NAME_2 = './cache2.json';
  constructor() {
    if (!cluster.isMaster) {
      return;
    }
    /*
    if (!fs.existsSync(DiskCache.FILE_NAME)) {
      fs.closeSync(fs.openSync(DiskCache.FILE_NAME, 'w'));
      logger.info('Disk cache file created');
    }
    */
    process.on('SIGINT', async () => {
      await this.$saveCacheToDisk();
      process.exit(2);
    });

    process.on('SIGTERM', async () => {
      await this.$saveCacheToDisk();
      process.exit(2);
    });
  }

  async $saveCacheToDisk(): Promise<void> {
    if (!cluster.isMaster) {
      return;
    }
    try {
      logger.debug('Writing mempool and blocks data to disk cache...');
      const mempoolChunk_1 = Object.fromEntries(Object.entries(memPool.getMempool()).splice(0, 50000));
      const mempoolChunk_2 = Object.fromEntries(Object.entries(memPool.getMempool()).splice(50000));
      await fsPromises.writeFile(DiskCache.FILE_NAME, JSON.stringify({
        blocks: blocks.getBlocks(),
        mempool: mempoolChunk_1
      }), {flag: 'w'});
      await fsPromises.writeFile(DiskCache.FILE_NAME_2, JSON.stringify({
        mempool: mempoolChunk_2
      }), {flag: 'w'});
      logger.debug('Mempool and blocks data saved to disk cache');
    } catch (e) {
      logger.warn('Error writing to cache file: ' + e.message || e);
    }
  }

  loadMempoolCache() {
    if (!fs.existsSync(DiskCache.FILE_NAME)) {
      return;
    }
    let data: any = {};
    const cacheData = fs.readFileSync(DiskCache.FILE_NAME, 'utf8');
    if (cacheData) {
      logger.info('Restoring mempool and blocks data from disk cache');
      data = JSON.parse(cacheData);
    }

    if (fs.existsSync(DiskCache.FILE_NAME_2)) {
      const cacheData2 = JSON.parse(fs.readFileSync(DiskCache.FILE_NAME_2, 'utf8'));
      Object.assign(data.mempool, cacheData2.mempool);
    }

    memPool.setMempool(data.mempool);
    blocks.setBlocks(data.blocks);
  }
}

export default new DiskCache();
