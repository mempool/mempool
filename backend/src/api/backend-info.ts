import * as fs from 'fs';
import * as os from 'os';
import logger from '../logger';
import { IBackendInfo } from '../mempool.interfaces';

class BackendInfo {
  private gitCommitHash = '';
  private hostname = '';
  private version = '';

  constructor() {
    this.setLatestCommitHash();
    this.setVersion();
    this.hostname = os.hostname();
  }

  public getBackendInfo(): IBackendInfo {
    return {
      hostname: this.hostname,
      gitCommit: this.gitCommitHash,
      version: this.version,
    };
  }

  public getShortCommitHash() {
    return this.gitCommitHash.slice(0, 7);
  }

  private setLatestCommitHash(): void {
    try {
      this.gitCommitHash = fs.readFileSync('../.git/refs/heads/master').toString().trim();
    } catch (e) {
      logger.err('Could not load git commit info: ' + (e instanceof Error ? e.message : e));
    }
  }

  private setVersion(): void {
    try {
      const packageJson = fs.readFileSync('package.json').toString();
      this.version = JSON.parse(packageJson).version;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Error');
    }
  }
}

export default new BackendInfo();
