jest.unmock('../../api/mempool');
jest.mock('../../api/transaction-utils', () => ({
  __esModule: true,
  default: { extendMempoolTransaction: jest.fn(tx => tx) },
}));

// The mempool module graph starts setInterval timers at import time (BackendInfo, Mempool, ...).
// Enable fake timers before requiring it so those never become real open handles.
jest.useFakeTimers();
/* eslint-disable @typescript-eslint/no-var-requires */
const mempool: typeof import('../../api/mempool').default = require('../../api/mempool').default;
const blocks: typeof import('../../api/blocks').default = require('../../api/blocks').default;
const ElectrsApi = require('../../api/bitcoin/esplora-api').default;
const bitcoinApi = require('../../api/bitcoin/bitcoin-api-factory').default;
const logger = require('../../logger');
/* eslint-enable @typescript-eslint/no-var-requires */

// With the esplora backend, blocks are applied from Bitcoin Core while the mempool txid list comes
// from electrs. electrs reports the chain height its snapshot was taken at; a snapshot from before
// the latest applied block still lists that block's transactions and must not be used.
describe('Mempool skips esplora snapshots taken before the latest block', () => {
  afterAll(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  beforeEach(() => {
    (mempool as any).staleSnapshotSince = null;
    (mempool as any).staleSnapshotWarned = false;
    jest.spyOn(blocks, 'getCurrentBlockHeight').mockReturnValue(100);
    jest.setSystemTime(0);
  });

  test('a snapshot without a tip height is used, as with older electrs versions', () => {
    expect(mempool.isStaleSnapshot(null)).toBe(false);
  });

  test('a snapshot at or above the latest block is used', () => {
    expect(mempool.isStaleSnapshot(100)).toBe(false);
    expect(mempool.isStaleSnapshot(101)).toBe(false);
  });

  test('a snapshot from before the latest block is skipped', () => {
    expect(mempool.isStaleSnapshot(99)).toBe(true);
  });

  test('stale snapshots are used again once electrs has not caught up for a minute', () => {
    expect(mempool.isStaleSnapshot(99)).toBe(true);
    jest.setSystemTime(60_000);
    expect(mempool.isStaleSnapshot(99)).toBe(true);
    jest.setSystemTime(60_001);
    expect(mempool.isStaleSnapshot(99)).toBe(false);
  });

  test('giving up is only logged once per stale episode', () => {
    logger.warn.mockClear();
    mempool.isStaleSnapshot(99);
    jest.setSystemTime(60_001);
    mempool.isStaleSnapshot(99);
    jest.setSystemTime(61_000);
    mempool.isStaleSnapshot(99);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    mempool.isStaleSnapshot(100);
    mempool.isStaleSnapshot(99);
    jest.setSystemTime(200_000);
    mempool.isStaleSnapshot(99);
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });

  test('a bulk reload only adds transactions in the accepted snapshot', async () => {
    const cache = mempool.getMempool();
    for (const txid of Object.keys(cache)) {
      delete cache[txid];
    }
    // a fallback host can still list a just-mined transaction that the accepted txid list doesn't have
    const pages = [[{ txid: 'pending' }, { txid: 'mined' }], []];
    jest.spyOn(bitcoinApi, '$getAllMempoolTransactions').mockImplementation(async () => pages.shift());
    const added = await mempool.$reloadMempool(2, new Set(['pending']));
    expect(added.map(tx => tx.txid)).toEqual(['pending']);
    expect(Object.keys(cache)).toEqual(['pending']);
    delete cache['pending'];
  });

  test('the wait starts again after a fresh snapshot', () => {
    expect(mempool.isStaleSnapshot(99)).toBe(true);
    jest.setSystemTime(50_000);
    expect(mempool.isStaleSnapshot(100)).toBe(false);
    jest.setSystemTime(100_000);
    expect(mempool.isStaleSnapshot(99)).toBe(true);
  });

  describe('ElectrsApi', () => {
    const api = new ElectrsApi();

    test('reads the snapshot tip height from the response header', async () => {
      jest.spyOn(api.failoverRouter, '$getResponse').mockResolvedValue({ data: ['a', 'b'], headers: { 'x-mempool-tip-height': '99' } });
      expect(await api.$getRawMempoolWithTip()).toEqual({ txids: ['a', 'b'], tipHeight: 99 });
      expect(api.failoverRouter.$getResponse).toHaveBeenCalledWith('/mempool/txids');
    });

    test.each(['99junk', '-1', '100, 99', '1e3', '', '9007199254740993'])('ignores a malformed tip height header (%p)', async (value) => {
      jest.spyOn(api.failoverRouter, '$getResponse').mockResolvedValue({ data: ['a'], headers: { 'x-mempool-tip-height': value } });
      expect((await api.$getRawMempoolWithTip()).tipHeight).toBeNull();
    });

    test('reports no tip height when electrs does not send one', async () => {
      jest.spyOn(api.failoverRouter, '$getResponse').mockResolvedValue({ data: ['a'], headers: {} });
      expect(await api.$getRawMempoolWithTip()).toEqual({ txids: ['a'], tipHeight: null });
    });
  });
});
