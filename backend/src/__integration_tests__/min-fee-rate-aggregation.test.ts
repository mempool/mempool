import DB from '../database';
import BlocksRepository from '../repositories/BlocksRepository';
import { MIN_FEE_RATE_VERSION } from '../api/mining/min-fee-rate';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestPool, insertTestBlock } from './test-helpers';

/**
 * Midday UTC, `daysAgo` days back. Midday rather than midnight so a block never
 * lands on the day boundary the aggregation buckets on.
 */
function utcMidday(daysAgo: number): Date {
  const now = new Date();
  return new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysAgo, 12, 0, 0
  ));
}

describe('min fee rate daily aggregation', () => {
  let defaultPoolId: number;
  let nextHeight = 940000;

  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanupTestData();
    defaultPoolId = await insertTestPool({
      name: 'Unknown',
      slug: 'unknown',
      addresses: '[]',
      regexes: '[]',
    });
    nextHeight = 940000;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  async function insertBlockWithRate(options: {
    blockTimestamp: Date;
    minFeeRate: number | null;
    version?: number;
    stale?: boolean;
  }): Promise<number> {
    const height = nextHeight++;
    await insertTestBlock({
      height,
      hash: height.toString(16).padStart(64, '0'),
      blockTimestamp: options.blockTimestamp,
      poolId: defaultPoolId,
    });
    await DB.query(
      `UPDATE blocks
       SET min_fee_rate = ?, min_fee_rate_version = ?, stale = ?,
           min_fee_rate_computed_at = CURRENT_TIMESTAMP
       WHERE height = ?`,
      [
        options.minFeeRate,
        options.version ?? MIN_FEE_RATE_VERSION,
        options.stale ? 1 : 0,
        height,
      ]
    );
    return height;
  }

  test('buckets on the UTC day and keeps the lowest rate of each day', async () => {
    const lowest = await insertBlockWithRate({ blockTimestamp: utcMidday(3), minFeeRate: 0.12 });
    await insertBlockWithRate({ blockTimestamp: utcMidday(3), minFeeRate: 0.4 });
    await insertBlockWithRate({ blockTimestamp: utcMidday(2), minFeeRate: 0.25 });

    const days = await BlocksRepository.$getMinFeeRatesByDay(null);

    expect(days).toHaveLength(2);
    expect(days[0].minRate).toBeCloseTo(0.12, 6);
    expect(days[0].minHeight).toBe(lowest);
    expect(Number(days[0].usableBlockCount)).toBe(2);
    expect(days[1].minRate).toBeCloseTo(0.25, 6);
    expect(Number(days[1].usableBlockCount)).toBe(1);
    // Ascending by day.
    expect(Number(days[0].timestamp)).toBeLessThan(Number(days[1].timestamp));
  });

  test('excludes the current UTC day, whose minimum is still partial', async () => {
    await insertBlockWithRate({ blockTimestamp: utcMidday(0), minFeeRate: 0.01 });
    await insertBlockWithRate({ blockTimestamp: utcMidday(1), minFeeRate: 0.3 });

    const days = await BlocksRepository.$getMinFeeRatesByDay(null);

    expect(days).toHaveLength(1);
    expect(days[0].minRate).toBeCloseTo(0.3, 6);
  });

  test('ignores blocks with no rate, a stale version, or a stale chain', async () => {
    await insertBlockWithRate({ blockTimestamp: utcMidday(4), minFeeRate: null });
    await insertBlockWithRate({
      blockTimestamp: utcMidday(4),
      minFeeRate: 0.02,
      version: MIN_FEE_RATE_VERSION - 1,
    });
    await insertBlockWithRate({ blockTimestamp: utcMidday(4), minFeeRate: 0.03, stale: true });
    await insertBlockWithRate({ blockTimestamp: utcMidday(4), minFeeRate: 0.5 });

    const days = await BlocksRepository.$getMinFeeRatesByDay(null);

    expect(days).toHaveLength(1);
    expect(days[0].minRate).toBeCloseTo(0.5, 6);
    expect(Number(days[0].usableBlockCount)).toBe(1);
  });

  test('applies the requested interval to the returned series', async () => {
    await insertBlockWithRate({ blockTimestamp: utcMidday(40), minFeeRate: 0.05 });
    await insertBlockWithRate({ blockTimestamp: utcMidday(2), minFeeRate: 0.5 });

    const allDays = await BlocksRepository.$getMinFeeRatesByDay(null);
    const lastWeek = await BlocksRepository.$getMinFeeRatesByDay('1 WEEK');

    expect(allDays).toHaveLength(2);
    expect(lastWeek).toHaveLength(1);
    expect(lastWeek[0].minRate).toBeCloseTo(0.5, 6);
  });

  /**
   * The day count drives which timespan buttons the graph offers, so it deliberately
   * spans all available history rather than the selected window: scoping it to the
   * interval would hide the longer options as soon as a shorter one was picked. The
   * threshold percentage does not read it — that denominator is the returned series.
   */
  test('counts every available day regardless of the requested interval', async () => {
    await insertBlockWithRate({ blockTimestamp: utcMidday(40), minFeeRate: 0.05 });
    await insertBlockWithRate({ blockTimestamp: utcMidday(2), minFeeRate: 0.5 });

    const dayCount = await BlocksRepository.$getMinFeeRateDayCount();
    const lastWeek = await BlocksRepository.$getMinFeeRatesByDay('1 WEEK');

    expect(dayCount).toBe(2);
    expect(lastWeek).toHaveLength(1);
  });
});
