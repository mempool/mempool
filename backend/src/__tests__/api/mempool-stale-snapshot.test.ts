jest.unmock('../../api/mempool');

// The mempool module graph starts setInterval timers at import time (BackendInfo, Mempool, ...).
// Enable fake timers before requiring it so those never become real open handles.
jest.useFakeTimers();
/* eslint-disable @typescript-eslint/no-var-requires */
const mempool: typeof import('../../api/mempool').default = require('../../api/mempool').default;
const blocks: typeof import('../../api/blocks').default = require('../../api/blocks').default;
const ElectrsApi = require('../../api/bitcoin/esplora-api').default;
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

    test('reports no tip height when electrs does not send one', async () => {
      jest.spyOn(api.failoverRouter, '$getResponse').mockResolvedValue({ data: ['a'], headers: {} });
      expect(await api.$getRawMempoolWithTip()).toEqual({ txids: ['a'], tipHeight: null });
    });
  });
});
