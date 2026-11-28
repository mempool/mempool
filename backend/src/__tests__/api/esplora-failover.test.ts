// urls the failover router requests while polling its hosts
const requested: string[] = [];
jest.mock('axios', () => {
  const get = async (url: string): Promise<unknown> => {
    requested.push(url);
    return { data: 900000, headers: {}, config: { meta: { rtt: 10 } } };
  };
  const instance = { interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }, get };
  return { __esModule: true, default: { create: (): unknown => instance }, isAxiosError: (): boolean => false };
});
jest.mock('https', () => ({
  request: (): unknown => ({ on: (event: string, fail: (e: Error) => void): void => { if (event === 'error') { fail(new Error('offline')); } }, end: jest.fn() }),
}));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ bitcoinCoreApi: {} }));

/* eslint-disable @typescript-eslint/no-var-requires */
const config = require('../../config').default;
const ElectrsApi = require('../../api/bitcoin/esplora-api').default;

describe('Esplora failover health checks', () => {
  const { OFFICIAL, NETWORK } = config.MEMPOOL;
  const tipChecks = ['http://127.0.0.1:3000/blocks/tip/height', 'http://node201.test:3000/blocks/tip/height'];

  beforeEach(() => {
    jest.useFakeTimers();
    requested.length = 0;
    config.MEMPOOL.NETWORK = 'liquid';
    config.ESPLORA.FALLBACK = ['http://node201.test:3000'];
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    Object.assign(config.MEMPOOL, { OFFICIAL, NETWORK });
    config.ESPLORA.FALLBACK = [];
  });

  test.each([false, true])('host versions and audit values follow MEMPOOL.OFFICIAL = %s', async (official) => {
    config.MEMPOOL.OFFICIAL = official;
    new ElectrsApi().startHealthChecks();
    await jest.advanceTimersByTimeAsync(1000);

    const metadata = requested.filter(url => !tipChecks.includes(url));
    expect(requested).toEqual(expect.arrayContaining(tipChecks));
    expect(metadata.filter(url => url.startsWith('https://node201.test/'))).toEqual(!official ? [] : [
      'https://node201.test/api/v1/liquid/reserves', 'https://node201.test/api/v1/liquid/pegs',
      'https://node201.test/resources/config.js', 'https://node201.test/api/v1/backend-info', 'https://node201.test/ssr/api/status',
    ]);
    expect(metadata).toHaveLength(official ? 10 : 0);
  });
});
