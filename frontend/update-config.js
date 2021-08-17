const fs = require('fs');

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';
const GENERATED_CONFIG_FILE_NAME = 'generated-config.js';

let settings = [];
let configContent = {};
const packageSettings = ['GIT_COMMIT_HASH', 'PACKAGE_JSON_VERSION']; //These will be handled by generate-config

var args = process.argv.slice(2);

function addSetting(key, value) {
    settings.push({
        key: key,
        value: value
    });
}

function normalizedValue(value) {
    if (Number(value)) {
        value = Number(value);
    } else if ((value === 'true') || (value === 'false')) {
        value = !!JSON.parse(String(value).toLowerCase());
    } else {
        value = String(value).toLowerCase();
    }
    return value;
}

function parseGeneratedFile() {
    const generatedConfig = fs.readFileSync(GENERATED_CONFIG_FILE_NAME);
    if (generatedConfig) {
      const configContents = generatedConfig.toString();
      const regexp = new RegExp(/window.__env.(\w+) = '(.*)'/,'g');
      while ((match = regexp.exec(configContents)) !== null) {
          // Do not add setting if it's the git hash or package json version
          if (!packageSettings.includes(match[1])) {
              const key = match[1];
              const value = match[2];
              console.log(typeof(value));
              addSetting(key, value);
          }
        }
    }
}

function saveSettingsJson() {
    settings.forEach(setting => {
        if (configContent.hasOwnProperty(setting['key']) && normalizedValue(configContent[setting['key']]) !== normalizedValue(setting['value'])) {
            console.log(setting['key'] + " updated from " + configContent[setting['key']] + " to " + setting['value']);
        } else if (configContent.hasOwnProperty(setting['key']) && normalizedValue(configContent[setting['key']]) === normalizedValue(setting['value'])) {
            console.log(setting['key'] + " unchanged, skipping");
        } else {
            console.log(setting['key'] + " set to " + setting['value']);
        }
        configContent[setting['key']] = setting['value'];
    });
    fs.writeFileSync(CONFIG_FILE_NAME, JSON.stringify(configContent));
}

function configToJson() {
    for (setting in configContent) {
        settings.push({
          key: setting,
          value: configContent[setting]
        });
    }
}

try {
    const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
    configContent = JSON.parse(rawConfig);
    console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
  } catch (e) {
    if (e.code !== 'ENOENT') {
      throw new Error(e);
    } else {

      if (fs.existsSync(GENERATED_CONFIG_FILE_NAME)) {
        console.log(`${CONFIG_FILE_NAME} file not found, reading current config from generated-config.js`);
        parseGeneratedFile();
      }

    }
  }

  if (args.length > 0) {
    args.forEach(setting => {
        setting = setting.split('=');
        const key = setting[0];
        let value = setting[1];
        addSetting(key, normalizedValue(value));
    });
}

saveSettingsJson();
console.log('new json',  configContent);
