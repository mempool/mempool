
const fs = require('fs');

let PROXY_CONFIG = require('./proxy.conf.js');
const BACKEND_CONFIG_FILE_NAME = '../backend/mempool-config.json';
const FRONTEND_CONFIG_FILE_NAME = 'mempool-frontend-config.json';

let backendConfigContent;
let frontendConfigContent;

// Read frontend config 
try {
    const rawConfig = fs.readFileSync(FRONTEND_CONFIG_FILE_NAME);
    frontendConfigContent = JSON.parse(rawConfig);
    console.log(`${FRONTEND_CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
    console.log(e);
    if (e.code !== 'ENOENT') {
      throw new Error(e);
  } else {
      console.log(`${FRONTEND_CONFIG_FILE_NAME} file not found, using default config`);
  }
}

// Read backend config
try {
    const rawConfig = fs.readFileSync(BACKEND_CONFIG_FILE_NAME);
    backendConfigContent = JSON.parse(rawConfig);
    console.log(`${BACKEND_CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
    console.log(e);
    if (e.code !== 'ENOENT') {
      throw new Error(e);
  } else {
      console.log(`${BACKEND_CONFIG_FILE_NAME} file not found, using default config`);
  }
}

// Remove the "/api/**" entry from the default proxy config
let localDevContext = PROXY_CONFIG[0].context

localDevContext.splice(PROXY_CONFIG[0].context.indexOf('/api/**'), 1);

PROXY_CONFIG[0].context = localDevContext;

// Change all targets to localhost
PROXY_CONFIG.map(conf => conf.target = "http://localhost:8999");

// Add rules for local backend
if (backendConfigContent) {
    PROXY_CONFIG.push({
        context: ['/api/v1/**'],
        target: `http://localhost:8999`,
        secure: false,
        changeOrigin: true,
        proxyTimeout: 30000
    });
    PROXY_CONFIG.push({
        context: ['/api/**'],
        target: `http://localhost:8999`,
        secure: false,
        changeOrigin: true,
        proxyTimeout: 30000,
        pathRewrite: {
            "^/api/": "/api/v1/"
        },
    });
}

console.log(PROXY_CONFIG);

module.exports = PROXY_CONFIG;