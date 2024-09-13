import * as fs from 'fs';
const fsPromises = fs.promises;
import cluster from 'cluster';
import memPool from './mempool';
import blocks from './blocks';
import logger from '../logger';
import config from '../config';
import { TransactionExtended } from '../mempool.interfaces';
import { Common } from './common';
import rbfCache from './rbf-cache';

class DiskCache {
  private cacheSchemaVersion = 3;
  private rbfCacheSchemaVersion = 1;

  private static TMP_FILE_NAME = config.MEMPOOL.CACHE_DIR + '/tmp-cache.json';
  private static TMP_FILE_NAMES = config.MEMPOOL.CACHE_DIR + '/tmp-cache{number}.json';
  private static FILE_NAME = config.MEMPOOL.CACHE_DIR + '/cache.json';
  private static FILE_NAMES = config.MEMPOOL.CACHE_DIR + '/cache{number}.json';
  private static TMP_RBF_FILE_NAME = config.MEMPOOL.CACHE_DIR + '/tmp-rbfcache.json';
  private static RBF_FILE_NAME = config.MEMPOOL.CACHE_DIR + '/rbfcache.json';
  private static CHUNK_FILES = 25;
  private isWritingCache = false;
  private ignoreBlocksCache = false;

  private semaphore: { resume: (() => void)[], locks: number } = {
    resume: [],
    locks: 0,
  };

  constructor() {
    if (!cluster.isPrimary || !config.MEMPOOL.CACHE_ENABLED) {
      return;
    }
    process.on('SIGINT', (e) => {
      this.$saveCacheToDisk(true);
      process.exit(0);
    });
  }

  async $saveCacheToDisk(sync: boolean = false): Promise<void> {
    if (!cluster.isPrimary || !config.MEMPOOL.CACHE_ENABLED) {
      return;
    }
    if (this.isWritingCache) {
      logger.debug('Saving cache already in progress. Skipping.');
      return;
    }
    try {
      logger.debug(`Writing mempool and blocks data to disk cache (${ sync ? 'sync' : 'async' })...`);
      this.isWritingCache = true;

      const mempool = memPool.getMempool();
      const mempoolArray: TransactionExtended[] = [];
      for (const tx in mempool) {
        if (mempool[tx]) {
          mempoolArray.push(mempool[tx]);
        }
      }

      Common.shuffleArray(mempoolArray);

      const chunkSize = Math.floor(mempoolArray.length / DiskCache.CHUNK_FILES);

      if (sync) {
        fs.writeFileSync(DiskCache.TMP_FILE_NAME, JSON.stringify({
          network: config.MEMPOOL.NETWORK,
          cacheSchemaVersion: this.cacheSchemaVersion,
          blocks: blocks.getBlocks(),
          blockSummaries: blocks.getBlockSummaries(),
          mempool: {},
          mempoolArray: mempoolArray.splice(0, chunkSize),
        }), { flag: 'w' });
        for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
          fs.writeFileSync(DiskCache.TMP_FILE_NAMES.replace('{number}', i.toString()), JSON.stringify({
            mempool: {},
            mempoolArray: mempoolArray.splice(0, chunkSize),
          }), { flag: 'w' });
        }

        fs.renameSync(DiskCache.TMP_FILE_NAME, DiskCache.FILE_NAME);
        for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
          fs.renameSync(DiskCache.TMP_FILE_NAMES.replace('{number}', i.toString()), DiskCache.FILE_NAMES.replace('{number}', i.toString()));
        }
      } else {
        await this.$yield();
        await fsPromises.writeFile(DiskCache.TMP_FILE_NAME, JSON.stringify({
          network: config.MEMPOOL.NETWORK,
          cacheSchemaVersion: this.cacheSchemaVersion,
          blocks: blocks.getBlocks(),
          blockSummaries: blocks.getBlockSummaries(),
          mempool: {},
          mempoolArray: mempoolArray.splice(0, chunkSize),
        }), { flag: 'w' });
        for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
          await this.$yield();
          await fsPromises.writeFile(DiskCache.TMP_FILE_NAMES.replace('{number}', i.toString()), JSON.stringify({
            mempool: {},
            mempoolArray: mempoolArray.splice(0, chunkSize),
          }), { flag: 'w' });
        }

        await fsPromises.rename(DiskCache.TMP_FILE_NAME, DiskCache.FILE_NAME);
        for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
          await fsPromises.rename(DiskCache.TMP_FILE_NAMES.replace('{number}', i.toString()), DiskCache.FILE_NAMES.replace('{number}', i.toString()));
        }
      }

      logger.debug('Mempool and blocks data saved to disk cache');
      this.isWritingCache = false;
    } catch (e) {
      logger.warn('Error writing to cache file: ' + (e instanceof Error ? e.message : e));
      this.isWritingCache = false;
    }

    try {
      logger.debug('Writing rbf data to disk cache (async)...');
      this.isWritingCache = true;
      const rbfData = rbfCache.dump();
      if (sync) {
        fs.writeFileSync(DiskCache.TMP_RBF_FILE_NAME, JSON.stringify({
          network: config.MEMPOOL.NETWORK,
          rbfCacheSchemaVersion: this.rbfCacheSchemaVersion,
          rbf: rbfData,
        }), { flag: 'w' });
        fs.renameSync(DiskCache.TMP_RBF_FILE_NAME, DiskCache.RBF_FILE_NAME);
      } else {
        await fsPromises.writeFile(DiskCache.TMP_RBF_FILE_NAME, JSON.stringify({
          network: config.MEMPOOL.NETWORK,
          rbfCacheSchemaVersion: this.rbfCacheSchemaVersion,
          rbf: rbfData,
        }), { flag: 'w' });
        await fsPromises.rename(DiskCache.TMP_RBF_FILE_NAME, DiskCache.RBF_FILE_NAME);
      }
      logger.debug('Rbf data saved to disk cache');
      this.isWritingCache = false;
    } catch (e) {
      logger.warn('Error writing rbf data to cache file: ' + (e instanceof Error ? e.message : e));
      this.isWritingCache = false;
    }
  }

  wipeCache(): void {
    logger.notice(`Wiping nodejs backend cache/cache*.json files`);
    try {
      fs.unlinkSync(DiskCache.FILE_NAME);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        logger.err(`Cannot wipe cache file ${DiskCache.FILE_NAME}. Exception ${JSON.stringify(e)}`);
      }
    }

    for (let i = 1; i < DiskCache.CHUNK_FILES; i++) {
      const filename = DiskCache.FILE_NAMES.replace('{number}', i.toString());
      try {
        fs.unlinkSync(filename);
      } catch (e: any) {
        if (e?.code !== 'ENOENT') {
          logger.err(`Cannot wipe cache file ${filename}. Exception ${JSON.stringify(e)}`);
        }
      }
    }
  }

  wipeRbfCache() {
    logger.notice(`Wipping nodejs backend cache/rbfcache.json file`);

    try {
      fs.unlinkSync(DiskCache.RBF_FILE_NAME);
    } catch (e: any) {
      if (e?.code !== 'ENOENT') {
        logger.err(`Cannot wipe cache file ${DiskCache.RBF_FILE_NAME}. Exception ${JSON.stringify(e)}`);
      }
    }
  }

  async $loadMempoolCache(): Promise<void> {
    if (!config.MEMPOOL.CACHE_ENABLED || !fs.existsSync(DiskCache.FILE_NAME)) {
      return;
    }
    try {
      const start = Date.now();
      let data: any = {};
      const cacheData = fs.readFileSync(DiskCache.FILE_NAME, 'utf8');
      if (cacheData) {
        logger.info('Restoring mempool and blocks data from disk cache');
        data = JSON.parse(cacheData);
        if (data.cacheSchemaVersion === undefined || data.cacheSchemaVersion !== this.cacheSchemaVersion) {
          logger.notice('Disk cache contains an outdated schema version. Clearing it and skipping the cache loading.');
          return this.wipeCache();
        }
        if (data.network && data.network !== config.MEMPOOL.NETWORK) {
          logger.notice('Disk cache contains data from a different network. Clearing it and skipping the cache loading.');
          return this.wipeCache();
        }

        if (data.mempoolArray) {
          for (const tx of data.mempoolArray) {
            delete tx.uid;
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
                delete tx.uid;
                data.mempool[tx.txid] = tx;
              }
            } else {
              Object.assign(data.mempool, cacheData2.mempool);
            }
          }
        } catch (e) {
          logger.err('Error parsing ' + fileName + '. Skipping. Reason: ' + (e instanceof Error ? e.message : e));
        }
      }

      logger.info(`Loaded mempool from disk cache in ${Date.now() - start} ms`);

      await memPool.$setMempool(data.mempool);
      if (!this.ignoreBlocksCache) {
        blocks.setBlocks(data.blocks);
        blocks.setBlockSummaries(data.blockSummaries || []);
      } else {
        logger.info('Re-saving cache with empty recent blocks data');
        await this.$saveCacheToDisk(true);
      }
    } catch (e) {
      logger.warn('Failed to parse mempoool and blocks cache. Skipping. Reason: ' + (e instanceof Error ? e.message : e));
    }

    try {
      let rbfData: any = {};
      const rbfCacheData = fs.readFileSync(DiskCache.RBF_FILE_NAME, 'utf8');
      if (rbfCacheData) {
        logger.info('Restoring rbf data from disk cache');
        rbfData = JSON.parse(rbfCacheData);
        if (rbfData.rbfCacheSchemaVersion === undefined || rbfData.rbfCacheSchemaVersion !== this.rbfCacheSchemaVersion) {
          logger.notice('Rbf disk cache contains an outdated schema version. Clearing it and skipping the cache loading.');
          return this.wipeRbfCache();
        }
        if (rbfData.network && rbfData.network !== config.MEMPOOL.NETWORK) {
          logger.notice('Rbf disk cache contains data from a different network. Clearing it and skipping the cache loading.');
          return this.wipeRbfCache();
        }
      }

      if (rbfData?.rbf) {
        rbfCache.load({
          txs: rbfData.rbf.txs.map(([txid, entry]) => ({ value: entry })),
          trees: rbfData.rbf.trees,
          expiring: rbfData.rbf.expiring.map(([txid, value]) => ({ key: txid, value })),
          mempool: memPool.getMempool(),
          spendMap: memPool.getSpendMap(),
        });
      }
    } catch (e) {
      logger.warn('Failed to parse rbf cache. Skipping. Reason: ' + (e instanceof Error ? e.message : e));
    }
  }

  private $yield(): Promise<void> {
    if (this.semaphore.locks) {
      logger.debug('Pause writing mempool and blocks data to disk cache (async)');
      return new Promise((resolve) => {
        this.semaphore.resume.push(resolve);
      });
    } else {
      return Promise.resolve();
    }
  }

  public lock(): void {
    this.semaphore.locks++;
  }

  public unlock(): void {
    this.semaphore.locks = Math.max(0, this.semaphore.locks - 1);
    if (!this.semaphore.locks && this.semaphore.resume.length) {
      const nextResume = this.semaphore.resume.shift();
      if (nextResume) {
        logger.debug('Resume writing mempool and blocks data to disk cache (async)');
        nextResume();
      }
    }
  }

  public setIgnoreBlocksCache(): void {
    this.ignoreBlocksCache = true;
  }
}

export default new DiskCache();
