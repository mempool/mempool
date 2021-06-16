var fs = require('fs');
const { execSync } = require('child_process');

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
  const command = 'git rev-parse --short HEAD';
  gitCommitHash = execSync(command).toString('utf8').replace(/[\n\r\s]+$/, '');
} catch (e) {
  console.log('Could not load git commit info: ' + e.message || e);
}

const newConfig = `(function (window) {
  window.__env = window.__env || {};${settings.reduce((str, obj) => `${str}
    window.__env.${obj.key} = ${ typeof obj.value === 'string' ? `'${obj.value}'` : obj.value };`, '')}
    window.__env.GIT_COMMIT_HASH = '${gitCommitHash}';
    window.__env.PACKAGE_JSON_VERSION = '${packetJsonVersion}';
  }(global || this));`;

try {
  const currentConfig = fs.readFileSync(GENERATED_CONFIG_FILE_NAME).toString().trim();
  if (currentConfig === newConfig) {
    console.log("Configuration not changed, skipping generation");
  } else {
    try {
      fs.writeFileSync(GENERATED_CONFIG_FILE_NAME, newConfig, 'utf8');
      console.log('Config file generated');
    } catch (e) {
      throw new Error(e);
    }
  }
} catch (e) {
  throw new Error(e);
}
