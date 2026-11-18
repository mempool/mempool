import statisticsReplication from '../../replication/StatisticsReplication';
import { query } from '../../replication/replicator';
import statistics from '../../api/statistics/statistics-api';
import config from '../../config';
import { Common } from '../../api/common';
import DB from '../../database';

jest.mock('../../replication/replicator');
jest.mock('../../api/backend-info', () => ({ __esModule: true, default: { getBackendInfo: () => ({ hostname: 'self' }) } }));

const STEP = 300;
const START = 1790000000 - 1790000000 % STEP;
const replication = statisticsReplication as any;

function rows(from: number, to: number, count = 1000, vsizesLength = 39): any[] {
  const result: any[] = [];
  for (let index = from; index < to; index++) {
    result.push({
      added: START + index * STEP,
      count: count + (index % 2) * 20,
      vbytes_per_second: 1000,
      total_fee: 0,
      mempool_byte_weight: 0,
      min_fee: 0.1,
      vsizes: new Array(vsizesLength).fill(100),
    });
  }
  return result;
}

function times(from: number, to: number): number[] {
  return rows(from, to).map(row => row.added);
}

function peers(results: Record<string, any[]>): Map<string, Map<number, any>> {
  return new Map(Object.entries(results).map(([server, result]) => [server, replication.mapBySlot(result, STEP)]));
}

function peer(beforeCount: number, chunkRows: any[]): any[] {
  return [...rows(0, 40, beforeCount), ...chunkRows];
}

function missing(timesPerInterval: Record<string, number[]>): Record<string, Set<number>> {
  return Object.fromEntries(['24h', '1w', '1m', '3m', '6m', '2y', 'all'].map(interval => [interval, new Set(timesPerInterval[interval] || [])]));
}

describe('StatisticsReplication pickSource', () => {
  const ours = replication.mapBySlot(rows(0, 40), STEP);
  const chunk = times(40, 100);
  const continuing = peer(1000, rows(40, 100));
  const jumping = peer(1000, rows(40, 100, 1500));

  test('picks the peer that matches and continues our data over peers that agree with each other', () => {
    expect(replication.pickSource(chunk, ours, peers({ a: jumping, b: jumping, c: jumping, d: continuing }), STEP)).toBe('d');
  });

  test('rejects a peer whose rows before the gap are off from ours', () => {
    expect(replication.pickSource(chunk, ours, peers({ a: peer(1300, rows(40, 100)) }), STEP)).toBeNull();
  });

  test('rejects a peer that jumps at the start of the gap', () => {
    expect(replication.pickSource(chunk, ours, peers({ a: jumping }), STEP)).toBeNull();
  });

  test('rejects a peer whose rows in the gap are much noisier or flatter than ours', () => {
    const noisy = peer(1000, rows(40, 100).map((row, index) => index % 2 ? { ...row, count: row.count * 1.25 } : row));
    const flat = peer(1000, rows(40, 100).map(row => ({ ...row, count: 1010 })));
    expect(replication.pickSource(chunk, ours, peers({ a: noisy }), STEP)).toBeNull();
    expect(replication.pickSource(chunk, ours, peers({ a: flat }), STEP)).toBeNull();
  });

  test('rejects a peer with a spike inside the gap even when its averages and start look normal', () => {
    const spiked = peer(1000, rows(40, 100).map((row, index) => index >= 15 && index < 45 ? { ...row, count: row.count * 1000 } : row));
    expect(replication.pickSource(chunk, ours, peers({ a: spiked }), STEP)).toBeNull();
    expect(replication.pickSource(chunk, ours, peers({ a: spiked, b: continuing, c: continuing }), STEP)).toBe('b');
  });

  test('only measures our own variation over unbroken rows right before the gap', () => {
    const sparse = [{ ...rows(0, 1)[0], count: 500 }, { ...rows(39, 40)[0], count: 1000 }];
    const jumpy = [...sparse, ...rows(40, 100).map((row, index) => ({ ...row, count: index % 2 ? 8000 : 4000 }))];
    expect(replication.pickSource(chunk, replication.mapBySlot(sparse, STEP), peers({ a: jumpy }), STEP)).toBeNull();
  });

  test('prefers the continuous peer covering more of the gap, but still uses a partial one when it is the only one', () => {
    const partial = peer(1000, rows(40, 41, 1010));
    expect(replication.pickSource(chunk, ours, peers({ x: partial, y: continuing }), STEP)).toBe('y');
    expect(replication.pickSource(chunk, ours, peers({ x: partial }), STEP)).toBe('x');
  });

  test('falls back to a peer agreed on by 3 peers when none continues our data', () => {
    expect(replication.pickSource(chunk, ours, peers({ a: jumping, b: jumping, c: jumping }), STEP)).toBe('a');
  });

  test('uses consensus when we hold no previous chunk', () => {
    expect(replication.pickSource(chunk, new Map(), peers({ a: rows(40, 100), b: rows(40, 100), c: rows(40, 100) }), STEP)).toBe('a');
  });

  test('breaks a consensus tie by preferring the peer covering more of the gap', () => {
    expect(replication.pickSource(chunk, new Map(), peers({ partial: rows(40, 70), full1: rows(40, 100), full2: rows(40, 100) }), STEP)).toBe('full1');
  });

  test('returns null when only 2 peers agree', () => {
    expect(replication.pickSource(chunk, new Map(), peers({ a: rows(40, 100), b: rows(40, 100), c: rows(40, 100, 2000), d: rows(40, 100, 2000) }), STEP)).toBeNull();
  });
});

describe('StatisticsReplication $sync', () => {
  beforeEach(() => {
    config.REPLICATION.ENABLED = true;
    config.REPLICATION.STATISTICS = true;
    config.STATISTICS.ENABLED = true;
    replication.inProgress = false;
    replication.failedAttempts = {};
    jest.spyOn(Common, 'sleep$').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('puts an interval that throws in cooldown and keeps syncing the next one', async () => {
    jest.spyOn(replication, '$getMissingStatistics').mockResolvedValue(missing({ '24h': [60, 120], '1w': [300, 600] }));
    const syncStatistics = jest.spyOn(replication, '$syncStatistics').mockRejectedValueOnce(new Error('list timeout')).mockResolvedValue({ success: true, synced: 2, missed: 0 });
    await replication.$sync();
    expect(syncStatistics.mock.calls.map(([interval]) => interval)).toEqual(['24h', '1w']);
    expect(replication.failedAttempts['24h']).toBeDefined();
    expect(replication.inProgress).toBe(false);
  });

  test('skips an interval that synced nothing for 24 hours, then retries it', async () => {
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(START * 1000);
    jest.spyOn(replication, '$getMissingStatistics').mockResolvedValue(missing({ '24h': [60, 120] }));
    const syncStatistics = jest.spyOn(replication, '$syncStatistics').mockResolvedValue({ success: false, synced: 0, missed: 2 });
    await replication.$sync();
    await replication.$sync();
    expect(syncStatistics).toHaveBeenCalledTimes(1);
    dateNow.mockReturnValue(START * 1000 + 24 * 60 * 60 * 1000 + 1);
    await replication.$sync();
    expect(syncStatistics).toHaveBeenCalledTimes(2);
  });
});

describe('StatisticsReplication $syncStatistics', () => {
  let create: jest.SpyInstance;
  let responses: Record<string, any>;

  beforeEach(() => {
    create = jest.spyOn(statistics, '$create').mockResolvedValue(1);
    jest.spyOn(statistics, '$list1W').mockResolvedValue([]);
    jest.spyOn(Common, 'shuffleArray').mockImplementation(() => undefined);
    ((query as unknown) as jest.Mock).mockReset().mockImplementation((url: string) => Promise.resolve(responses[url.split('/')[2]]));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('syncs a fresh server chunk by chunk, judging each chunk against the rows saved for the previous one', async () => {
    config.REPLICATION.SERVERS = ['a', 'b', 'c', 'd'];
    const jumpingAfterFirstChunk = [...rows(0, 60), ...rows(60, 120, 1500)];
    responses = { a: rows(0, 120), b: jumpingAfterFirstChunk, c: jumpingAfterFirstChunk, d: rows(0, 120) };
    const result = await replication.$syncStatistics('1w', new Set(times(0, 120)));
    expect(result).toEqual({ success: true, synced: 120, missed: 0 });
    expect(query).toHaveBeenCalledTimes(3);
  });

  test('fills a gap from the peer that continues our data', async () => {
    config.REPLICATION.SERVERS = ['a', 'b', 'c'];
    jest.spyOn(statistics, '$list1W').mockResolvedValue(rows(0, 40));
    responses = { a: rows(0, 100, 1500), b: rows(0, 100, 1010), c: rows(0, 100, 1500) };
    const result = await replication.$syncStatistics('1w', new Set(times(40, 100)));
    expect(result.synced).toBe(60);
    expect(create.mock.calls[0][0].unconfirmed_transactions).toBe(1010);
  });

  test('does not count a row the database failed to insert', async () => {
    config.REPLICATION.SERVERS = ['a', 'b', 'c'];
    create.mockResolvedValueOnce(undefined);
    responses = { a: rows(0, 60), b: rows(0, 60), c: rows(0, 60) };
    const result = await replication.$syncStatistics('1w', new Set(times(0, 60)));
    expect(result).toEqual({ success: true, synced: 59, missed: 1 });
  });

  test('pulls in more peers until 3 agree', async () => {
    config.REPLICATION.SERVERS = ['a', 'b', 'c', 'd', 'e', 'f'];
    responses = { a: rows(0, 60), b: rows(0, 60, 2000), c: rows(0, 60, 4000), d: rows(0, 60), e: rows(0, 60), f: rows(0, 60) };
    const result = await replication.$syncStatistics('1w', new Set(times(0, 60)));
    expect(result.synced).toBe(60);
    expect(query).toHaveBeenCalledTimes(5);
  });

  test('stops at the peer cap when no peers agree', async () => {
    config.REPLICATION.SERVERS = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9'];
    responses = Object.fromEntries(config.REPLICATION.SERVERS.map((server, index) => [server, rows(0, 60, 1000 * 2 ** index)]));
    const result = await replication.$syncStatistics('1w', new Set(times(0, 60)));
    expect(result).toEqual({ success: false, synced: 0, missed: 60 });
    expect(query).toHaveBeenCalledTimes(8);
    expect(create).not.toHaveBeenCalled();
  });

  test('ignores invalid responses and responses with the old 38 band vsizes', async () => {
    config.REPLICATION.SERVERS = ['a', 'b', 'c'];
    responses = { a: rows(0, 60, 1000, 38), b: rows(0, 60, 1000, 38), c: '<html>error</html>' };
    const result = await replication.$syncStatistics('1w', new Set(times(0, 60)));
    expect(result).toEqual({ success: false, synced: 0, missed: 60 });
    expect(create).not.toHaveBeenCalled();
  });
});

describe('StatisticsReplication missing rows', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('returns every slot of each gap, including its first and last, and ignores isolated missing slots', async () => {
    const missingIndexes = new Set([10, 11, 12, 40, 41, 42, 43, 44, 45, 70]);
    const stored = times(0, 100).filter((time, index) => !missingIndexes.has(index)).map(time => ({ added: time + 10 }));
    jest.spyOn(DB, 'query').mockResolvedValue([stored, []] as any);
    const missing: Set<number> = await replication.$getMissingStatisticsInterval([START, START + 100 * STEP, '1w'], START);
    expect([...missing].sort((a, b) => a - b)).toEqual([...times(10, 13), ...times(40, 46)]);
  });
});