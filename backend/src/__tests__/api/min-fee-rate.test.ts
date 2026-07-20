import {
  computeMinFeeRate,
  MinFeeRateInputs,
  MinFeeRateStatus,
  MIN_SUMMARY_VERSION,
} from '../../api/mining/min-fee-rate';

// A valid, audited, version-2 block with a plain fee-rate gradient and no exclusions.
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
    summaryVersion: 2,
    hasAudit: true,
    prioritizedTxs: [],
    acceleratedTxs: [],
    accelerationTxids: [],
    ...overrides,
  };
}

describe('computeMinFeeRate', () => {
  test('returns Available with the minimum non-coinbase rate for a plain block', () => {
    expect(computeMinFeeRate(baseInputs())).toEqual({
      status: MinFeeRateStatus.Available,
      rate: 2,
    });
  });

  test('ignores the coinbase at index 0 even when its rate is 0', () => {
    // If the coinbase were included the rate would be 0, not 2.
    const result = computeMinFeeRate(baseInputs());
    expect(result.rate).not.toBe(0);
    expect(result.rate).toBe(2);
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
    expect(computeMinFeeRate(inputs)).toEqual({
      status: MinFeeRateStatus.Available,
      rate: 3,
    });
  });

  test('skips a 0-fee 1p1c package parent (rate 0)', () => {
    const inputs = baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'zero-fee-parent', rate: 0 },
        { txid: 'child', rate: 4 },
        { txid: 'other', rate: 6 },
      ],
    });
    expect(computeMinFeeRate(inputs)).toEqual({
      status: MinFeeRateStatus.Available,
      rate: 4,
    });
  });

  test('excludes the true minimum when it is prioritized (returns second lowest)', () => {
    const transactions = [
      { txid: 'coinbase', rate: 0 },
      { txid: 'boosted', rate: 0.1 },
      { txid: 'honest', rate: 0.15 },
      { txid: 'other', rate: 3 },
    ];
    // Without exclusion the min would be 0.1; with it, 0.15.
    expect(computeMinFeeRate(baseInputs({ transactions })).rate).toBe(0.1);
    expect(
      computeMinFeeRate(
        baseInputs({ transactions, prioritizedTxs: ['boosted'] })
      )
    ).toEqual({ status: MinFeeRateStatus.Available, rate: 0.15 });
  });

  test('excludes the true minimum when it is accelerated', () => {
    const inputs = baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'accel', rate: 0.1 },
        { txid: 'honest', rate: 0.15 },
        { txid: 'other', rate: 3 },
      ],
      acceleratedTxs: ['accel'],
    });
    expect(computeMinFeeRate(inputs)).toEqual({
      status: MinFeeRateStatus.Available,
      rate: 0.15,
    });
  });

  test('excludes the true minimum when it is only in the accelerations table', () => {
    const inputs = baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'accel-table', rate: 0.1 },
        { txid: 'honest', rate: 0.15 },
        { txid: 'other', rate: 3 },
      ],
      accelerationTxids: ['accel-table'],
    });
    expect(computeMinFeeRate(inputs)).toEqual({
      status: MinFeeRateStatus.Available,
      rate: 0.15,
    });
  });

  test('handles a txid appearing in multiple exclusion sources without double-counting', () => {
    const inputs = baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'boosted', rate: 0.1 },
        { txid: 'honest', rate: 0.15 },
      ],
      prioritizedTxs: ['boosted'],
      acceleratedTxs: ['boosted'],
      accelerationTxids: ['boosted'],
    });
    expect(computeMinFeeRate(inputs)).toEqual({
      status: MinFeeRateStatus.Available,
      rate: 0.15,
    });
  });

  test('returns UnavailablePermanent when there is no audit row, even with valid txs', () => {
    expect(computeMinFeeRate(baseInputs({ hasAudit: false }))).toEqual({
      status: MinFeeRateStatus.UnavailablePermanent,
      rate: null,
    });
  });

  test('no audit takes precedence over a low summary version (permanent, not retry)', () => {
    expect(
      computeMinFeeRate(baseInputs({ hasAudit: false, summaryVersion: 0 }))
    ).toEqual({ status: MinFeeRateStatus.UnavailablePermanent, rate: null });
  });

  test('returns UnavailableRetry for summary versions below the trusted threshold', () => {
    expect(computeMinFeeRate(baseInputs({ summaryVersion: 0 }))).toEqual({
      status: MinFeeRateStatus.UnavailableRetry,
      rate: null,
    });
    expect(computeMinFeeRate(baseInputs({ summaryVersion: 1 }))).toEqual({
      status: MinFeeRateStatus.UnavailableRetry,
      rate: null,
    });
  });

  test('audit present but no summary row yet → UnavailableRetry, not Permanent', () => {
    // $backfillMinFeeRate maps a missing blocks_summaries row to summaryVersion 0
    // (summary?.version ?? 0) and transactions [] (summary?.transactions ?? []),
    // while the audit row makes hasAudit true. The version gate must win over the
    // empty-transactions path so the block is retried once its summary is indexed.
    expect(
      computeMinFeeRate(
        baseInputs({ hasAudit: true, summaryVersion: 0, transactions: [] })
      )
    ).toEqual({ status: MinFeeRateStatus.UnavailableRetry, rate: null });
  });

  test('computes Available for trusted summary versions (2 and 3)', () => {
    expect(computeMinFeeRate(baseInputs({ summaryVersion: 2 })).status).toBe(
      MinFeeRateStatus.Available
    );
    expect(computeMinFeeRate(baseInputs({ summaryVersion: 3 })).status).toBe(
      MinFeeRateStatus.Available
    );
    // Guard against the threshold drifting away from the documented value.
    expect(MIN_SUMMARY_VERSION).toBe(2);
  });

  test('returns UnavailablePermanent when every non-coinbase tx is excluded', () => {
    const inputs = baseInputs({
      transactions: [
        { txid: 'coinbase', rate: 0 },
        { txid: 'a', rate: 5 },
        { txid: 'b', rate: 2 },
      ],
      prioritizedTxs: ['a'],
      acceleratedTxs: ['b'],
    });
    expect(computeMinFeeRate(inputs)).toEqual({
      status: MinFeeRateStatus.UnavailablePermanent,
      rate: null,
    });
  });

  test('returns UnavailablePermanent for an audited block with an empty tx array', () => {
    expect(computeMinFeeRate(baseInputs({ transactions: [] }))).toEqual({
      status: MinFeeRateStatus.UnavailablePermanent,
      rate: null,
    });
  });

  test('returns UnavailablePermanent for a coinbase-only block', () => {
    expect(
      computeMinFeeRate(
        baseInputs({ transactions: [{ txid: 'coinbase', rate: 0 }] })
      )
    ).toEqual({ status: MinFeeRateStatus.UnavailablePermanent, rate: null });
  });

  test('never returns Pending (a DB default, not a compute outcome)', () => {
    const cases: Partial<MinFeeRateInputs>[] = [
      {},
      { hasAudit: false },
      { summaryVersion: 1 },
      { transactions: [] },
      { transactions: [{ txid: 'coinbase', rate: 0 }] },
    ];
    for (const c of cases) {
      expect(computeMinFeeRate(baseInputs(c)).status).not.toBe(
        MinFeeRateStatus.Pending
      );
    }
  });
});
