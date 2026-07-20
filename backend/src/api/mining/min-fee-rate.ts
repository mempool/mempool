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
 * Whether a block with no audit row yields "unavailable" rather than a value
 * computed without exclusions. Verified in RESEARCH-6639.md §A4: audit rows are
 * only ever written for blocks observed live, in sync, with MEMPOOL.AUDIT=true, and
 * cannot be backfilled. Without an audit we cannot know which txs were boosted, so a
 * min computed anyway would be understated. This mirrors the existing audit-gated
 * Blocks Health chart, which simply has no data on non-auditing instances.
 */
export const REQUIRE_AUDIT = true;

/**
 * Whether to skip transactions with a non-positive `rate`. Verified in
 * RESEARCH-6639.md §A2/§A3: the coinbase sits at array index 0 with rate 0, and a
 * 0-fee 1p1c package parent that CPFP failed to cluster also carries rate 0. Either
 * would pin a naive MIN() to 0, so both must be excluded.
 */
export const EXCLUDE_ZERO_RATE = true;

/**
 * Persisted state of the per-block metric, stored in blocks.min_fee_rate_status.
 * An explicit status column is used rather than an in-band sentinel in min_fee_rate
 * so the two "unavailable" reasons stay distinct — one is permanent, one is not —
 * and so a real rate column never has to encode a magic value. Precedent: the
 * template_algo status column and the index_version progress sentinel.
 *
 * - Pending (0):              DB default; never computed yet.
 * - Available (1):            min_fee_rate holds a real rate.
 * - UnavailablePermanent (2): no audit row (audits are not backfillable), or an
 *                             audit is present but no tx earned inclusion on fee
 *                             merit — neither can improve, so this is final.
 * - UnavailableRetry (3):     summary version < MIN_SUMMARY_VERSION. $classifyBlocks
 *                             continuously upgrades summaries to version 2, so this
 *                             block may become computable on a later pass.
 *
 * min_fee_rate is non-NULL if and only if status === Available.
 */
export enum MinFeeRateStatus {
  Pending = 0,
  Available = 1,
  UnavailablePermanent = 2,
  UnavailableRetry = 3,
}

export interface MinFeeRateResult {
  status: MinFeeRateStatus;
  rate: number | null; // non-null iff status === Available
}

export interface MinFeeRateInputs {
  transactions: { txid: string; rate?: number }[]; // summary txs, block order, coinbase at index 0
  summaryVersion: number;
  hasAudit: boolean;
  prioritizedTxs: string[];
  acceleratedTxs: string[];
  accelerationTxids: string[];
}

/**
 * Classifies a block's minimum fee-merit effective fee rate into a persistable
 * result. Never returns Pending — that is a DB default, not a compute outcome; every
 * path here resolves to Available, UnavailablePermanent, or UnavailableRetry.
 */
export function computeMinFeeRate(inputs: MinFeeRateInputs): MinFeeRateResult {
  // No audit → we cannot know which txs were boosted out-of-band, and audits are
  // never backfillable, so this is permanent. Checked before the version gate: a
  // missing audit stays permanent regardless of summary version.
  if (REQUIRE_AUDIT && !inputs.hasAudit) {
    return { status: MinFeeRateStatus.UnavailablePermanent, rate: null };
  }

  // Untrusted summary version — but $classifyBlocks upgrades summaries to version 2
  // over time, so retry rather than finalise.
  if (inputs.summaryVersion < MIN_SUMMARY_VERSION) {
    return { status: MinFeeRateStatus.UnavailableRetry, rate: null };
  }

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

  // Audit was present and no tx earned inclusion on fee merit — this is the genuine
  // answer for the block and will not improve, so it is permanent.
  if (min === null) {
    return { status: MinFeeRateStatus.UnavailablePermanent, rate: null };
  }

  return { status: MinFeeRateStatus.Available, rate: min };
}
