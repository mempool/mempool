import lightningReplication from '../../replication/LightningReplication';

const DAY = 86400;
const LAST_DAY = 20700;

function makeStats(days: number, scale = 1): any[] {
  const stats: any[] = [];
  for (let i = 0; i < days; i++) {
    stats.push({
      added: (LAST_DAY - i) * DAY,
      channel_count: 40000 * scale,
      total_capacity: 400000000000 * scale,
      tor_nodes: 8000 * scale,
      clearnet_nodes: 4600 * scale,
      unannounced_nodes: 2000 * scale,
      clearnet_tor_nodes: 1600 * scale,
    });
  }
  return stats;
}

function withDeviatingDays(stats: any[], deviatingDays: number): any[] {
  const copy: any[] = [];
  for (let i = 0; i < stats.length; i++) {
    copy.push(i < deviatingDays ? { ...stats[i], channel_count: stats[i].channel_count * 0.5 } : stats[i]);
  }
  return copy;
}

function withNodeTypes(stats: any[], nodeTypes: Record<string, number>): any[] {
  const copy: any[] = [];
  for (const stat of stats) {
    copy.push({ ...stat, ...nodeTypes });
  }
  return copy;
}

function check(results: any[][]): { serverPicked: string, sanitizedResult: any[] } {
  const resultsPerServer = Object.fromEntries(results.map((result, index) => [`server-${index}`, result]));
  return (lightningReplication as any).performSanityCheck(resultsPerServer, '/api/v1/lightning/statistics/all');
}

describe('LightningReplication sanity check', () => {
  test('picks a result that agrees with the majority', () => {
    const bad = makeStats(100, 0.5);
    const { serverPicked, sanitizedResult } = check([makeStats(100), bad, makeStats(100), makeStats(100)]);
    expect(sanitizedResult.length).toBe(100);
    expect(sanitizedResult).not.toBe(bad);
    expect(serverPicked).not.toBe('server-1');
  });

  test('accepts healthy results that miss different days', () => {
    const { sanitizedResult } = check([makeStats(100), makeStats(80), makeStats(90), makeStats(100)]);
    expect(sanitizedResult.length).toBeGreaterThan(0);
  });

  test('rejects a sparse result', () => {
    const sparse = makeStats(10);
    const { serverPicked } = check([sparse, makeStats(100), makeStats(100), makeStats(100)]);
    expect(serverPicked).not.toBe('server-0');
  });

  test('rejects a result with missing fields', () => {
    const broken = makeStats(100).map(({ tor_nodes, ...stat }) => stat);
    const { serverPicked } = check([broken, makeStats(100), makeStats(100), makeStats(100)]);
    expect(serverPicked).not.toBe('server-0');
  });

  test('returns an empty result on a 2 vs 2 split', () => {
    const { serverPicked, sanitizedResult } = check([makeStats(100), makeStats(100), makeStats(100, 2), makeStats(100, 2)]);
    expect(sanitizedResult).toEqual([]);
    expect(serverPicked).toBe('');
  });

  test('accepts a pair with 10% deviating days', () => {
    const base = makeStats(100);
    const { sanitizedResult } = check([withDeviatingDays(base, 10), base, makeStats(100, 4)]);
    expect(sanitizedResult.length).toBe(100);
  });

  test('rejects a pair with more than 10% deviating days', () => {
    const base = makeStats(100);
    const { sanitizedResult } = check([withDeviatingDays(base, 11), base, makeStats(100, 4)]);
    expect(sanitizedResult).toEqual([]);
  });

  test('rejects a result with the same node total but the node types moved', () => {
    const moved = withNodeTypes(makeStats(100), { tor_nodes: 0, clearnet_nodes: 12600 });
    const { serverPicked } = check([moved, makeStats(100), makeStats(100), makeStats(100)]);
    expect(serverPicked).not.toBe('server-0');
  });

  test('accepts a small shift between node types', () => {
    const shifted = withNodeTypes(makeStats(100), { tor_nodes: 7400, unannounced_nodes: 2600 });
    const { sanitizedResult } = check([shifted, makeStats(100), makeStats(100, 4)]);
    expect(sanitizedResult.length).toBe(100);
  });
});
