const fs = require('fs');

const CONFIG_FILE = 'mempool-frontend-config.json';

module.exports = (on, config) => {
  if (fs.existsSync(CONFIG_FILE)) {
    let contents = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config.env.BASE_MODULE = contents.BASE_MODULE ? contents.BASE_MODULE : 'mempool';
  } else {
    config.env.BASE_MODULE = 'mempool';
  }
  return config;
}
