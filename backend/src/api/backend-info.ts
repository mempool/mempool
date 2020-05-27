import * as fs from 'fs';
import * as os from 'os';

class BackendInfo {
  gitCommitHash = '';
  hostname = '';

  constructor() {
    this.setLatestCommitHash();
    this.hostname = os.hostname();
  }

  public getBackendInfo() {
    return {
      'hostname': this.hostname,
      'git-commit': this.gitCommitHash,
    };
  }

  private setLatestCommitHash(): void {
    try {
      this.gitCommitHash = fs.readFileSync('../.git/refs/heads/master').toString().trim();
    } catch (e) {
      console.log('Could not load git commit info, skipping.');
    }
  }
}

export default new BackendInfo();
