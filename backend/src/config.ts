const configFile = require('../mempool-config.json');

interface IConfig {
  MEMPOOL: {
    NETWORK: 'mainnet' | 'testnet' | 'liquid';
    HTTP_PORT: number;
    MINED_BLOCKS_CACHE: number;
    SPAWN_CLUSTER_PROCS: number;
    API_URL_PREFIX: string;
    WEBSOCKET_REFRESH_RATE_MS: number;
  };
  ELECTRS: {
    REST_API_URL: string;
    POLL_RATE_MS: number;
  };
  DATABASE: {
    ENABLED: boolean;
    HOST: string,
    PORT: number;
    DATABASE: string;
    USERNAME: string;
    PASSWORD: string;
  };
  STATISTICS: {
    ENABLED: boolean;
    TX_PER_SECOND_SAMPLE_PERIOD: number;
  };
  BISQ_BLOCKS: {
    ENABLED: boolean;
    DATA_PATH: string;
  };
  BISQ_MARKETS: {
    ENABLED: boolean;
    DATA_PATH: string;
  };
  SPONSORS: {
    ENABLED: boolean;
    BTCPAY_URL: string;
    BTCPAY_AUTH: string;
    BTCPAY_WEBHOOK_URL: string;
    TWITTER_BEARER_AUTH: string;
  };
}

const defaults: IConfig = {
  'MEMPOOL': {
    'NETWORK': 'mainnet',
    'HTTP_PORT': 8999,
    'MINED_BLOCKS_CACHE': 144,
    'SPAWN_CLUSTER_PROCS': 0,
    'API_URL_PREFIX': '/api/v1/',
    'WEBSOCKET_REFRESH_RATE_MS': 2000
  },
  'ELECTRS': {
    'REST_API_URL': 'http://127.0.0.1:3000',
    'POLL_RATE_MS': 2000
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

class Config implements IConfig {
  MEMPOOL: IConfig['MEMPOOL'];
  ELECTRS: IConfig['ELECTRS'];
  DATABASE: IConfig['DATABASE'];
  STATISTICS: IConfig['STATISTICS'];
  BISQ_BLOCKS: IConfig['BISQ_BLOCKS'];
  BISQ_MARKETS: IConfig['BISQ_MARKETS'];
  SPONSORS: IConfig['SPONSORS'];

  constructor() {
    const configs = this.merge(configFile, defaults);
    this.MEMPOOL = configs.MEMPOOL;
    this.ELECTRS = configs.ELECTRS;
    this.DATABASE = configs.DATABASE;
    this.STATISTICS = configs.STATISTICS;
    this.BISQ_BLOCKS = configs.BISQ_BLOCKS;
    this.BISQ_MARKETS = configs.BISQ_MARKETS;
    this.SPONSORS = configs.SPONSORS;
  }

  merge = (...objects: object[]): IConfig => {
    // @ts-ignore
    return objects.reduce((prev, next) => {
      Object.keys(prev).forEach(key => {
        next[key] = { ...next[key], ...prev[key] };
      });
      return next;
    });
  }
}

export default new Config();
