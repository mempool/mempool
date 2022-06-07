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
  private cacheSchemaVersion = 1;

  private static FILE_NAME = config.MEMPOOL.CACHE_DIR + '/cache.json';
  private static FILE_NAMES = config.MEMPOOL.CACHE_DIR + '/cache{number}.json';
  private static CHUNK_FILES = 25;
  private isWritingCache = false;

  constructor() { }

  async $saveCacheToDisk(): Promise<void> {
    if (!cluster.isMaster) {
      return;
    }
    if (this.isWritingCache) {
      logger.debug('Saving cache already in progress. Skipping.')
      return;
    }
    try {
      logger.debug('Writing mempool and blocks data to disk cache (async)...');
      this.isWritingCache = true;

      const mempool = memPool.getMempool();
      const mempoolArray: TransactionExtended[] = [];
      for (const tx in mempool) {
        mempoolArray.push(mempool[tx]);
      }

      Common.shuffleArray(mempoolArray);

      const chunkSize = Math.floor(mempoolArray.length / DiskCache.CHUNK_FILES);

      await fsPromises.writeFile(DiskCache.FILE_NAME, JSON.stringify({
        cacheSchemaVersion: this.cacheSchemaVersion,
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
      this.isWritingCache = false;
    } catch (e) {
      logger.warn('Error writing to cache file: ' + (e instanceof Error ? e.message : e));
      this.isWritingCache = false;
    }
  }

  wipeCache() {
    fs.unlinkSync(DiskCache.FILE_NAME);
    for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
      fs.unlinkSync(DiskCache.FILE_NAMES.replace('{number}', i.toString()));
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
        if (data.cacheSchemaVersion === undefined || data.cacheSchemaVersion !== this.cacheSchemaVersion) {
          logger.notice('Disk cache contains an outdated schema version. Clearing it and skipping the cache loading.');
          return this.wipeCache();
        }

        if (data.mempoolArray) {
          for (const tx of data.mempoolArray) {
            data.mempool[tx.txid] = tx;
          }
        }
      }

      for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
        const fileName = DiskCache.FILE_NAMES.replace('{number}', i.toString());
        try {
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
        } catch (e) {
          logger.info('Error parsing ' + fileName + '. Skipping. Reason: ' + (e instanceof Error ? e.message : e));
        }
      }

      memPool.setMempool(data.mempool);
      blocks.setBlocks(data.blocks);
    } catch (e) {
      logger.warn('Failed to parse mempoool and blocks cache. Skipping. Reason: ' + (e instanceof Error ? e.message : e));
    }
  }
}

export default new DiskCache();
