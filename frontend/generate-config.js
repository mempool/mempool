var fs = require('fs');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const GENERATED_CONFIG_FILE_NAME = 'generated-config.js';

let settings = [];
let configContent = {};

try {
  const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
  configContent = JSON.parse(rawConfig);
} catch (e) {
  if (e.code !== 'ENOENT') {
    throw new Error(e);
  }
}

for (setting in configContent) {
  settings.push({
    key: setting,
    value: configContent[setting]
  });
}

const code = `(function (window) {
  window.__env = window.__env || {};${settings.reduce((str, obj) => `${str}
    window.__env.${obj.key} = ${ typeof obj.value === 'string' ? `'${obj.value}'` : obj.value };`, '')}
  }(this));`;

try {
  fs.writeFileSync(GENERATED_CONFIG_FILE_NAME, code, 'utf8');
} catch (e) {
  throw new Error(e);
}

console.log('Config file generated');