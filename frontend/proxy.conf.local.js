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
      target: `http://localhost:8999`,
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
      target: `http://localhost:8999`,
      secure: false,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/liquid/api/": "/api/v1/"
      },
    },
    {
      context: ['/liquidtestnet/api/v1/**'],
      target: `http://localhost:8999`,
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
      target: `http://localhost:8999`,
      secure: false,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/liquidtestnet/api/": "/api/v1/"
      },
    },
  ]);
}


if (configContent && configContent.BASE_MODULE === 'bisq') {
  PROXY_CONFIG.push(...[
    {
      context: ['/bisq/api/v1/ws'],
      target: `http://localhost:8999`,
      secure: false,
      ws: true,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/bisq": ""
      },
    },
    {
      context: ['/bisq/api/v1/**'],
      target: `http://localhost:8999`,
      secure: false,
      changeOrigin: true,
      proxyTimeout: 30000,
    },
    {
      context: ['/bisq/api/**'],
      target: `http://localhost:8999`,
      secure: false,
      changeOrigin: true,
      proxyTimeout: 30000,
      pathRewrite: {
          "^/bisq/api/": "/api/v1/bisq/"
      },
    }
  ]);
}

PROXY_CONFIG.push(...[
  {
    context: ['/lightning/api/v1/**'],
    target: `http://localhost:8899`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/lightning/api": "/api"
    },
  },
  {
    context: ['/api/v1/**'],
    target: `http://localhost:8999`,
    secure: false,
    ws: true,
    changeOrigin: true,
    proxyTimeout: 30000,
  },
  {
    context: ['/api/**'],
    target: `http://localhost:8999`,
    secure: false,
    changeOrigin: true,
    proxyTimeout: 30000,
    pathRewrite: {
        "^/api/": "/api/v1/"
    },
  }
]);

console.log(PROXY_CONFIG);

module.exports = PROXY_CONFIG;