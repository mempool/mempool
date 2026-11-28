jest.mock('../api/mempool', () => ({ __esModule: true, default: { hasPriority: (): boolean => false } }));
jest.mock('../api/bitcoin/bitcoin-client', () => ({
  __esModule: true,
  default: { getBlockchainInfo: async () => ({ blocks: 105, headers: 105 }), getIndexInfo: async () => ({}) },
}));

// The indexer module graph starts setInterval timers at import time, so enable fake timers before requiring it
jest.useFakeTimers();
/* eslint-disable @typescript-eslint/no-var-requires */
const BlocksRepository = require('../repositories/BlocksRepository').default;
const bitcoinApi = require('../api/bitcoin/bitcoin-api-factory').default;
const DB = require('../database').default;
const indexer = require('../indexer').default;
const blocks = require('../api/blocks').default;
const priceUpdater = require('../tasks/price-updater').default;
const { Common } = require('../api/common');
/* eslint-enable @typescript-eslint/no-var-requires */

describe('chain validation', () => {
  beforeEach(() => {
    jest.spyOn(bitcoinApi, '$getBlockHashTip').mockResolvedValue('tip');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('is unavailable when the indexed blocks cannot be read', async () => {
    jest.spyOn(DB, 'query').mockRejectedValue(new Error('database unavailable'));
    await expect(BlocksRepository.$validateChain()).resolves.toBe('unavailable');
  });

  test('is valid when no blocks are indexed', async () => {
    jest.spyOn(DB, 'query').mockResolvedValue([[], []]);
    await expect(BlocksRepository.$validateChain()).resolves.toBe('valid');
  });

  test('the indexer stops the run and retries in 10 seconds when the chain validation is unavailable', async () => {
    jest.spyOn(Common, 'indexingEnabled').mockReturnValue(true);
    jest.spyOn(priceUpdater, '$run').mockResolvedValue(undefined);
    jest.spyOn(blocks, '$generateBlockDatabase').mockResolvedValue('unavailable');
    const runSingleTask = jest.spyOn(indexer, 'runSingleTask').mockResolvedValue(undefined);
    // the first awaited step after the validation. Failing it ends a run that got this far
    const indexCoinbaseAddresses = jest.spyOn(blocks, '$indexCoinbaseAddresses').mockRejectedValue(new Error('end of test'));
    const scheduleNextRun = jest.spyOn(indexer, 'scheduleNextRun').mockImplementation(() => undefined);
    indexer.reindex();

    await indexer.$run();
    expect(runSingleTask).not.toHaveBeenCalled();
    expect(indexCoinbaseAddresses).not.toHaveBeenCalled();
    expect(scheduleNextRun).toHaveBeenCalledWith(10000);
  });
});
