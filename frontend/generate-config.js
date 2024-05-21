var fs = require('fs');
const { spawnSync } = require('child_process');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const GENERATED_CONFIG_FILE_NAME = 'src/resources/config.js';
const GENERATED_TEMPLATE_CONFIG_FILE_NAME = 'src/resources/config.template.js';
const GENERATED_CUSTOMIZATION_FILE_NAME = 'src/resources/customize.js';

let settings = [];
let configContent = {};
let gitCommitHash = '';
let packetJsonVersion = '';
let customConfig;
let customConfigContent;

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

if (configContent && configContent.CUSTOMIZATION) {
  try {
    customConfig = readConfig(configContent.CUSTOMIZATION);
    customConfigContent = JSON.parse(customConfig);
  } catch (e) {
    console.log(`failed to load customization config from ${configContent.CUSTOMIZATION}`);
  }
}

const baseModuleName = configContent.BASE_MODULE || 'mempool';
const customBuildName = (customConfigContent && customConfigContent.enterprise) ? ('.' + customConfigContent.enterprise) : '';
const indexFilePath = 'src/index.' + baseModuleName + customBuildName + '.html';

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
    window.__env.${obj.key} = ${typeof obj.value === 'string' ? `'${obj.value}'` : obj.value};`, '')}
    window.__env.GIT_COMMIT_HASH = '${gitCommitHash}';
    window.__env.PACKAGE_JSON_VERSION = '${packetJsonVersion}';
  }((typeof global !== 'undefined') ? global : this));`;

const newConfigTemplate = `(function (window) {
  window.__env = window.__env || {};${settings.reduce((str, obj) => `${str}
    window.__env.${obj.key} = ${typeof obj.value === 'string' ? `'\${__${obj.key}__}'` : `\${__${obj.key}__}`};`, '')}
    window.__env.GIT_COMMIT_HASH = '${gitCommitHash}';
    window.__env.PACKAGE_JSON_VERSION = '${packetJsonVersion}';
  }(this));`;

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

function writeConfigTemplate(path, config) {
  try {
    fs.writeFileSync(path, config, 'utf8');
  } catch (e) {
    throw new Error(e);
  }
}

writeConfigTemplate(GENERATED_TEMPLATE_CONFIG_FILE_NAME, newConfigTemplate);

const currentConfig = readConfig(GENERATED_CONFIG_FILE_NAME);

let customConfigJs = '';
if (customConfig) {
  console.log(`Customizing frontend using ${configContent.CUSTOMIZATION}`);
  customConfigJs = `(function (window) {
    window.__env = window.__env || {};
    window.__env.customize = ${customConfig};
    }((typeof global !== 'undefined') ? global : this));
  `;
}
writeConfig(GENERATED_CUSTOMIZATION_FILE_NAME, customConfigJs);

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
}
