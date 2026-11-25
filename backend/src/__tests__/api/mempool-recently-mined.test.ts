jest.unmock('../../api/mempool');

const fetched: string[][] = [];
jest.mock('../../api/transaction-utils', () => ({
  __esModule: true,
  default: {
    $getMempoolTransactionsExtended: jest.fn(async (txids: string[]) => {
      fetched.push(txids);
      return txids.map(txid => ({ txid, vsize: 100, weight: 400, fee: 100, feePerVsize: 1, effectiveFeePerVsize: 1, vin: [], vout: [], status: { confirmed: false } }));
    }),
    extendMempoolTransaction: jest.fn(tx => tx),
    stripCoinbaseTransaction: jest.fn(tx => tx),
  },
}));

// Core's view of the active chain: getblockheader reports confirmations -1 for a block not in it
const activeChain = new Set<string>();
let headerError = false;
const getBlockHeader = jest.fn(async (hash: string) => {
  if (headerError) {
    throw new Error('rpc unavailable');
  }
  return { hash, confirmations: activeChain.has(hash) ? 1 : -1 };
});
const getBlock = jest.fn();
jest.mock('../../api/bitcoin/bitcoin-client', () => ({
  __esModule: true,
  default: {
    getBlockHeader: (...args: [string]) => getBlockHeader(...args),
    getBlock: (...args: [string]) => getBlock(...args),
  },
}));

// The mempool module graph starts setInterval timers at import time (BackendInfo, Mempool, ...).
// Enable fake timers before requiring it so those never become real open handles.
jest.useFakeTimers();
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mempool: typeof import('../../api/mempool').default = require('../../api/mempool').default;
/* eslint-disable @typescript-eslint/no-var-requires */
const blocks: typeof import('../../api/blocks').default = require('../../api/blocks').default;
const { default: bitcoinApi, bitcoinCoreApi } = require('../../api/bitcoin/bitcoin-api-factory');
const blockProcessor = require('../../api/block-processor').default;
const websocketHandler = require('../../api/websocket-handler').default;
const chainTips = require('../../api/chain-tips').default;
const { Common } = require('../../api/common');
const config = require('../../config').default;
/* eslint-enable @typescript-eslint/no-var-requires */

// With the esplora backend, blocks are applied from Bitcoin Core while the mempool txid list comes
// from electrs. If electrs is still indexing a block, its list still contains that block's
// transactions, and they must not be added back to the mempool.
describe('Mempool ignores recently mined transactions in a stale snapshot', () => {
  const backend = config.MEMPOOL.BACKEND;
  beforeAll(() => {
    config.MEMPOOL.BACKEND = 'esplora';
  });
  afterAll(() => {
    config.MEMPOOL.BACKEND = backend;
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const cache = mempool.getMempool();

  beforeEach(() => {
    fetched.length = 0;
    for (const txid of Object.keys(cache)) {
      delete cache[txid];
    }
    (mempool as any).recentlyMined = [];
    activeChain.clear();
    headerError = false;
    getBlockHeader.mockClear();
  });

  function mine(hash: string, previousHash: string, txids: string[]): void {
    activeChain.add(hash);
    mempool.setRecentlyMined(hash, previousHash, txids);
  }

  async function update(txids: string[]): Promise<string[]> {
    const before = new Set(Object.keys(cache));
    await mempool.$updateMempool(txids, null, [], -1, 1000);
    return Object.keys(cache).filter(txid => !before.has(txid)).sort();
  }

  test('transactions mined in the last block are not re-added', async () => {
    await update(['pending', 'mined1', 'mined2']);
    // the block is applied from Core and removes its transactions from the cache
    delete cache['mined1'];
    delete cache['mined2'];
    mine('block1', 'block0', ['mined1', 'mined2']);

    // electrs has not caught up: its list still contains the mined transactions
    const added = await update(['pending', 'mined1', 'mined2', 'new1']);
    expect(added).toEqual(['new1']);
    expect(fetched[fetched.length - 1]).toEqual(['new1']);
  });

  test('Core is only asked about the chain when the record would hide something', async () => {
    mine('block1', 'block0', ['mined1']);
    await update(['pending']);
    expect(getBlockHeader).not.toHaveBeenCalled();
    await update(['pending', 'mined1']);
    expect(getBlockHeader).toHaveBeenCalledWith('block1', true);
  });

  test('an applied block that does not build on the last one clears the record', async () => {
    mine('block1', 'block0', ['mined1']);
    // a competing block at the same height does not build on block1
    activeChain.delete('block1');
    mine('block1b', 'block0', ['other']);
    expect(await update(['mined1'])).toEqual(['mined1']);
  });

  test('a reorg the block loop has not applied clears the record', async () => {
    mine('block1', 'block0', ['mined1']);
    // Core switches to block1b at the same height; the block loop only reacts to a higher tip,
    // so setRecentlyMined is never called, but mined1 is back in the mempool
    activeChain.delete('block1');
    activeChain.add('block1b');
    expect(await update(['mined1'])).toEqual(['mined1']);
  });

  test('a failed chain check clears the record rather than hiding transactions', async () => {
    mine('block1', 'block0', ['mined1']);
    headerError = true;
    expect(await update(['mined1'])).toEqual(['mined1']);
  });

  test('orphaning both remembered blocks clears the whole record', async () => {
    mine('block1', 'block0', ['a']);
    mine('block2', 'block1', ['b']);
    // a two-block reorg replaces block1 and block2 without raising the height
    activeChain.delete('block1');
    activeChain.delete('block2');
    expect(await update(['a', 'b'])).toEqual(['a', 'b']);
  });

  test('a bulk reload skips recently mined transactions and keeps paginating past them', async () => {
    mine('block1', 'block0', ['mined1', 'mined2']);
    const page = (txids: string[]) => txids.map(txid => ({ txid, vsize: 100, weight: 400, fee: 100, vin: [], vout: [], status: { confirmed: false } }));
    const pages = [page(['pending1', 'mined1']), page(['mined2']), page(['pending2']), []];
    const getAll = jest.spyOn(bitcoinApi, '$getAllMempoolTransactions').mockImplementation(async () => pages.shift());

    const added = await mempool.$reloadMempool(4);
    expect(added.map(tx => tx.txid).sort()).toEqual(['pending1', 'pending2']);
    expect(Object.keys(cache).sort()).toEqual(['pending1', 'pending2']);
    expect(getAll.mock.calls.map(call => call[0])).toEqual([undefined, 'mined1', 'mined2', 'pending2']);
    getAll.mockRestore();
  });

  test('applying a block from Core records its transactions', async () => {
    // run the real $updateBlocks for one block, stubbing everything it does besides applying it
    jest.replaceProperty(config, 'STATISTICS', { ...config.STATISTICS, ENABLED: false });
    jest.replaceProperty(config, 'REDIS', { ...config.REDIS, ENABLED: false });
    jest.replaceProperty(config, 'MEMPOOL', { ...config.MEMPOOL, CACHE_ENABLED: false });
    jest.replaceProperty(blocks as any, 'blocks', [{ id: 'block99', height: 99 }]);
    jest.replaceProperty(blocks as any, 'lastDifficultyAdjustmentTime', 1);
    jest.spyOn(Common, 'indexingEnabled').mockReturnValue(false);
    jest.spyOn(bitcoinCoreApi, '$getBlockHeightTip').mockResolvedValue(100);
    jest.spyOn(bitcoinCoreApi, '$getBlockHash').mockResolvedValue('block100');
    getBlock.mockResolvedValue({ hash: 'block100', height: 100, previousblockhash: 'block99', bits: '1d00ffff', tx: [{ txid: 'coinbase' }, { txid: 'mined1' }] });
    jest.spyOn(blocks as any, 'updateQuarterEpochBlockTime').mockResolvedValue(undefined);
    jest.spyOn(blocks as any, '$getTransactionsExtended').mockResolvedValue([{ txid: 'coinbase' }, { txid: 'mined1' }]);
    jest.spyOn(blocks as any, '$findBlockMiner').mockResolvedValue({});
    jest.spyOn(blockProcessor, '$processNewBlock').mockResolvedValue({
      blockExtended: { id: 'block100', height: 100 }, blockSummary: { transactions: [] }, cpfpSummary: { transactions: [] },
    });
    jest.spyOn(blocks as any, '$applyBlockTransactionsToMempool').mockImplementation(async (txids: any) => {
      (txids as string[]).forEach(txid => delete cache[txid]);
      return { rbfTransactions: {} };
    });
    jest.spyOn(websocketHandler, 'handleNewBlock').mockResolvedValue(undefined);
    jest.spyOn(chainTips, 'updateOrphanedBlocks').mockResolvedValue(undefined);

    await update(['pending', 'mined1']);
    expect(await blocks.$updateBlocks()).toBe(1);
    activeChain.add('block100');
    // electrs still lists the block's transactions
    expect(await update(['pending', 'mined1', 'new1'])).toEqual(['new1']);
    jest.restoreAllMocks();
  });

  test('other backends take the mempool from Core and record nothing', async () => {
    config.MEMPOOL.BACKEND = 'none';
    try {
      mine('block1', 'block0', ['mined1']);
    } finally {
      config.MEMPOOL.BACKEND = 'esplora';
    }
    expect(await update(['mined1'])).toEqual(['mined1']);
    expect(getBlockHeader).not.toHaveBeenCalled();
  });

  test('only the last two blocks are remembered', async () => {
    mine('block1', 'block0', ['a']);
    mine('block2', 'block1', ['b']);
    mine('block3', 'block2', ['c']);
    expect(await update(['a', 'b', 'c'])).toEqual(['a']);
  });
});
