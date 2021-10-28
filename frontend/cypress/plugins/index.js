const fs = require('fs');

const CONFIG_FILE = 'mempool-frontend-config.json';

module.exports = (on, config) => {
  if (fs.existsSync(CONFIG_FILE)) {
    let contents = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    console.log(contents);
    config.env.BASE_MODULE = contents.BASE_MODULE;
  } else {
    config.env.BASE_MODULE = 'mempool';
  }
  return config;
}
