// The blocks module graph starts timers at import time, so fake them before requiring it.
jest.useFakeTimers();
/* eslint-disable @typescript-eslint/no-var-requires */
const blocks = require('../../api/blocks').default;
const mining = require('../../api/mining/mining').default;
const { Common } = require('../../api/common');
const BlocksAuditsRepository = require('../../repositories/BlocksAuditsRepository').default;
const BlocksSummariesRepository = require('../../repositories/BlocksSummariesRepository').default;
const PricesRepository = require('../../repositories/PricesRepository').default;
/* eslint-enable @typescript-eslint/no-var-requires */

afterAll(() => {
  jest.restoreAllMocks();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('the pools stats are rebuilt after a block\'s audit row has been saved', async () => {
  jest.spyOn(Common, 'indexingEnabled').mockReturnValue(true);
  jest.spyOn(Common, 'blocksSummariesIndexingEnabled').mockReturnValue(false);
  jest.spyOn(Common, 'blockPricesIndexingEnabled').mockReturnValue(false);
  jest.spyOn(PricesRepository, '$getLatestPriceId').mockResolvedValue(null);
  jest.spyOn(BlocksSummariesRepository, '$saveTemplate').mockResolvedValue(undefined);
  const rebuild = jest.spyOn(mining, '$rebuildPoolsStatsCache').mockResolvedValue(undefined);
  let land: () => void = () => undefined;
  jest.spyOn(BlocksAuditsRepository, '$saveAudit').mockReturnValue(new Promise<void>((resolve) => { land = resolve; }));

  await blocks.$saveBlockData({
    blockExtended: { id: 'block100', height: 100, timestamp: 0 },
    cpfpSummary: { transactions: [] },
    auditResult: { projectedBlocks: [{ transactions: [] }] },
  }, {});
  // the audit row lands after the rebuild scheduled for the block would already have run
  await jest.advanceTimersByTimeAsync(60000);
  expect(rebuild).not.toHaveBeenCalled();
  land();
  await jest.advanceTimersByTimeAsync(30000);
  expect(rebuild).toHaveBeenCalledTimes(1);
});
