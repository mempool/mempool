import * as fs from 'fs';
import * as cluster from 'cluster';
import memPool from './mempool';
import blocks from './blocks';

class DiskCache {
  static FILE_NAME = './cache.json';

  constructor() {
    process.on('SIGINT', () => {
      this.saveCacheToDisk();
      process.exit(2);
    });

    process.on('SIGTERM', () => {
      this.saveCacheToDisk();
      process.exit(2);
    });
  }

  saveCacheToDisk() {
    this.saveData(JSON.stringify({
      mempool: memPool.getMempool(),
      blocks: blocks.getBlocks(),
    }));
    console.log('Mempool and blocks data saved to disk cache');
  }

  loadMempoolCache() {
    const cacheData = this.loadData();
    if (cacheData) {
      console.log('Restoring mempool and blocks data from disk cache');
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
