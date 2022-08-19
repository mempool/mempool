const configFile = require('../mempool-config.json');

interface IConfig {
  MEMPOOL: {
    NETWORK: 'mainnet' | 'testnet' | 'signet' | 'liquid' | 'liquidtestnet';
    BACKEND: 'esplora' | 'electrum' | 'none';
    HTTP_PORT: number;
    SPAWN_CLUSTER_PROCS: number;
    API_URL_PREFIX: string;
    POLL_RATE_MS: number;
    CACHE_DIR: string;
    CLEAR_PROTECTION_MINUTES: number;
    RECOMMENDED_FEE_PERCENTILE: number;
    BLOCK_WEIGHT_UNITS: number;
    INITIAL_BLOCKS_AMOUNT: number;
    MEMPOOL_BLOCKS_AMOUNT: number;
    INDEXING_BLOCKS_AMOUNT: number;
    BLOCKS_SUMMARIES_INDEXING: boolean;
    PRICE_FEED_UPDATE_INTERVAL: number;
    USE_SECOND_NODE_FOR_MINFEE: boolean;
    EXTERNAL_ASSETS: string[];
    EXTERNAL_MAX_RETRY: number;
    EXTERNAL_RETRY_INTERVAL: number;
    USER_AGENT: string;
    STDOUT_LOG_MIN_PRIORITY: 'emerg' | 'alert' | 'crit' | 'err' | 'warn' | 'notice' | 'info' | 'debug';
    AUTOMATIC_BLOCK_REINDEXING: boolean;
    POOLS_JSON_URL: string,
    POOLS_JSON_TREE_URL: string,
  };
  ESPLORA: {
    REST_API_URL: string;
  };
  LIGHTNING: {
    ENABLED: boolean;
    BACKEND: 'lnd' | 'cln' | 'ldk';
    TOPOLOGY_FOLDER: string;
    STATS_REFRESH_INTERVAL: number;
    GRAPH_REFRESH_INTERVAL: number;
    LOGGER_UPDATE_INTERVAL: number;
  };
  LND: {
    TLS_CERT_PATH: string;
    MACAROON_PATH: string;
    REST_API_URL: string;
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
  };
  SECOND_CORE_RPC: {
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
  };
  DATABASE: {
    ENABLED: boolean;
    HOST: string,
    SOCKET: string,
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
  SOCKS5PROXY: {
    ENABLED: boolean;
    USE_ONION: boolean;
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
  };
  PRICE_DATA_SERVER: {
    TOR_URL: string;
    CLEARNET_URL: string;
  };
  EXTERNAL_DATA_SERVER: {
    MEMPOOL_API: string;
    MEMPOOL_ONION: string;
    LIQUID_API: string;
    LIQUID_ONION: string;
    BISQ_URL: string;
    BISQ_ONION: string;
  };
  MAXMIND: {
    ENABLED: boolean;
    GEOLITE2_CITY: string;
    GEOLITE2_ASN: string;
    GEOIP2_ISP: string;
  },
}

const defaults: IConfig = {
  'MEMPOOL': {
    'NETWORK': 'mainnet',
    'BACKEND': 'none',
    'HTTP_PORT': 8999,
    'SPAWN_CLUSTER_PROCS': 0,
    'API_URL_PREFIX': '/api/v1/',
    'POLL_RATE_MS': 2000,
    'CACHE_DIR': './cache',
    'CLEAR_PROTECTION_MINUTES': 20,
    'RECOMMENDED_FEE_PERCENTILE': 50,
    'BLOCK_WEIGHT_UNITS': 4000000,
    'INITIAL_BLOCKS_AMOUNT': 8,
    'MEMPOOL_BLOCKS_AMOUNT': 8,
    'INDEXING_BLOCKS_AMOUNT': 11000, // 0 = disable indexing, -1 = index all blocks
    'BLOCKS_SUMMARIES_INDEXING': false,
    'PRICE_FEED_UPDATE_INTERVAL': 600,
    'USE_SECOND_NODE_FOR_MINFEE': false,
    'EXTERNAL_ASSETS': [],
    'EXTERNAL_MAX_RETRY': 1,
    'EXTERNAL_RETRY_INTERVAL': 0,
    'USER_AGENT': 'mempool',
    'STDOUT_LOG_MIN_PRIORITY': 'debug',
    'AUTOMATIC_BLOCK_REINDEXING': false,
    'POOLS_JSON_URL': 'https://raw.githubusercontent.com/mempool/mining-pools/master/pools.json',
    'POOLS_JSON_TREE_URL': 'https://api.github.com/repos/mempool/mining-pools/git/trees/master',
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
  'SECOND_CORE_RPC': {
    'HOST': '127.0.0.1',
    'PORT': 8332,
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool'
  },
  'DATABASE': {
    'ENABLED': true,
    'HOST': '127.0.0.1',
    'SOCKET': '',
    'PORT': 3306,
    'DATABASE': 'mempool',
    'USERNAME': 'mempool',
    'PASSWORD': 'mempool'
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
  'BISQ': {
    'ENABLED': false,
    'DATA_PATH': '/bisq/statsnode-data/btc_mainnet/db'
  },
  'LIGHTNING': {
    'ENABLED': false,
    'BACKEND': 'lnd',
    'TOPOLOGY_FOLDER': '',
    'STATS_REFRESH_INTERVAL': 600,
    'GRAPH_REFRESH_INTERVAL': 600,
    'LOGGER_UPDATE_INTERVAL': 30,
  },
  'LND': {
    'TLS_CERT_PATH': '',
    'MACAROON_PATH': '',
    'REST_API_URL': 'https://localhost:8080',
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
  'PRICE_DATA_SERVER': {
    'TOR_URL': 'http://wizpriceje6q5tdrxkyiazsgu7irquiqjy2dptezqhrtu7l2qelqktid.onion/getAllMarketPrices',
    'CLEARNET_URL': 'https://price.bisq.wiz.biz/getAllMarketPrices'
  },
  'EXTERNAL_DATA_SERVER': {
    'MEMPOOL_API': 'https://mempool.space/api/v1',
    'MEMPOOL_ONION': 'http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/api/v1',
    'LIQUID_API': 'https://liquid.network/api/v1',
    'LIQUID_ONION': 'http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion/api/v1',
    'BISQ_URL': 'https://bisq.markets/api',
    'BISQ_ONION': 'http://bisqmktse2cabavbr2xjq7xw3h6g5ottemo5rolfcwt6aly6tp5fdryd.onion/api'
  },
  "MAXMIND": {
    'ENABLED': false,
    "GEOLITE2_CITY": "/usr/local/share/GeoIP/GeoLite2-City.mmdb",
    "GEOLITE2_ASN": "/usr/local/share/GeoIP/GeoLite2-ASN.mmdb",
    "GEOIP2_ISP": "/usr/local/share/GeoIP/GeoIP2-ISP.mmdb"
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
  BISQ: IConfig['BISQ'];
  LIGHTNING: IConfig['LIGHTNING'];
  LND: IConfig['LND'];
  CLIGHTNING: IConfig['CLIGHTNING'];
  SOCKS5PROXY: IConfig['SOCKS5PROXY'];
  PRICE_DATA_SERVER: IConfig['PRICE_DATA_SERVER'];
  EXTERNAL_DATA_SERVER: IConfig['EXTERNAL_DATA_SERVER'];
  MAXMIND: IConfig['MAXMIND'];

  constructor() {
    const configs = this.merge(configFile, defaults);
    this.MEMPOOL = configs.MEMPOOL;
    this.ESPLORA = configs.ESPLORA;
    this.ELECTRUM = configs.ELECTRUM;
    this.CORE_RPC = configs.CORE_RPC;
    this.SECOND_CORE_RPC = configs.SECOND_CORE_RPC;
    this.DATABASE = configs.DATABASE;
    this.SYSLOG = configs.SYSLOG;
    this.STATISTICS = configs.STATISTICS;
    this.BISQ = configs.BISQ;
    this.LIGHTNING = configs.LIGHTNING;
    this.LND = configs.LND;
    this.CLIGHTNING = configs.CLIGHTNING;
    this.SOCKS5PROXY = configs.SOCKS5PROXY;
    this.PRICE_DATA_SERVER = configs.PRICE_DATA_SERVER;
    this.EXTERNAL_DATA_SERVER = configs.EXTERNAL_DATA_SERVER;
    this.MAXMIND = configs.MAXMIND;
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
