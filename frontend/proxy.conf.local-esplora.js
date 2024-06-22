const fs = require('fs');

const FRONTEND_CONFIG_FILE_NAME = 'mempool-frontend-config.json';

let configContent;

// Read frontend config 
try {
    const rawConfig = fs.readFileSync(FRONTEND_CONFIG_FILE_NAME);
    configContent = JSON.parse(rawConfig);
    console.log(`${FRONTEND_CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
    console.log(e);
    if (e.code !== 'ENOENT') {
      throw new Error(e);
  } else {
      console.log(`${FRONTEND_CONFIG_FILE_NAME} file not found, using default config`);
  }
}

let PROXY_CONFIG = [];

if (configContent && configContent.BASE_MODULE === 'liquid') {
  PROXY_CONFIG.push(...[
    {
      context: ['/liquid/api/v1/**'],
      target: `http://127.0.0.1:8999`,
      secure: false,
      ws: true,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/liquid": ""
      },
    },
    {
      context: ['/liquid/api/**'],
      target: `http://127.0.0.1:3000`,
      secure: false,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/liquid/api/": ""
      },
    },
    {
      context: ['/liquidtestnet/api/v1/**'],
      target: `http://127.0.0.1:8999`,
      secure: false,
      ws: true,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/liquidtestnet": ""
      },
    },
    {
      context: ['/liquidtestnet/api/**'],
      target: `http://127.0.0.1:3000`,
      secure: false,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/liquidtestnet/api/": "/"
      },
    },
  ]);
}

PROXY_CONFIG.push(...[
  {
    context: ['/testnet/api/v1/lightning/**'],
    target: `http://127.0.0.1:8999`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/testnet": ""
    },
  },
  /* Optional proxy to route dev to official acceleration services
  {
    context: ['/api/v1/services/accelerator/**'],
    target: `https://mempool.space/api/v1/services/accelerator/`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
      "^/api/v1/services/accelerator": ""
    },
  },
  */
  {
    context: ['/api/v1/services/**'],
    target: `http://localhost:9000`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
  },
  {
    context: ['/api/v1/**'],
    target: `http://127.0.0.1:8999`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
  },
  {
    context: ['/api/**'],
    target: `http://127.0.0.1:3000`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/api": ""
    },
  }
]);

console.log(PROXY_CONFIG);

module.exports = PROXY_CONFIG;