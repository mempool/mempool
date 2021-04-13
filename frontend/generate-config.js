var fs = require('fs');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const GENERATED_CONFIG_FILE_NAME = 'generated-config.js';

let settings = [];
let configContent = {};
let gitCommitHash = '';
let packetJsonVersion = '';

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw new Error(e);
  }
}

try {
  const packageJson = fs.readFileSync('package.json');
  packetJsonVersion = JSON.parse(packageJson).version;
} catch (e) {
  throw new Error(e);
}

for (setting in configContent) {
  settings.push({
    key: setting,
    value: configContent[setting]
  });
}

try {
  gitCommitHash = fs.readFileSync('../.git/refs/heads/master').toString().trim();
} catch (e) {
  console.log('Could not load git commit info: ' + e.message || e);
}

const code = `(function (window) {
  window.__env = window.__env || {};${settings.reduce((str, obj) => `${str}
    window.__env.${obj.key} = ${ typeof obj.value === 'string' ? `'${obj.value}'` : obj.value };`, '')}
    window.__env.GIT_COMMIT_HASH = '${gitCommitHash}';
    window.__env.PACKAGE_JSON_VERSION = '${packetJsonVersion}';
  }(global || this));`;

try {
  fs.writeFileSync(GENERATED_CONFIG_FILE_NAME, code, 'utf8');
} catch (e) {
  throw new Error(e);
}

console.log('Config file generated');