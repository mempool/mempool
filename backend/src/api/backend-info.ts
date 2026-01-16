import fs from 'fs';
import path from 'path';
import os from 'os';
import { IBackendInfo } from '../mempool.interfaces';
import config from '../config';
import bitcoinClient from './bitcoin/bitcoin-client';
import logger from '../logger';

class BackendInfo {
  private backendInfo: IBackendInfo;
  private timer;

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
      coreVersion: '?',
      osVersion: `${os.type()} ${os.release()}`,
    };

    this.timer = setInterval(async () => {
      await this.$updateCoreVersion();
    }, 10 * 60 * 1000); // every 10 minutes
    this.$updateCoreVersion(); // starting immediately
  }

  private async $updateCoreVersion(): Promise<void> {
    try {
      const networkInfo = await bitcoinClient.getNetworkInfo();
      this.backendInfo.coreVersion = networkInfo.subversion;
    } catch (e) {
      logger.err(`Exception in $updateCoreVersion. Reason: ${(e instanceof Error ? e.message : e)}`);
    }
  }

  public getBackendInfo(): IBackendInfo {
    return this.backendInfo;
  }

  public getShortCommitHash(): string {
    return this.backendInfo.gitCommit.slice(0, 7);
  }
}

export default new BackendInfo();
