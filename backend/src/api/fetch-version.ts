import fs from 'fs';
import path from "path";
const { spawnSync } = require('child_process');

function getVersion(): string {
  const packageJson = fs.readFileSync('package.json').toString();
  return JSON.parse(packageJson).version;
}

function getGitCommit(): string {
  if (process.env.MEMPOOL_COMMIT_HASH) {
    return process.env.MEMPOOL_COMMIT_HASH;
  } else {
    const gitRevParse = spawnSync('git', ['rev-parse', '--short', 'HEAD']);
    if (!gitRevParse.error) {
      const output = gitRevParse.stdout.toString('utf-8').replace(/[\n\r\s]+$/, '');
      if (output) {
        return output;
      } else {
        console.log('Could not fetch git commit: No repo available');
      }
    } else if (gitRevParse.error.code === 'ENOENT') {
      console.log('Could not fetch git commit: Command `git` is unavailable');
    }
  }
  return '?';
}

const versionInfo = {
  version: getVersion(),
  gitCommit: getGitCommit()
}

fs.writeFileSync(
  path.join(__dirname, 'version.json'),
  JSON.stringify(versionInfo, null, 2) + "\n"
);
