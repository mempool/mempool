import {
  computeMinFeeRate,
  isMinFeeRateVersionStale,
  MinFeeRateInputs,
  MIN_FEE_RATE_START_DATE,
  MIN_FEE_RATE_VERSION,
  MIN_SUMMARY_VERSION,
} from '../../api/mining/min-fee-rate';

// A trusted, audited block with a plain fee-rate gradient and no exclusions.
// Index 0 is the coinbase (rate 0), as it is in real summaries.
function baseInputs(
  overrides: Partial<MinFeeRateInputs> = {}
): MinFeeRateInputs {
  return {
    transactions: [
      { txid: 'coinbase', rate: 0 },
      { txid: 'a', rate: 5 },
      { txid: 'b', rate: 2 },
      { txid: 'c', rate: 10 },
    ],
    prioritizedTxs: [],
    acceleratedTxs: [],
    accelerationTxids: [],
    ...overrides,
  };
}

describe('computeMinFeeRate', () => {
  test('returns the minimum non-coinbase rate for a plain block', () => {
    expect(computeMinFeeRate(baseInputs())).toBe(2);
  });

  test('ignores the coinbase at index 0 even when its rate is 0', () => {
    expect(computeMinFeeRate(baseInputs())).not.toBe(0);
  });

  test('skips transactions with undefined or null rate', () => {
    const inputs = baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'a', rate: undefined },
        { txid: 'b', rate: null as unknown as number },
        { txid: 'c', rate: 7 },
        { txid: 'd', rate: 3 },
      ],
    });
    expect(computeMinFeeRate(inputs)).toBe(3);
  });

  test('skips a 0-fee 1p1c package parent', () => {
    const inputs = baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'zero-fee-parent', rate: 0 },
        { txid: 'child', rate: 4 },
        { txid: 'other', rate: 6 },
      ],
    });
    expect(computeMinFeeRate(inputs)).toBe(4);
  });

  test('excludes prioritized transactions', () => {
    const transactions = [
      { txid: 'coinbase', rate: 0 },
      { txid: 'boosted', rate: 0.1 },
      { txid: 'honest', rate: 0.15 },
      { txid: 'other', rate: 3 },
    ];
    expect(computeMinFeeRate(baseInputs({ transactions }))).toBe(0.1);
    expect(computeMinFeeRate(
      baseInputs({ transactions, prioritizedTxs: ['boosted'] })
    )).toBe(0.15);
  });

  test('excludes audit and persisted acceleration sources', () => {
    const transactions = [
      { txid: 'coinbase', rate: 0 },
      { txid: 'audit-accelerated', rate: 0.1 },
      { txid: 'table-accelerated', rate: 0.12 },
      { txid: 'honest', rate: 0.15 },
    ];
    expect(computeMinFeeRate(baseInputs({
      transactions,
      acceleratedTxs: ['audit-accelerated'],
      accelerationTxids: ['table-accelerated'],
    }))).toBe(0.15);
  });

  test('handles a txid appearing in multiple exclusion sources', () => {
    expect(computeMinFeeRate(baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'boosted', rate: 0.1 },
        { txid: 'honest', rate: 0.15 },
      ],
      prioritizedTxs: ['boosted'],
      acceleratedTxs: ['boosted'],
      accelerationTxids: ['boosted'],
    }))).toBe(0.15);
  });

  test('returns null when no transaction qualifies', () => {
    expect(computeMinFeeRate(baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'a', rate: 5 },
        { txid: 'b', rate: 2 },
      ],
      prioritizedTxs: ['a'],
      acceleratedTxs: ['b'],
    }))).toBeNull();
    expect(computeMinFeeRate(baseInputs({ transactions: [] }))).toBeNull();
    expect(computeMinFeeRate(baseInputs({
      transactions: [{ txid: 'coinbase', rate: 0 }],
    }))).toBeNull();
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
