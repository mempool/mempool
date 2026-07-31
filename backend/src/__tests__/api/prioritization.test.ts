import { findOutOfBandTransactions, OutOfBandCandidate } from '../../api/prioritization';

function tx(txid: string, effectiveFeePerVsize: number, cluster?: string[]): OutOfBandCandidate {
  return { txid, effectiveFeePerVsize, cluster: cluster || [txid] };
}

const NONE = new Set<string>();

// Block order (index 0 = highest mining priority) descends in fee rate towards the
// bottom of the block. The scan walks bottom-to-top, so a "clean" block presents a
// non-decreasing rate sequence as the scan proceeds towards index 0.
describe('findOutOfBandTransactions', () => {
  test('excludes nothing from a clean block with a non-decreasing rate sequence', () => {
    const ordered = [tx('top', 10), tx('mid', 7), tx('low', 4), tx('bottom', 1)];
    expect(findOutOfBandTransactions(ordered, NONE)).toEqual(new Set());
  });

  test('excludes a single out-of-order transaction', () => {
    const ordered = [tx('top', 10), tx('anomaly', 1), tx('bottom', 4)];
    expect(findOutOfBandTransactions(ordered, NONE)).toEqual(new Set(['anomaly']));
  });

  test('excludes every member of a prioritized transaction\'s cluster', () => {
    const ordered = [
      tx('top', 10),
      tx('anomaly', 1, ['anomaly', 'parent', 'child']),
      tx('bottom', 4),
    ];
    expect(findOutOfBandTransactions(ordered, NONE))
      .toEqual(new Set(['anomaly', 'parent', 'child']));
  });

  test('excludes an accelerated transaction and its cluster even at a normal rate', () => {
    const ordered = [
      tx('top', 10),
      tx('boosted', 7, ['boosted', 'ancestor']),
      tx('bottom', 4),
    ];
    // 7 is not out-of-order relative to the surrounding rates, so only the
    // acceleration flag causes the exclusion.
    const result = findOutOfBandTransactions(ordered, new Set(['boosted']));
    expect(result).toEqual(new Set(['boosted', 'ancestor']));
  });

  test('baseline guard: excluding a transaction must not lower the running baseline', () => {
    // Processed bottom-to-top: D(10) sets the baseline. C(1) is excluded and must NOT
    // drag the baseline down to 1 — if it did, B(5) would look clean against 1 and
    // escape exclusion, when it is really still below D's baseline of 10.
    const ordered = [tx('A', 12), tx('B', 5), tx('C', 1), tx('D', 10)];
    expect(findOutOfBandTransactions(ordered, NONE)).toEqual(new Set(['C', 'B']));
  });

  test('returns an empty set for an empty block', () => {
    expect(findOutOfBandTransactions([], NONE)).toEqual(new Set());
  });

  test('returns an empty set for a single-transaction block', () => {
    expect(findOutOfBandTransactions([tx('coinbase', 0)], NONE)).toEqual(new Set());
  });
});
