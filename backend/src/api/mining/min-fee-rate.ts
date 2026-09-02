/**
 * Minimum "fee-merit" effective fee rate for a block (mempool issue #6639). Inherits the
 * 0.1 sat/vB noise tolerance in identifyPrioritizedTransactions, large at these rates.
 */
import transactionUtils from '../transaction-utils';

/** Blocks per backfill pass. One pass per run keeps the queue off the indexer loop. */
export const MIN_FEE_RATE_BATCH_SIZE = 1000;

/** Bump whenever the algorithm changes; blocks with a lower stored version are recomputed. */
export const MIN_FEE_RATE_VERSION = 1;

/** Core 30.0 lowered the default minrelaytxfee to 0.1 sat/vB on this date. */
export const MIN_FEE_RATE_START_TIMESTAMP = Date.UTC(2025, 9, 10) / 1000;

export interface MinFeeRateTx {
  txid: string;
  effectiveFeePerVsize?: number;
}

export interface MinFeeRateDay {
  minRate: number;
  minHeight: number;
  timestamp: number;
}

/** Transactions in block order, coinbase first. Null is a valid answer, not a failure. */
export function computeMinFeeRate(
  orderedTxs: readonly MinFeeRateTx[],
  acceleratedTxids: ReadonlySet<string>,
): number | null {
  if (orderedTxs.length < 2) {
    return null;
  }

  // Dropped before the LIS, not just from the final minimum: in a near-empty block a
  // pair of zero-rate transactions forms the longest chain and becomes the baseline.
  const feePaying = orderedTxs.slice(1).filter(tx => (tx.effectiveFeePerVsize ?? 0) > 0);
  if (!feePaying.length) {
    return null;
  }

  // The coinbase is kept at index 0 because identifyPrioritizedTransactions skips it
  // positionally; it carries no fee and must not shift that offset.
  const { prioritized } = transactionUtils.identifyPrioritizedTransactions(
    [orderedTxs[0], ...feePaying],
    'effectiveFeePerVsize',
  );
  const excluded = new Set<string>(prioritized);

  let min: number | null = null;
  for (const tx of feePaying) {
    if (excluded.has(tx.txid) || acceleratedTxids.has(tx.txid)) {
      continue;
    }
    const rate = tx.effectiveFeePerVsize as number;
    if (min === null || rate < min) {
      min = rate;
    }
  }

  return min;
}
