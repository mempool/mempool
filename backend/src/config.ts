const configFromFile = require(
    process.env.MEMPOOL_CONFIG_FILE ? process.env.MEMPOOL_CONFIG_FILE : '../mempool-config.json'
);

interface IConfig {
  MEMPOOL: {
    ENABLED: boolean;
    OFFICIAL: boolean;
    NETWORK: 'mainnet' | 'testnet' | 'signet' | 'liquid' | 'liquidtestnet';
    BACKEND: 'esplora' | 'electrum' | 'none';
    HTTP_PORT: number;
    UNIX_SOCKET_PATH: string;
    SPAWN_CLUSTER_PROCS: number;
    API_URL_PREFIX: string;
    POLL_RATE_MS: number;
    CACHE_DIR: string;
    CACHE_ENABLED: boolean;
    CLEAR_PROTECTION_MINUTES: number;
    RECOMMENDED_FEE_PERCENTILE: number;
    BLOCK_WEIGHT_UNITS: number;
    INITIAL_BLOCKS_AMOUNT: number;
    MEMPOOL_BLOCKS_AMOUNT: number;
    INDEXING_BLOCKS_AMOUNT: number;
    BLOCKS_SUMMARIES_INDEXING: boolean;
    GOGGLES_INDEXING: boolean;
    USE_SECOND_NODE_FOR_MINFEE: boolean;
    EXTERNAL_ASSETS: string[];
    EXTERNAL_MAX_RETRY: number;
    EXTERNAL_RETRY_INTERVAL: number;
    USER_AGENT: string;
    STDOUT_LOG_MIN_PRIORITY: 'emerg' | 'alert' | 'crit' | 'err' | 'warn' | 'notice' | 'info' | 'debug';
    AUTOMATIC_POOLS_UPDATE: boolean;
    POOLS_JSON_URL: string,
    POOLS_JSON_TREE_URL: string,
    POOLS_UPDATE_DELAY: number,
    AUDIT: boolean;
    RUST_GBT: boolean;
    LIMIT_GBT: boolean;
    CPFP_INDEXING: boolean;
    MAX_BLOCKS_BULK_QUERY: number;
    DISK_CACHE_BLOCK_INTERVAL: number;
    MAX_PUSH_TX_SIZE_WEIGHT: number;
    ALLOW_UNREACHABLE: boolean;
    PRICE_UPDATES_PER_HOUR: number;
    MAX_TRACKED_ADDRESSES: number;
  };
  ESPLORA: {
    REST_API_URL: string;
    UNIX_SOCKET_PATH: string | void | null;
    BATCH_QUERY_BASE_SIZE: number;
    RETRY_UNIX_SOCKET_AFTER: number;
    REQUEST_TIMEOUT: number;
    FALLBACK_TIMEOUT: number;
    FALLBACK: string[];
    MAX_BEHIND_TIP: number;
  };
  LIGHTNING: {
    ENABLED: boolean;
    BACKEND: 'lnd' | 'cln' | 'ldk';
    TOPOLOGY_FOLDER: string;
    STATS_REFRESH_INTERVAL: number;
    GRAPH_REFRESH_INTERVAL: number;
    LOGGER_UPDATE_INTERVAL: number;
    FORENSICS_INTERVAL: number;
    FORENSICS_RATE_LIMIT: number;
  };
  LND: {
    TLS_CERT_PATH: string;
    MACAROON_PATH: string;
    REST_API_URL: string;
    TIMEOUT: number;
  };
  CLIGHTNING: {
    SOCKET: string;
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
    TIMEOUT: number;
    COOKIE: boolean;
    COOKIE_PATH: string;
    DEBUG_LOG_PATH: string;
  };
  SECOND_CORE_RPC: {
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
    TIMEOUT: number;
    COOKIE: boolean;
    COOKIE_PATH: string;
  };
  DATABASE: {
    ENABLED: boolean;
    HOST: string,
    SOCKET: string,
    PORT: number;
    DATABASE: string;
    USERNAME: string;
    PASSWORD: string;
    TIMEOUT: number;
    PID_DIR: string;
    POOL_SIZE: number;
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
  SOCKS5PROXY: {
    ENABLED: boolean;
    USE_ONION: boolean;
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
  };
  EXTERNAL_DATA_SERVER: {
    MEMPOOL_API: string;
    MEMPOOL_ONION: string;
    LIQUID_API: string;
    LIQUID_ONION: string;
  };
  MAXMIND: {
    ENABLED: boolean;
    GEOLITE2_CITY: string;
    GEOLITE2_ASN: string;
    GEOIP2_ISP: string;
  },
  REPLICATION: {
    ENABLED: boolean;
    AUDIT: boolean;
    AUDIT_START_HEIGHT: number;
    STATISTICS: boolean;
    STATISTICS_START_TIME: number | string;
    SERVERS: string[];
  },
  MEMPOOL_SERVICES: {
    API: string;
    ACCELERATIONS: boolean;
  },
  REDIS: {
    ENABLED: boolean;
    UNIX_SOCKET_PATH: string;
    BATCH_QUERY_BASE_SIZE: number;
  },
  FIAT_PRICE: {
    ENABLED: boolean;
    PAID: boolean;
    API_KEY: string;
  },
  WALLETS: {
    ENABLED: boolean;
    WALLETS: string[];
  }
}

const defaults: IConfig = {
  'MEMPOOL': {
    'ENABLED': true,
    'OFFICIAL': false,
    'NETWORK': 'mainnet',
    'BACKEND': 'none',
    'HTTP_PORT': 8999,
    'UNIX_SOCKET_PATH': '',
    'SPAWN_CLUSTER_PROCS': 0,
    'API_URL_PREFIX': '/api/v1/',
    'POLL_RATE_MS': 2000,
    'CACHE_DIR': './cache',
    'CACHE_ENABLED': true,
    'CLEAR_PROTECTION_MINUTES': 20,
    'RECOMMENDED_FEE_PERCENTILE': 50,
    'BLOCK_WEIGHT_UNITS': 4000000,
    'INITIAL_BLOCKS_AMOUNT': 8,
    'MEMPOOL_BLOCKS_AMOUNT': 8,
    'INDEXING_BLOCKS_AMOUNT': 11000, // 0 = disable indexing, -1 = index all blocks
    'BLOCKS_SUMMARIES_INDEXING': false,
    'GOGGLES_INDEXING': false,
    'USE_SECOND_NODE_FOR_MINFEE': false,
    'EXTERNAL_ASSETS': [],
    'EXTERNAL_MAX_RETRY': 1,
    'EXTERNAL_RETRY_INTERVAL': 0,
    'USER_AGENT': 'mempool',
    'STDOUT_LOG_MIN_PRIORITY': 'debug',
    'AUTOMATIC_POOLS_UPDATE': false,
    'POOLS_JSON_URL': 'https://raw.githubusercontent.com/mempool/mining-pools/master/pools-v2.json',
    'POOLS_JSON_TREE_URL': 'https://api.github.com/repos/mempool/mining-pools/git/trees/master',
    'POOLS_UPDATE_DELAY': 604800, // in seconds, default is one week
    'AUDIT': false,
    'RUST_GBT': true,
    'LIMIT_GBT': false,
    'CPFP_INDEXING': false,
    'MAX_BLOCKS_BULK_QUERY': 0,
    'DISK_CACHE_BLOCK_INTERVAL': 6,
    'MAX_PUSH_TX_SIZE_WEIGHT': 400000,
    'ALLOW_UNREACHABLE': true,
    'PRICE_UPDATES_PER_HOUR': 1,
    'MAX_TRACKED_ADDRESSES': 1,
  },
  'ESPLORA': {
    'REST_API_URL': 'http://127.0.0.1:3000',
    'UNIX_SOCKET_PATH': null,
    'BATCH_QUERY_BASE_SIZE': 1000,
    'RETRY_UNIX_SOCKET_AFTER': 30000,
    'REQUEST_TIMEOUT': 10000,
    'FALLBACK_TIMEOUT': 5000,
    'FALLBACK': [],
    'MAX_BEHIND_TIP': 2,
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
    'PASSWORD': 'mempool',
    'TIMEOUT': 60000,
    'COOKIE': false,
    'COOKIE_PATH': '/bitcoin/.cookie',
    'DEBUG_LOG_PATH': '',
  },
  'SECOND_CORE_RPC': {
    'HOST': '127.0.0.1',
    'PORT': 8332,
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool',
    'TIMEOUT': 60000,
    'COOKIE': false,
    'COOKIE_PATH': '/bitcoin/.cookie'
  },
  'DATABASE': {
    'ENABLED': true,
    'HOST': '127.0.0.1',
    'SOCKET': '',
    'PORT': 3306,
    'DATABASE': 'mempool',
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool',
    'TIMEOUT': 180000,
    'PID_DIR': '',
    'POOL_SIZE': 100,
  },
  'SYSLOG': {
    'ENABLED': true,
    'HOST': '127.0.0.1',
    'PORT': 514,
    'MIN_PRIORITY': 'info',
    'FACILITY': 'local7'
  },
  'STATISTICS': {
    'ENABLED': true,
    'TX_PER_SECOND_SAMPLE_PERIOD': 150
  },
  'LIGHTNING': {
    'ENABLED': false,
    'BACKEND': 'lnd',
    'TOPOLOGY_FOLDER': '',
    'STATS_REFRESH_INTERVAL': 600,
    'GRAPH_REFRESH_INTERVAL': 600,
    'LOGGER_UPDATE_INTERVAL': 30,
    'FORENSICS_INTERVAL': 43200,
    'FORENSICS_RATE_LIMIT': 20,
  },
  'LND': {
    'TLS_CERT_PATH': '',
    'MACAROON_PATH': '',
    'REST_API_URL': 'https://localhost:8080',
    'TIMEOUT': 10000,
  },
  'CLIGHTNING': {
    'SOCKET': '',
  },
  'SOCKS5PROXY': {
    'ENABLED': false,
    'USE_ONION': true,
    'HOST': '127.0.0.1',
    'PORT': 9050,
    'USERNAME': '',
    'PASSWORD': ''
  },
  'EXTERNAL_DATA_SERVER': {
    'MEMPOOL_API': 'https://mempool.space/api/v1',
    'MEMPOOL_ONION': 'http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/api/v1',
    'LIQUID_API': 'https://liquid.network/api/v1',
    'LIQUID_ONION': 'http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion/api/v1'
  },
  'MAXMIND': {
    'ENABLED': false,
    'GEOLITE2_CITY': '/usr/local/share/GeoIP/GeoLite2-City.mmdb',
    'GEOLITE2_ASN': '/usr/local/share/GeoIP/GeoLite2-ASN.mmdb',
    'GEOIP2_ISP': '/usr/local/share/GeoIP/GeoIP2-ISP.mmdb'
  },
  'REPLICATION': {
    'ENABLED': false,
    'AUDIT': false,
    'AUDIT_START_HEIGHT': 774000,
    'STATISTICS': false,
    'STATISTICS_START_TIME': 1481932800,
    'SERVERS': [],
  },
  'MEMPOOL_SERVICES': {
    'API': '',
    'ACCELERATIONS': false,
  },
  'REDIS': {
    'ENABLED': false,
    'UNIX_SOCKET_PATH': '',
    'BATCH_QUERY_BASE_SIZE': 5000,
  },
  'FIAT_PRICE': {
    'ENABLED': true,
    'PAID': false,
    'API_KEY': '',
  },
  'WALLETS': {
    'ENABLED': false,
    'WALLETS': [],
  },
};

class Config implements IConfig {
  MEMPOOL: IConfig['MEMPOOL'];
  ESPLORA: IConfig['ESPLORA'];
  ELECTRUM: IConfig['ELECTRUM'];
  CORE_RPC: IConfig['CORE_RPC'];
  SECOND_CORE_RPC: IConfig['SECOND_CORE_RPC'];
  DATABASE: IConfig['DATABASE'];
  SYSLOG: IConfig['SYSLOG'];
  STATISTICS: IConfig['STATISTICS'];
  LIGHTNING: IConfig['LIGHTNING'];
  LND: IConfig['LND'];
  CLIGHTNING: IConfig['CLIGHTNING'];
  SOCKS5PROXY: IConfig['SOCKS5PROXY'];
  EXTERNAL_DATA_SERVER: IConfig['EXTERNAL_DATA_SERVER'];
  MAXMIND: IConfig['MAXMIND'];
  REPLICATION: IConfig['REPLICATION'];
  MEMPOOL_SERVICES: IConfig['MEMPOOL_SERVICES'];
  REDIS: IConfig['REDIS'];
  FIAT_PRICE: IConfig['FIAT_PRICE'];
  WALLETS: IConfig['WALLETS'];

  constructor() {
    const configs = this.merge(configFromFile, defaults);
    this.MEMPOOL = configs.MEMPOOL;
    this.ESPLORA = configs.ESPLORA;
    this.ELECTRUM = configs.ELECTRUM;
    this.CORE_RPC = configs.CORE_RPC;
    this.SECOND_CORE_RPC = configs.SECOND_CORE_RPC;
    this.DATABASE = configs.DATABASE;
    this.SYSLOG = configs.SYSLOG;
    this.STATISTICS = configs.STATISTICS;
    this.LIGHTNING = configs.LIGHTNING;
    this.LND = configs.LND;
    this.CLIGHTNING = configs.CLIGHTNING;
    this.SOCKS5PROXY = configs.SOCKS5PROXY;
    this.EXTERNAL_DATA_SERVER = configs.EXTERNAL_DATA_SERVER;
    this.MAXMIND = configs.MAXMIND;
    this.REPLICATION = configs.REPLICATION;
    this.MEMPOOL_SERVICES = configs.MEMPOOL_SERVICES;
    this.REDIS = configs.REDIS;
    this.FIAT_PRICE = configs.FIAT_PRICE;
    this.WALLETS = configs.WALLETS;
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
