const configFile = require('../mempool-config.json');

interface IConfig {
  MEMPOOL: {
    NETWORK: 'mainnet' | 'testnet' | 'signet' | 'liquid';
    BACKEND: 'esplora' | 'electrum' | 'none';
    HTTP_PORT: number;
    SPAWN_CLUSTER_PROCS: number;
    API_URL_PREFIX: string;
    POLL_RATE_MS: number;
    CACHE_DIR: string;
    CLEAR_PROTECTION_MINUTES: number;
    RECOMMENDED_FEE_PERCENTILE: number;
  };
  ESPLORA: {
    REST_API_URL: string;
  };
  ELECTRUM: {
    HOST: string;
    PORT: number;
    TLS_ENABLED: boolean;
  };
  CORE_RPC: {
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
  };
  CORE_RPC_MINFEE: {
    ENABLED: boolean;
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
  };
  DATABASE: {
    ENABLED: boolean;
    HOST: string;
    PORT: number;
    DATABASE: string;
    USERNAME: string;
    PASSWORD: string;
  };
  SYSLOG: {
    ENABLED: boolean;
    HOST: string;
    PORT: number;
    MIN_PRIORITY: 'emerg' | 'alert' | 'crit' | 'err' | 'warn' | 'notice' | 'info' | 'debug';
    FACILITY: string;
  };
  STATISTICS: {
    ENABLED: boolean;
    TX_PER_SECOND_SAMPLE_PERIOD: number;
  };
  BISQ: {
    ENABLED: boolean;
    DATA_PATH: string;
  };
}

const defaults: IConfig = {
  MEMPOOL: {
    NETWORK: 'mainnet',
    BACKEND: 'none',
    HTTP_PORT: 8999,
    SPAWN_CLUSTER_PROCS: 0,
    API_URL_PREFIX: '/api/v1/',
    POLL_RATE_MS: 2000,
    CACHE_DIR: './cache',
    CLEAR_PROTECTION_MINUTES: 20,
    RECOMMENDED_FEE_PERCENTILE: 50,
  },
  ESPLORA: {
    REST_API_URL: 'http://127.0.0.1:3000',
  },
  ELECTRUM: {
    HOST: '127.0.0.1',
    PORT: 3306,
    TLS_ENABLED: true,
  },
  CORE_RPC: {
    HOST: '127.0.0.1',
    PORT: 8332,
    USERNAME: 'mempool',
    PASSWORD: 'mempool',
  },
  CORE_RPC_MINFEE: {
    ENABLED: false,
    HOST: '127.0.0.1',
    PORT: 8332,
    USERNAME: 'mempool',
    PASSWORD: 'mempool',
  },
  DATABASE: {
    ENABLED: true,
    HOST: '127.0.0.1',
    PORT: 3306,
    DATABASE: 'mempool',
    USERNAME: 'mempool',
    PASSWORD: 'mempool',
  },
  SYSLOG: {
    ENABLED: true,
    HOST: '127.0.0.1',
    PORT: 514,
    MIN_PRIORITY: 'info',
    FACILITY: 'local7',
  },
  STATISTICS: {
    ENABLED: true,
    TX_PER_SECOND_SAMPLE_PERIOD: 150,
  },
  BISQ: {
    ENABLED: false,
    DATA_PATH: '/bisq/statsnode-data/btc_mainnet/db',
  },
};

class Config implements IConfig {
  MEMPOOL: IConfig['MEMPOOL'];
  ESPLORA: IConfig['ESPLORA'];
  ELECTRUM: IConfig['ELECTRUM'];
  CORE_RPC: IConfig['CORE_RPC'];
  CORE_RPC_MINFEE: IConfig['CORE_RPC_MINFEE'];
  DATABASE: IConfig['DATABASE'];
  SYSLOG: IConfig['SYSLOG'];
  STATISTICS: IConfig['STATISTICS'];
  BISQ: IConfig['BISQ'];

  constructor() {
    const configs = this.merge(configFile, defaults);
    this.MEMPOOL = configs.MEMPOOL;
    this.ESPLORA = configs.ESPLORA;
    this.ELECTRUM = configs.ELECTRUM;
    this.CORE_RPC = configs.CORE_RPC;
    this.CORE_RPC_MINFEE = configs.CORE_RPC_MINFEE;
    this.DATABASE = configs.DATABASE;
    this.SYSLOG = configs.SYSLOG;
    this.STATISTICS = configs.STATISTICS;
    this.BISQ = configs.BISQ;
  }

  merge = (...objects: object[]): IConfig => {
    // @ts-ignore
    return objects.reduce((prev, next) => {
      Object.keys(prev).forEach(key => {
        next[key] = { ...next[key], ...prev[key] };
      });
      return next;
    });
  };
}

export default new Config();
