/**
 * Minimum "fee-merit" effective fee rate for a single block (mempool issue #6639).
 *
 * The metric is the lowest CPFP-effective fee rate among the transactions that
 * earned their block inclusion on fee merit alone. Transactions that were boosted
 * out-of-band (prioritised via prioritisetransaction, or accelerated) are excluded
 * because their low on-chain rate does not reflect the marginal fee-merit floor.
 *
 * This module is intentionally pure (no DB, no I/O) so the exclusion logic can be
 * unit-tested exhaustively. Local databases can have zero audit rows and only a
 * handful of usable summaries, so tests — not real data — are how this is validated.
 */

/**
 * Minimum blocks_summaries.version whose `rate` can be trusted as CPFP-effective.
 * Verified in RESEARCH-6639.md §A1: version 0 carries no `rate` field at all, and
 * version 1 is ambiguous (effective when esplora-indexed, but nominal via the
 * no-cpfpSummary fallback branch in blocks.ts). Only version >= 2 (calculateGood /
 * calculateClusterMempool CPFP) guarantees a CPFP-adjusted effective rate.
 */
export const MIN_SUMMARY_VERSION = 2;

/**
 * Increment this whenever the algorithm changes. A block is eligible whenever its
 * stored version is lower; late persisted inputs are tracked separately by snapshots.
 */
export const MIN_FEE_RATE_VERSION = 1;

/**
 * Bitcoin Core 30.0 was released on 2025-10-10 and changed the default
 * minrelaytxfee to 0.1 sat/vB. The series is intentionally undefined before then.
 */
export const MIN_FEE_RATE_START_DATE = '2025-10-10 00:00:00';

/**
 * Fixed-size, order-independent snapshot of an acceleration set. Keep this exact SQL
 * fragment shared by both the persisted-state read and the staleness sweep: using two
 * independently maintained expressions would make every block permanently stale as
 * soon as they diverged.
 *
 * COUNT handles cardinality while this 64-bit XOR detects membership changes. Unlike
 * GROUP_CONCAT, its result size is independent of the number of accelerations.
 */
export const MIN_FEE_RATE_ACCELERATION_FINGERPRINT_SQL =
  `LPAD(HEX(COALESCE(BIT_XOR(CAST(CONV(SUBSTRING(SHA2(txid, 256), 1, 16), 16, 10) AS UNSIGNED)), 0)), 16, '0')`;
export const MIN_FEE_RATE_EMPTY_ACCELERATION_FINGERPRINT = '0000000000000000';

/**
 * Whether to skip transactions with a non-positive `rate`. Verified in
 * RESEARCH-6639.md §A2/§A3: the coinbase sits at array index 0 with rate 0, and a
 * 0-fee 1p1c package parent that CPFP failed to cluster also carries rate 0. Either
 * would pin a naive MIN() to 0, so both must be excluded.
 */
export const EXCLUDE_ZERO_RATE = true;

export interface MinFeeRateInputs {
  transactions: { txid: string; rate?: number }[]; // summary txs, block order, coinbase at index 0
  prioritizedTxs: string[];
  acceleratedTxs: string[];
  accelerationTxids: string[];
}

export interface MinFeeRateInputSnapshot {
  auditVersion: number | null;
  accelerationCount: number;
  accelerationFingerprint: string;
}

export interface MinFeeRateAccelerationState {
  txids: string[];
  count: number;
  fingerprint: string;
}

export interface MinFeeRateDay {
  minRate: number;
  minHeight: number;
  timestamp: number;
  usableBlockCount: number;
}

export function isMinFeeRateVersionStale(storedVersion: number): boolean {
  return storedVersion < MIN_FEE_RATE_VERSION;
}

/**
 * Computes a block's minimum fee-merit effective fee rate. Callers must only invoke
 * this after successfully loading a trusted summary and an audit row. A null result
 * is a valid answer for a block with no qualifying non-coinbase transaction.
 */
export function computeMinFeeRate(inputs: MinFeeRateInputs): number | null {
  const excluded = new Set<string>([
    ...inputs.prioritizedTxs,
    ...inputs.acceleratedTxs,
    ...inputs.accelerationTxids,
  ]);

  let min: number | null = null;
  // Skip index 0: the coinbase is identified positionally, not by a flag.
  for (let i = 1; i < inputs.transactions.length; i++) {
    const tx = inputs.transactions[i];
    if (tx.rate == null || (EXCLUDE_ZERO_RATE && tx.rate <= 0)) {
      continue;
    }
    if (excluded.has(tx.txid)) {
      continue;
    }
    if (min === null || tx.rate < min) {
      min = tx.rate;
    }
  }

  return min;
}
