const configFile = require('../mempool-config.json');

export interface IConfig {
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

class Config implements IConfig {
  MEMPOOL: IConfig['MEMPOOL'];
  ELECTRS: IConfig['ELECTRS'];
  DATABASE: IConfig['DATABASE'];
  STATISTICS: IConfig['STATISTICS'];
  BISQ_BLOCKS: IConfig['BISQ_BLOCKS'];
  BISQ_MARKETS: IConfig['BISQ_MARKETS'];
  SPONSORS: IConfig['SPONSORS'];

  constructor() {
    this.MEMPOOL = configFile.MEMPOOL;
    this.ELECTRS = configFile.ELECTRS;
    this.DATABASE = configFile.DATABASE;
    this.STATISTICS = configFile.STATISTICS;
    this.BISQ_BLOCKS = configFile.BISQ_BLOCKS;
    this.BISQ_MARKETS = configFile.BISQ_MARKETS;
    this.SPONSORS = configFile.SPONSORS;
  }
}

export default new Config();
