/**
 * Minimum "fee-merit" effective fee rate for a single block (mempool issue #6639).
 *
 * The metric is the lowest CPFP-effective fee rate among the transactions that
 * earned their block inclusion on fee merit alone. Transactions that were boosted
 * out-of-band (prioritised via prioritisetransaction, or accelerated) are excluded
 * using the same greedy scan the accelerator pricing path uses to price boosts
 * (`findOutOfBandTransactions`), not the audit's prioritized/accelerated arrays: the
 * audit is a global longest-increasing-subsequence classification with no cluster
 * expansion or baseline guard, a different criterion that was not validated against
 * this metric's reference figures.
 *
 * This module is intentionally pure (no DB, no I/O) so the exclusion logic can be
 * unit-tested exhaustively.
 */
import { findOutOfBandTransactions, OutOfBandCandidate } from '../prioritization';

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
 * Bumped to 2: the exclusion criterion changed from the audit's prioritized/accelerated
 * arrays to the greedy scan shared with the accelerator pricing path, so every
 * previously computed value must be recomputed.
 */
export const MIN_FEE_RATE_VERSION = 2;

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

export interface MinFeeRateInputSnapshot {
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
 * Builds the candidate list `findOutOfBandTransactions` needs from CPFP-summary
 * transactions. Cluster membership is reconstructed from `ancestors`/`descendants`
 * (populated by `calculateGoodBlockCpfp` for every multi-transaction cluster); a
 * transaction with neither is not part of any cluster, so it stands alone.
 */
export function buildOutOfBandCandidates(
  transactions: { txid: string; effectiveFeePerVsize?: number; ancestors?: { txid: string }[]; descendants?: { txid: string }[] }[]
): OutOfBandCandidate[] {
  return transactions.map(tx => ({
    txid: tx.txid,
    effectiveFeePerVsize: tx.effectiveFeePerVsize ?? 0,
    cluster: (tx.ancestors?.length || tx.descendants?.length)
      ? [tx.txid, ...(tx.ancestors || []).map(a => a.txid), ...(tx.descendants || []).map(a => a.txid)]
      : [tx.txid],
  }));
}

/**
 * Computes a block's minimum fee-merit effective fee rate: the lowest effective rate
 * among transactions `findOutOfBandTransactions` does not flag as prioritized or
 * accelerated. A null result is a valid answer for a block with no qualifying
 * non-coinbase transaction.
 */
export function computeMinFeeRate(
  candidates: readonly OutOfBandCandidate[],
  acceleratedTxids: ReadonlySet<string>,
): number | null {
  const excluded = findOutOfBandTransactions(candidates, acceleratedTxids);

  let min: number | null = null;
  // Skip index 0: the coinbase is identified positionally, not by a flag.
  for (let i = 1; i < candidates.length; i++) {
    const tx = candidates[i];
    if (EXCLUDE_ZERO_RATE && tx.effectiveFeePerVsize <= 0) {
      continue;
    }
    if (excluded.has(tx.txid)) {
      continue;
    }
    if (min === null || tx.effectiveFeePerVsize < min) {
      min = tx.effectiveFeePerVsize;
    }
  }

  return min;
}
