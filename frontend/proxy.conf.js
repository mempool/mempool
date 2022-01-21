const fs = require('fs');

let PROXY_CONFIG;
let configContent;

const CONFIG_FILE_NAME = 'mempool-frontend-config.json';

try {
    const rawConfig = fs.readFileSync(CONFIG_FILE_NAME);
    configContent = JSON.parse(rawConfig);
    console.log(`${CONFIG_FILE_NAME} file found, using provided config`);
} catch (e) {
    console.log(e);
    if (e.code !== 'ENOENT') {
      throw new Error(e);
  } else {
      console.log(`${CONFIG_FILE_NAME} file not found, using default config`);
  }
}

PROXY_CONFIG = [
    {
        context: ['*', 
        '/api/**', '!/api/v1/ws', 
        '!/bisq', '!/bisq/**', '!/bisq/',
        '!/liquid', '!/liquid/**', '!/liquid/',
        '!/liquidtestnet', '!/liquidtestnet/**', '!/liquidtestnet/',
        '/testnet/api/**', '/signet/api/**'
        ],
        target: "https://mempool.space",
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/api/v1/ws'],
        target: "https://mempool.space",
        ws: true,
        secure: false,
        changeOrigin: true,
    },
    {
        context: ['/api/bisq**', '/bisq/api/**'],
        target: "https://bisq.markets",
        pathRewrite: {
            "^/api/bisq/": "/bisq/api"
        },
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/api/liquid**', '/liquid/api/**'],
        target: "https://liquid.network",
        pathRewrite: {
            "^/api/liquid/": "/liquid/api"
        },
        ws: true,
        secure: false,
        changeOrigin: true
    },
    {
        context: ['/api/liquidtestnet**', '/liquidtestnet/api/**'],
        target: "https://liquid.network",
        ws: true,
        secure: false,
        changeOrigin: true
    }
];

if (configContent && configContent.BASE_MODULE == "liquid") {
    PROXY_CONFIG.push({
        context: ['/resources/pools.json',
            '/resources/assets.json', '/resources/assets.minimal.json',
            '/resources/assets-testnet.json', '/resources/assets-testnet.minimal.json'],
        target: "https://liquid.network",
        secure: false,
        changeOrigin: true,
    });
} else {
    PROXY_CONFIG.push({
        context: ['/resources/pools.json', '/resources/assets.json', '/resources/assets.minimal.json'],
        target: "https://mempool.space",
        secure: false,
        changeOrigin: true,
    });
}

module.exports = PROXY_CONFIG;
