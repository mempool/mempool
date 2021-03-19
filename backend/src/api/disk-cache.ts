import * as fs from 'fs';
const fsPromises = fs.promises;
import * as cluster from 'cluster';
import memPool from './mempool';
import blocks from './blocks';
import logger from '../logger';
import config from '../config';
import { TransactionExtended } from '../mempool.interfaces';
import { Common } from './common';

class DiskCache {
  private static FILE_NAME = config.MEMPOOL.CACHE_DIR + '/cache.json';
  private static FILE_NAMES = config.MEMPOOL.CACHE_DIR + '/cache{number}.json';
  private static CHUNK_FILES = 25;

  constructor() { }

  async $saveCacheToDisk(): Promise<void> {
    if (!cluster.isMaster) {
      return;
    }
    try {
      logger.debug('Writing mempool and blocks data to disk cache (async)...');

      const mempool = memPool.getMempool();
      const mempoolArray: TransactionExtended[] = [];
      for (const tx in mempool) {
        mempoolArray.push(mempool[tx]);
      }

      Common.shuffleArray(mempoolArray);

      const chunkSize = Math.floor(mempoolArray.length / DiskCache.CHUNK_FILES);

      await fsPromises.writeFile(DiskCache.FILE_NAME, JSON.stringify({
        blocks: blocks.getBlocks(),
        mempool: {},
        mempoolArray: mempoolArray.splice(0, chunkSize),
      }), {flag: 'w'});
      for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
        await fsPromises.writeFile(DiskCache.FILE_NAMES.replace('{number}', i.toString()), JSON.stringify({
          mempool: {},
          mempoolArray: mempoolArray.splice(0, chunkSize),
        }), {flag: 'w'});
      }
      logger.debug('Mempool and blocks data saved to disk cache');
    } catch (e) {
      logger.warn('Error writing to cache file: ' + e.message || e);
    }
  }

  loadMempoolCache() {
    if (!fs.existsSync(DiskCache.FILE_NAME)) {
      return;
    }
    try {
      let data: any = {};
      const cacheData = fs.readFileSync(DiskCache.FILE_NAME, 'utf8');
      if (cacheData) {
        logger.info('Restoring mempool and blocks data from disk cache');
        data = JSON.parse(cacheData);
        if (data.mempoolArray) {
          for (const tx of data.mempoolArray) {
            data.mempool[tx.txid] = tx;
          }
        }
      }

      for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
        const fileName = DiskCache.FILE_NAMES.replace('{number}', i.toString());
        if (fs.existsSync(fileName)) {
          const cacheData2 = JSON.parse(fs.readFileSync(fileName, 'utf8'));
          if (cacheData2.mempoolArray) {
            for (const tx of cacheData2.mempoolArray) {
              data.mempool[tx.txid] = tx;
            }
          } else {
            Object.assign(data.mempool, cacheData2.mempool);
          }
        }
      }

      memPool.setMempool(data.mempool);
      blocks.setBlocks(data.blocks);
    } catch (e) {
      logger.warn('Failed to parse mempoool and blocks cache. Skipping...');
    }
  }
}

export default new DiskCache();
