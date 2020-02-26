import * as fs from 'fs';
import memPool from './mempool';

class DiskCache {
  static FILE_NAME = './cache.json';

  constructor() {
    process.on('SIGINT', () => {
      this.saveData(JSON.stringify(memPool.getMempool()));
      console.log('Mempool data saved to disk cache');
      process.exit(2);
    });
  }

  loadMempoolCache() {
    const cacheData = this.loadData();
    if (cacheData) {
      console.log('Restoring mempool data from disk cache');
      memPool.setMempool(JSON.parse(cacheData));
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
