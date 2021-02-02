"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const configFile = require('../mempool-config.json');
const defaults = {
    'MEMPOOL': {
        'NETWORK': 'mainnet',
        'BACKEND': 'none',
        'HTTP_PORT': 8999,
        'SPAWN_CLUSTER_PROCS': 0,
        'API_URL_PREFIX': '/api/v1/',
        'POLL_RATE_MS': 2000,
        'CACHE_DIR': './'
    },
    'ESPLORA': {
        'REST_API_URL': 'http://127.0.0.1:3000',
    },
    'ELECTRUM': {
        'HOST': '127.0.0.1',
        'PORT': 3306,
        'TLS_ENABLED': true,
    },
    'CORE_RPC': {
        'HOST': '127.0.0.1',
        'PORT': 8332,
        'USERNAME': 'mempool',
        'PASSWORD': 'mempool'
    },
    'CORE_RPC_MINFEE': {
        'ENABLED': false,
        'HOST': '127.0.0.1',
        'PORT': 8332,
        'USERNAME': 'mempool',
        'PASSWORD': 'mempool'
    },
    'DATABASE': {
        'ENABLED': true,
        'HOST': 'localhost',
        'PORT': 3306,
        'DATABASE': 'mempool',
        'USERNAME': 'mempool',
        'PASSWORD': 'mempool'
    },
    'STATISTICS': {
        'ENABLED': true,
        'TX_PER_SECOND_SAMPLE_PERIOD': 150
    },
    'BISQ_BLOCKS': {
        'ENABLED': false,
        'DATA_PATH': '/bisq/statsnode-data/btc_mainnet/db/json'
    },
    'BISQ_MARKETS': {
        'ENABLED': false,
        'DATA_PATH': '/bisq/statsnode-data/btc_mainnet/db'
    },
    'SPONSORS': {
        'ENABLED': false,
        'BTCPAY_URL': '',
        'BTCPAY_AUTH': '',
        'BTCPAY_WEBHOOK_URL': '',
        'TWITTER_BEARER_AUTH': ''
    }
};
class Config {
    constructor() {
        this.merge = (...objects) => {
            // @ts-ignore
            return objects.reduce((prev, next) => {
                Object.keys(prev).forEach(key => {
                    next[key] = { ...next[key], ...prev[key] };
                });
                return next;
            });
        };
        const configs = this.merge(configFile, defaults);
        this.MEMPOOL = configs.MEMPOOL;
        this.ESPLORA = configs.ESPLORA;
        this.ELECTRUM = configs.ELECTRUM;
        this.CORE_RPC = configs.CORE_RPC;
        this.CORE_RPC_MINFEE = configs.CORE_RPC_MINFEE;
        this.DATABASE = configs.DATABASE;
        this.STATISTICS = configs.STATISTICS;
        this.BISQ_BLOCKS = configs.BISQ_BLOCKS;
        this.BISQ_MARKETS = configs.BISQ_MARKETS;
        this.SPONSORS = configs.SPONSORS;
    }
}
exports.default = new Config();
