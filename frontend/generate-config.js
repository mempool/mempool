var fs = require('fs');
const { spawnSync } = require('child_process');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const GENERATED_CONFIG_FILE_NAME = 'generated-config.js';

let settings = [];
let configContent = {};
let gitCommitHash = '';
let packetJsonVersion = '';

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
  console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw new Error(e);
  } else {
    console.log(`${CONFIG_FILE_NAME} file not found, using default config`);
  }
}

const indexFilePath = configContent.BASE_MODULE ? 'src/index.' + configContent.BASE_MODULE + '.html' : 'src/index.mempool.html';

try {
  fs.copyFileSync(indexFilePath, 'src/index.html');
  console.log('Copied ' + indexFilePath + ' to src/index.html');
} catch (e) {
  console.log('Error copying the index file');
  throw new Error(e);
}

try {
  const packageJson = fs.readFileSync('package.json');
  packetJsonVersion = JSON.parse(packageJson).version;
  console.log(`mempool version ${packetJsonVersion}`);
} catch (e) {
  throw new Error(e);
}

for (setting in configContent) {
  settings.push({
    key: setting,
    value: configContent[setting]
  });
}

if (process.env.DOCKER_COMMIT_HASH) {
  gitCommitHash = process.env.DOCKER_COMMIT_HASH;
} else {
  try {
    const gitRevParse = spawnSync('git', ['rev-parse', '--short', 'HEAD']);
    if (!gitRevParse.error) {
      const output = gitRevParse.stdout.toString('utf-8').replace(/[\n\r\s]+$/, '');
      gitCommitHash = output ? output : '?';
      console.log(`mempool revision ${gitCommitHash}`);
    } else if (gitRevParse.error.code === 'ENOENT') {
      console.log('git not found, cannot parse git hash');
      gitCommitHash = '?';
    }
  } catch (e) {
    console.log('Could not load git commit info: ' + e.message);
    gitCommitHash = '?';
  }
}

const newConfig = `(function (window) {
  window.__env = window.__env || {};${settings.reduce((str, obj) => `${str}
    window.__env.${obj.key} = ${ typeof obj.value === 'string' ? `'${obj.value}'` : obj.value };`, '')}
    window.__env.GIT_COMMIT_HASH = '${gitCommitHash}';
    window.__env.PACKAGE_JSON_VERSION = '${packetJsonVersion}';
  }(global || this));`;

function readConfig(path) {
  try {
    const currentConfig = fs.readFileSync(path).toString().trim();
    return currentConfig;
  } catch (e) {
    return false;
  }
}

function writeConfig(path, config) {
  try {
    fs.writeFileSync(path, config, 'utf8');
  } catch (e) {
    throw new Error(e);
  }
}

const currentConfig = readConfig(GENERATED_CONFIG_FILE_NAME);

if (currentConfig && currentConfig === newConfig) {
  console.log(`No configuration updates, skipping ${GENERATED_CONFIG_FILE_NAME} file update`);
  return;
} else if (!currentConfig) {
  console.log(`${GENERATED_CONFIG_FILE_NAME} file not found, creating new config file`);
  console.log('CONFIG: ', newConfig);
  writeConfig(GENERATED_CONFIG_FILE_NAME, newConfig);
  console.log(`${GENERATED_CONFIG_FILE_NAME} file saved`);
  return;
} else {
  console.log(`Configuration changes detected, updating ${GENERATED_CONFIG_FILE_NAME} file`);
  console.log('OLD CONFIG: ', currentConfig);
  console.log('NEW CONFIG: ', newConfig);
  writeConfig(GENERATED_CONFIG_FILE_NAME, newConfig);
  console.log(`${GENERATED_CONFIG_FILE_NAME} file updated`);
};
