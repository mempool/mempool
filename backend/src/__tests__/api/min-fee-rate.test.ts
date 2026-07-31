import {
  buildOutOfBandCandidates,
  computeMinFeeRate,
  isMinFeeRateVersionStale,
  MIN_FEE_RATE_START_DATE,
  MIN_FEE_RATE_VERSION,
  MIN_SUMMARY_VERSION,
} from '../../api/mining/min-fee-rate';
import { OutOfBandCandidate } from '../../api/prioritization';

function tx(txid: string, effectiveFeePerVsize: number, cluster?: string[]): OutOfBandCandidate {
  return { txid, effectiveFeePerVsize, cluster: cluster || [txid] };
}

const NONE = new Set<string>();

// Block order (index 0 = coinbase); fee rate descends towards the bottom of the block
// in a clean block, matching the convention findOutOfBandTransactions scans against.
describe('computeMinFeeRate', () => {
  test('returns the minimum non-coinbase rate for a plain block', () => {
    const candidates = [tx('coinbase', 0), tx('c', 10), tx('b', 5), tx('a', 2)];
    expect(computeMinFeeRate(candidates, NONE)).toBe(2);
  });

  test('ignores the coinbase at index 0 regardless of its own exclusion status', () => {
    // The coinbase's rate (0) is always below any positive baseline, so it lands in
    // the exclusion set too — computeMinFeeRate must not depend on that; it skips
    // index 0 positionally.
    const candidates = [tx('coinbase', 0), tx('a', 5)];
    expect(computeMinFeeRate(candidates, NONE)).toBe(5);
  });

  test('skips a zero-rate transaction that the exclusion scan does not catch', () => {
    // 'zero' is processed first (bottom of the block, baseline still 0), so
    // 0 < 0 is false and it is not flagged as prioritized — EXCLUDE_ZERO_RATE is the
    // only thing keeping it out of the minimum.
    const candidates = [tx('coinbase', 0), tx('c', 6), tx('zero', 0)];
    expect(computeMinFeeRate(candidates, NONE)).toBe(6);
  });

  test('excludes a prioritized transaction and its whole cluster', () => {
    const candidates = [
      tx('coinbase', 0),
      tx('top', 10),
      tx('low', 1, ['low', 'parent']),
      tx('bottom', 4),
    ];
    expect(computeMinFeeRate(candidates, NONE)).toBe(4);
  });

  test('excludes an accelerated transaction and its cluster even at a normal rate', () => {
    const candidates = [
      tx('coinbase', 0),
      tx('other', 8),
      tx('boosted', 5, ['boosted', 'ancestor']),
    ];
    expect(computeMinFeeRate(candidates, new Set(['boosted']))).toBe(8);
  });

  test('returns null when no transaction qualifies', () => {
    expect(computeMinFeeRate(
      [tx('coinbase', 0), tx('only', 3)],
      new Set(['only']),
    )).toBeNull();
    expect(computeMinFeeRate([tx('coinbase', 0)], NONE)).toBeNull();
    expect(computeMinFeeRate([], NONE)).toBeNull();
  });
});

describe('buildOutOfBandCandidates', () => {
  test('reconstructs cluster membership from ancestors and descendants', () => {
    const result = buildOutOfBandCandidates([
      { txid: 'child', effectiveFeePerVsize: 3, ancestors: [{ txid: 'parent' }], descendants: [] },
      { txid: 'parent', effectiveFeePerVsize: 3, ancestors: [], descendants: [{ txid: 'child' }] },
    ]);
    expect(result[0]).toEqual({ txid: 'child', effectiveFeePerVsize: 3, cluster: ['child', 'parent'] });
    expect(result[1]).toEqual({ txid: 'parent', effectiveFeePerVsize: 3, cluster: ['parent', 'child'] });
  });

  test('defaults to a single-transaction cluster when there are no relatives', () => {
    const result = buildOutOfBandCandidates([{ txid: 'solo', effectiveFeePerVsize: 4 }]);
    expect(result).toEqual([{ txid: 'solo', effectiveFeePerVsize: 4, cluster: ['solo'] }]);
  });

  test('defaults a missing effective rate to 0', () => {
    const result = buildOutOfBandCandidates([{ txid: 'coinbase' }]);
    expect(result).toEqual([{ txid: 'coinbase', effectiveFeePerVsize: 0, cluster: ['coinbase'] }]);
  });
});

describe('min fee rate persistence constants', () => {
  test('a version bump makes an older result eligible', () => {
    expect(MIN_FEE_RATE_VERSION).toBeGreaterThan(0);
    expect(isMinFeeRateVersionStale(MIN_FEE_RATE_VERSION - 1)).toBe(true);
    expect(isMinFeeRateVersionStale(MIN_FEE_RATE_VERSION)).toBe(false);
  });

  test('requires trusted summaries and starts at the Core 30 release day', () => {
    expect(MIN_SUMMARY_VERSION).toBe(2);
    expect(MIN_FEE_RATE_START_DATE).toBe('2025-10-10 00:00:00');
  });
});
