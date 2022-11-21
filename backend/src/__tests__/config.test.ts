import * as fs from 'fs';

describe('Mempool Backend Config', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
  });

  test('should return defaults when no file is present', () => {
    jest.isolateModules(() => {
      jest.mock('../../mempool-config.json', () => ({}), { virtual: true });

      const config = jest.requireActual('../config').default;

      expect(config.MEMPOOL).toStrictEqual({
        ENABLED: true,
        NETWORK: 'mainnet',
        BACKEND: 'none',
        BLOCKS_SUMMARIES_INDEXING: false,
        HTTP_PORT: 8999,
        SPAWN_CLUSTER_PROCS: 0,
        API_URL_PREFIX: '/api/v1/',
        AUTOMATIC_BLOCK_REINDEXING: false,
        POLL_RATE_MS: 2000,
        CACHE_DIR: './cache',
        CLEAR_PROTECTION_MINUTES: 20,
        RECOMMENDED_FEE_PERCENTILE: 50,
        BLOCK_WEIGHT_UNITS: 4000000,
        INITIAL_BLOCKS_AMOUNT: 8,
        MEMPOOL_BLOCKS_AMOUNT: 8,
        INDEXING_BLOCKS_AMOUNT: 11000,
        PRICE_FEED_UPDATE_INTERVAL: 600,
        USE_SECOND_NODE_FOR_MINFEE: false,
        EXTERNAL_ASSETS: [],
        EXTERNAL_MAX_RETRY: 1,
        EXTERNAL_RETRY_INTERVAL: 0,
        USER_AGENT: 'mempool',
        STDOUT_LOG_MIN_PRIORITY: 'debug',
        POOLS_JSON_TREE_URL: 'https://api.github.com/repos/mempool/mining-pools/git/trees/master',
        POOLS_JSON_URL: 'https://raw.githubusercontent.com/mempool/mining-pools/master/pools.json'
      });

      expect(config.ELECTRUM).toStrictEqual({ HOST: '127.0.0.1', PORT: 3306, TLS_ENABLED: true });

      expect(config.ESPLORA).toStrictEqual({ REST_API_URL: 'http://127.0.0.1:3000' });

      expect(config.CORE_RPC).toStrictEqual({
        HOST: '127.0.0.1',
        PORT: 8332,
        USERNAME: 'mempool',
        PASSWORD: 'mempool'
      });

      expect(config.SECOND_CORE_RPC).toStrictEqual({
        HOST: '127.0.0.1',
        PORT: 8332,
        USERNAME: 'mempool',
        PASSWORD: 'mempool'
      });

      expect(config.DATABASE).toStrictEqual({
        ENABLED: true,
        HOST: '127.0.0.1',
        SOCKET: '',
        PORT: 3306,
        DATABASE: 'mempool',
        USERNAME: 'mempool',
        PASSWORD: 'mempool'
      });

      expect(config.SYSLOG).toStrictEqual({
        ENABLED: true,
        HOST: '127.0.0.1',
        PORT: 514,
        MIN_PRIORITY: 'info',
        FACILITY: 'local7'
      });

      expect(config.STATISTICS).toStrictEqual({ ENABLED: true, TX_PER_SECOND_SAMPLE_PERIOD: 150 });

      expect(config.BISQ).toStrictEqual({ ENABLED: false, DATA_PATH: '/bisq/statsnode-data/btc_mainnet/db' });

      expect(config.SOCKS5PROXY).toStrictEqual({
        ENABLED: false,
        USE_ONION: true,
        HOST: '127.0.0.1',
        PORT: 9050,
        USERNAME: '',
        PASSWORD: ''
      });

      expect(config.PRICE_DATA_SERVER).toStrictEqual({
        TOR_URL: 'http://wizpriceje6q5tdrxkyiazsgu7irquiqjy2dptezqhrtu7l2qelqktid.onion/getAllMarketPrices',
        CLEARNET_URL: 'https://price.bisq.wiz.biz/getAllMarketPrices'
      });

      expect(config.EXTERNAL_DATA_SERVER).toStrictEqual({
        MEMPOOL_API: 'https://mempool.space/api/v1',
        MEMPOOL_ONION: 'http://mempoolhqx4isw62xs7abwphsq7ldayuidyx2v2oethdhhj6mlo2r6ad.onion/api/v1',
        LIQUID_API: 'https://liquid.network/api/v1',
        LIQUID_ONION: 'http://liquidmom47f6s3m53ebfxn47p76a6tlnxib3wp6deux7wuzotdr6cyd.onion/api/v1',
        BISQ_URL: 'https://bisq.markets/api',
        BISQ_ONION: 'http://bisqmktse2cabavbr2xjq7xw3h6g5ottemo5rolfcwt6aly6tp5fdryd.onion/api'
      });
    });
  });

  test('should override the default values with the passed values', () => {
    jest.isolateModules(() => {
      const fixture = JSON.parse(fs.readFileSync(`${__dirname}/../__fixtures__/mempool-config.template.json`, 'utf8'));
      jest.mock('../../mempool-config.json', () => (fixture), { virtual: true });

      const config = jest.requireActual('../config').default;

      expect(config.MEMPOOL).toStrictEqual(fixture.MEMPOOL);

      expect(config.ELECTRUM).toStrictEqual(fixture.ELECTRUM);

      expect(config.ESPLORA).toStrictEqual(fixture.ESPLORA);

      expect(config.CORE_RPC).toStrictEqual(fixture.CORE_RPC);

      expect(config.SECOND_CORE_RPC).toStrictEqual(fixture.SECOND_CORE_RPC);

      expect(config.DATABASE).toStrictEqual(fixture.DATABASE);

      expect(config.SYSLOG).toStrictEqual(fixture.SYSLOG);

      expect(config.STATISTICS).toStrictEqual(fixture.STATISTICS);

      expect(config.BISQ).toStrictEqual(fixture.BISQ);

      expect(config.SOCKS5PROXY).toStrictEqual(fixture.SOCKS5PROXY);

      expect(config.PRICE_DATA_SERVER).toStrictEqual(fixture.PRICE_DATA_SERVER);

      expect(config.EXTERNAL_DATA_SERVER).toStrictEqual(fixture.EXTERNAL_DATA_SERVER);
    });
  });
});
