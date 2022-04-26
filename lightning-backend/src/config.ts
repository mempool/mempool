const configFile = require('../mempool-config.json');

interface IConfig {
  MEMPOOL: {
    NETWORK: 'mainnet' | 'testnet' | 'signet';
    BACKEND: 'lnd' | 'cln' | 'ldk';
    HTTP_PORT: number;
    API_URL_PREFIX: string;
    STDOUT_LOG_MIN_PRIORITY: 'emerg' | 'alert' | 'crit' | 'err' | 'warn' | 'notice' | 'info' | 'debug';
  };
  SYSLOG: {
    ENABLED: boolean;
    HOST: string;
    PORT: number;
    MIN_PRIORITY: 'emerg' | 'alert' | 'crit' | 'err' | 'warn' | 'notice' | 'info' | 'debug';
    FACILITY: string;
  };
  LN_NODE_AUTH: {
    TSL_CERT_PATH: string;
    MACAROON_PATH: string;
  };
  DATABASE: {
    HOST: string,
    SOCKET: string,
    PORT: number;
    DATABASE: string;
    USERNAME: string;
    PASSWORD: string;
  };
}

const defaults: IConfig = {
  'MEMPOOL': {
    'NETWORK': 'mainnet',
    'BACKEND': 'lnd',
    'HTTP_PORT': 8999,
    'API_URL_PREFIX': '/api/v1/',
    'STDOUT_LOG_MIN_PRIORITY': 'debug',
  },
  'SYSLOG': {
    'ENABLED': true,
    'HOST': '127.0.0.1',
    'PORT': 514,
    'MIN_PRIORITY': 'info',
    'FACILITY': 'local7'
  },
  'LN_NODE_AUTH': {
    'TSL_CERT_PATH': '',
    'MACAROON_PATH': '',
  },
  'DATABASE': {
    'HOST': '127.0.0.1',
    'SOCKET': '',
    'PORT': 3306,
    'DATABASE': 'mempool',
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool'
  },
};

class Config implements IConfig {
  MEMPOOL: IConfig['MEMPOOL'];
  SYSLOG: IConfig['SYSLOG'];
  LN_NODE_AUTH: IConfig['LN_NODE_AUTH'];
  DATABASE: IConfig['DATABASE'];

  constructor() {
    const configs = this.merge(configFile, defaults);
    this.MEMPOOL = configs.MEMPOOL;
    this.SYSLOG = configs.SYSLOG;
    this.LN_NODE_AUTH = configs.LN_NODE_AUTH;
    this.DATABASE = configs.DATABASE;
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
