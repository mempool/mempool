import statisticsReplication from '../../replication/StatisticsReplication';
import { $sync } from '../../replication/replicator';
import statistics from '../../api/statistics/statistics-api';
import config from '../../config';
import DB from '../../database';
import { Common } from '../../api/common';

jest.mock('../../replication/replicator');

const NOW = 1790000000;
const STEP = 300;

function makeStats(rows: number, scale = 1, vsizesLength = 39, start = NOW): any[] {
  const stats: any[] = [];
  for (let i = 0; i < rows; i++) {
    stats.push({
      added: String(start - i * STEP),
      count: 1000 * scale,
      vbytes_per_second: 1000,
      total_fee: 0,
      mempool_byte_weight: 0,
      min_fee: 0.1,
      vsizes: new Array(vsizesLength).fill(100 * scale),
    });
  }
  return stats;
}

function withDeviatingRows(stats: any[], deviatingRows: number): any[] {
  const copy: any[] = [];
  for (let i = 0; i < stats.length; i++) {
    if (i < deviatingRows) {
      copy.push({ ...stats[i], count: stats[i].count * 0.5, vsizes: stats[i].vsizes.map((vsize: number) => vsize * 0.5) });
    } else {
      copy.push(stats[i]);
    }
  }
  return copy;
}

const CONCENTRATED_VSIZES = [1900, ...new Array(38).fill(50)];
const FIRST_BAND_MOVED_TO_LAST = [0, ...new Array(37).fill(50), 1950];
const FIFTEEN_PERCENT_MOVED_TO_NEXT_BAND = [1330, 620, ...new Array(37).fill(50)];
const FIVE_PERCENT_MOVED_TO_NEXT_BAND = [1710, 240, ...new Array(37).fill(50)];

function withVsizes(stats: any[], vsizes: number[]): any[] {
  const copy: any[] = [];
  for (const stat of stats) {
    copy.push({ ...stat, vsizes });
  }
  return copy;
}

function check(results: any[][]): { serverPicked: string, sanitizedResult: any[] } {
  const resultsPerServer = Object.fromEntries(results.map((result, index) => [`server-${index}`, result]));
  return (statisticsReplication as any).performSanityCheck(resultsPerServer, '/api/v1/statistics/1w');
}

describe('StatisticsReplication sanity check', () => {
  test('picks a healthy result over one that deviates', () => {
    const results = [makeStats(100, 0.5), makeStats(100), makeStats(100), makeStats(100)];
    const { serverPicked, sanitizedResult } = check(results);
    expect(serverPicked).toMatch(/^server-[1-3]$/);
    expect(sanitizedResult).toEqual(results[Number(serverPicked.split('-')[1])]);
  });

  test('returns only the compared row of each slot', () => {
    const stats = makeStats(100);
    const withUncheckedRows = [...stats, ...stats.map(stat => ({ ...stat, added: String(Number(stat.added) + 10), count: 999999 }))];
    const { sanitizedResult } = check([withUncheckedRows, withUncheckedRows, withUncheckedRows, withUncheckedRows]);
    expect(sanitizedResult).toEqual(stats);
  });

  test('matches rows by slot when one result has an extra newest row', () => {
    const { sanitizedResult } = check([makeStats(101, 1, 39, NOW + STEP), makeStats(100), makeStats(100), makeStats(100)]);
    expect(sanitizedResult.length).toBeGreaterThan(0);
  });

  test('rejects a sparse result', () => {
    const { serverPicked } = check([makeStats(10), makeStats(100), makeStats(100), makeStats(100)]);
    expect(serverPicked).toMatch(/^server-[1-3]$/);
  });

  test('rejects a result with the old 38 band vsizes', () => {
    const { serverPicked } = check([makeStats(100, 1, 38), makeStats(100), makeStats(100), makeStats(100)]);
    expect(serverPicked).toMatch(/^server-[1-3]$/);
  });

  test('returns an empty result when no results agree', () => {
    const { sanitizedResult } = check([makeStats(100, 1), makeStats(100, 2), makeStats(100, 4), makeStats(100, 8)]);
    expect(sanitizedResult).toEqual([]);
  });

  test('returns an empty result on a 2 vs 2 split', () => {
    const { serverPicked, sanitizedResult } = check([makeStats(100, 1), makeStats(100, 1), makeStats(100, 2), makeStats(100, 2)]);
    expect(sanitizedResult).toEqual([]);
    expect(serverPicked).toBe('');
  });

  test('returns an empty result when only one pair agrees', () => {
    const { sanitizedResult } = check([makeStats(100, 1), makeStats(100, 1), makeStats(100, 2), makeStats(100, 4)]);
    expect(sanitizedResult).toEqual([]);
  });

  test('counts a row deviating in both count and vsizes only once', () => {
    const base = makeStats(100);
    const { sanitizedResult } = check([withDeviatingRows(base, 6), base, makeStats(100, 4)]);
    expect(sanitizedResult.length).toBe(100);
  });

  test('rejects a pair with more than 10% deviating rows', () => {
    const base = makeStats(100);
    const { sanitizedResult } = check([withDeviatingRows(base, 11), base, makeStats(100, 4)]);
    expect(sanitizedResult).toEqual([]);
  });

  test('rejects a result with the same total but the first fee band moved to the last', () => {
    const moved = withVsizes(makeStats(100), FIRST_BAND_MOVED_TO_LAST);
    const healthy = withVsizes(makeStats(100), CONCENTRATED_VSIZES);
    const { serverPicked } = check([moved, healthy, healthy, healthy]);
    expect(serverPicked).toMatch(/^server-[1-3]$/);
  });

  test('rejects a result with the same total but 15% of the vsize moved to the next fee band', () => {
    const moved = withVsizes(makeStats(100), FIFTEEN_PERCENT_MOVED_TO_NEXT_BAND);
    const healthy = withVsizes(makeStats(100), CONCENTRATED_VSIZES);
    const { serverPicked } = check([moved, healthy, healthy, healthy]);
    expect(serverPicked).toMatch(/^server-[1-3]$/);
  });

  test('accepts 5% of the vsize moved to the next fee band', () => {
    const moved = withVsizes(makeStats(100), FIVE_PERCENT_MOVED_TO_NEXT_BAND);
    const healthy = withVsizes(makeStats(100), CONCENTRATED_VSIZES);
    const { sanitizedResult } = check([moved, healthy, makeStats(100, 4)]);
    expect(sanitizedResult.length).toBe(100);
  });
});

const DAY_MS = 24 * 60 * 60 * 1000;

function missingStatistics(times24h: number[]): Record<string, Set<number>> {
  return {
    '24h': new Set(times24h),
    '1w': new Set(),
    '1m': new Set(),
    '3m': new Set(),
    '6m': new Set(),
    '2y': new Set(),
    'all': new Set(),
  };
}

function numericStats(rows: number, vsizesLength = 39): any[] {
  return makeStats(rows, 1, vsizesLength, NOW - NOW % STEP).map(stat => ({ ...stat, added: Number(stat.added) }));
}

describe('StatisticsReplication sync', () => {
  const replication = statisticsReplication as any;
  let getMissingStatistics: jest.SpyInstance;
  let syncStatistics: jest.SpyInstance;

  beforeEach(() => {
    config.REPLICATION.ENABLED = true;
    config.REPLICATION.STATISTICS = true;
    config.STATISTICS.ENABLED = true;
    replication.inProgress = false;
    replication.failedAttempts = {};
    jest.spyOn(Common, 'sleep$').mockResolvedValue();
    getMissingStatistics = jest.spyOn(replication, '$getMissingStatistics');
    syncStatistics = jest.spyOn(replication, '$syncStatistics');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('releases the in progress lock when looking for missing rows fails', async () => {
    getMissingStatistics.mockRejectedValue(new Error('db timeout'));
    await expect(replication.$sync()).rejects.toThrow('db timeout');
    expect(replication.inProgress).toBe(false);
  });

  test('releases the in progress lock when syncing an interval fails', async () => {
    getMissingStatistics.mockResolvedValue(missingStatistics([60, 120]));
    syncStatistics.mockRejectedValue(new Error('insert failed'));
    await expect(replication.$sync()).rejects.toThrow('insert failed');
    expect(replication.inProgress).toBe(false);
  });

  test('skips an interval that failed in the last 24 hours even when new rows are missing', async () => {
    getMissingStatistics.mockResolvedValueOnce(missingStatistics([60, 120]));
    getMissingStatistics.mockResolvedValueOnce(missingStatistics([60, 120, 180]));
    syncStatistics.mockResolvedValue({ success: false, synced: 0, missed: 2 });
    await replication.$sync();
    await replication.$sync();
    expect(syncStatistics).toHaveBeenCalledTimes(1);
    expect(replication.inProgress).toBe(false);
  });

  test('retries an interval after the cooldown expires', async () => {
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(NOW * 1000);
    getMissingStatistics.mockResolvedValue(missingStatistics([60, 120]));
    syncStatistics.mockResolvedValue({ success: false, synced: 0, missed: 2 });
    await replication.$sync();
    dateNow.mockReturnValue(NOW * 1000 + DAY_MS + 1);
    await replication.$sync();
    expect(syncStatistics).toHaveBeenCalledTimes(2);
  });

  test('retries an interval when the previous attempt synced some rows', async () => {
    getMissingStatistics.mockResolvedValue(missingStatistics([60, 120]));
    syncStatistics.mockResolvedValue({ success: true, synced: 1, missed: 1 });
    await replication.$sync();
    await replication.$sync();
    expect(syncStatistics).toHaveBeenCalledTimes(2);
  });

  test('keeps syncing other intervals while one is in cooldown', async () => {
    getMissingStatistics.mockResolvedValue({ ...missingStatistics([60, 120]), '1w': new Set([300, 600]) });
    syncStatistics.mockImplementation((interval: string) => Promise.resolve(interval === '24h'
      ? { success: false, synced: 0, missed: 2 }
      : { success: true, synced: 1, missed: 1 }));
    await replication.$sync();
    await replication.$sync();
    expect(syncStatistics.mock.calls.map(([interval]) => interval)).toEqual(['24h', '1w', '1w']);
  });
});

describe('StatisticsReplication insert', () => {
  const replication = statisticsReplication as any;
  let create: jest.SpyInstance;

  beforeEach(() => {
    create = jest.spyOn(statistics, '$create').mockResolvedValue(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('inserts the missing rows of a valid result', async () => {
    const stats = numericStats(10);
    (($sync as unknown) as jest.Mock).mockResolvedValue({ data: stats, exists: true, server: 'a' });
    const result = await replication.$syncStatistics('1w', new Set(stats.map(stat => stat.added)));
    expect(create).toHaveBeenCalledTimes(10);
    expect(result).toEqual({ success: true, synced: 10, missed: 0 });
  });

  test('does not insert a result with the old 38 band vsizes', async () => {
    const stats = numericStats(10, 38);
    (($sync as unknown) as jest.Mock).mockResolvedValue({ data: stats, exists: true, server: 'a' });
    const result = await replication.$syncStatistics('1w', new Set(stats.map(stat => stat.added)));
    expect(create).not.toHaveBeenCalled();
    expect(result).toEqual({ success: false, synced: 0, missed: 10 });
  });

  test('does not insert a result that is not a list of statistics', async () => {
    (($sync as unknown) as jest.Mock).mockResolvedValue({ data: '<html>error</html>', exists: true, server: 'a' });
    const result = await replication.$syncStatistics('1w', new Set([NOW]));
    expect(create).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
  });
});

describe('StatisticsReplication missing rows', () => {
  const replication = statisticsReplication as any;
  const start = NOW - NOW % STEP;
  const end = start + STEP * 100;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function storedRows(missingFrom: number, missingTo: number): { added: number }[] {
    const rows: { added: number }[] = [];
    for (let index = 0; index < 100; index++) {
      if (index < missingFrom || index >= missingTo) {
        rows.push({ added: start + index * STEP + 10 });
      }
    }
    return rows;
  }

  test('returns the slots without a stored row', async () => {
    jest.spyOn(DB, 'query').mockResolvedValue([storedRows(40, 60), []] as any);
    const missing: Set<number> = await replication.$getMissingStatisticsInterval([start, end, '1w'], start);
    const expected: number[] = [];
    for (let index = 40; index < 60; index++) {
      expected.push(start + index * STEP);
    }
    expect([...missing].sort((a, b) => a - b)).toEqual(expected);
  });

  test('returns nothing when every slot has a stored row', async () => {
    jest.spyOn(DB, 'query').mockResolvedValue([storedRows(0, 0), []] as any);
    const missing: Set<number> = await replication.$getMissingStatisticsInterval([start, end, '1w'], start);
    expect(missing.size).toBe(0);
  });
});
