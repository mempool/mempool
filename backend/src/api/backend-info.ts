import fs from 'fs';
import path from 'path';
import os from 'os';
import { IBackendInfo } from '../mempool.interfaces';
import config from '../config';

class BackendInfo {
  private backendInfo: IBackendInfo;

  constructor() {
    // This file is created by ./fetch-version.ts during building
    const versionFile = path.join(__dirname, 'version.json');
    let versionInfo;
    if (fs.existsSync(versionFile)) {
      versionInfo = JSON.parse(fs.readFileSync(versionFile).toString());
    } else {
      // Use dummy values if `versionFile` doesn't exist (e.g., during testing)
      versionInfo = {
        version: '?',
        gitCommit: '?'
      };
    }
    this.backendInfo = {
      hostname: os.hostname(),
      version: versionInfo.version,
      gitCommit: versionInfo.gitCommit,
      lightning: config.LIGHTNING.ENABLED,
      backend: config.MEMPOOL.BACKEND,
    };
  }

  public getBackendInfo(): IBackendInfo {
    return this.backendInfo;
  }

  public getShortCommitHash(): string {
    return this.backendInfo.gitCommit.slice(0, 7);
  }
}

export default new BackendInfo();
