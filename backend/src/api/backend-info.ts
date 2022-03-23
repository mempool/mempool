import * as fs from 'fs';
import * as os from 'os';
import logger from '../logger';
import { IBackendInfo } from '../mempool.interfaces';
const { spawnSync } = require('child_process');

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
    //TODO: share this logic with `generate-config.js`
    if (process.env.DOCKER_COMMIT_HASH) {
      this.gitCommitHash = process.env.DOCKER_COMMIT_HASH;
    } else {
      try {
        const gitRevParse = spawnSync('git', ['rev-parse', '--short', 'HEAD']);

        if (!gitRevParse.error) {
          this.gitCommitHash = gitRevParse.stdout.toString('utf-8').replace(/[\n\r\s]+$/, '');
          console.log(`mempool revision ${this.gitCommitHash}`);
        } else if (gitRevParse.error.code === 'ENOENT') {
          console.log('git not found, cannot parse git hash');
          this.gitCommitHash = '?';
        }
      } catch (e: any) {
        console.log('Could not load git commit info: ' + e.message);
        this.gitCommitHash = '?';
      }
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
