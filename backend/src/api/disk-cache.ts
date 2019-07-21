import * as fs from 'fs';

class DiskCache {
  static FILE_NAME = './cache.json';
  constructor() { }

  saveData(dataBlob: string) {
    fs.writeFileSync(DiskCache.FILE_NAME, dataBlob, 'utf8');
  }

  loadData(): string {
    return fs.readFileSync(DiskCache.FILE_NAME, 'utf8');
  }
}

export default new DiskCache();
