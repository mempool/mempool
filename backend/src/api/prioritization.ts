/**
 * Detects transactions that earned their block position out-of-band rather than on
 * fee merit: prioritised (e.g. via `prioritisetransaction`) or accelerated. Shared by
 * the accelerator pricing path (`calculateBoostRate`) and the minimum daily fee rate
 * metric, so both use exactly one criterion for what counts as "not fee merit".
 */

export interface OutOfBandCandidate {
  txid: string;
  effectiveFeePerVsize: number;
  cluster: readonly string[]; // same-block CPFP cluster, including the tx itself
}

/**
 * @param orderedTxs Block order, coinbase at index 0.
 * @param acceleratedTxids Txids with a known acceleration record for this block.
 * @returns The set of txids to exclude: prioritised transactions and their clusters,
 * plus accelerated transactions and their clusters.
 */
export function findOutOfBandTransactions(
  orderedTxs: readonly OutOfBandCandidate[],
  acceleratedTxids: ReadonlySet<string>,
): Set<string> {
  const excluded = new Set<string>();
  let lastEffectiveRate = 0;
  // Walk the block from the bottom up: transactions should appear in ascending order
  // of mining priority, so a drop in effective rate below the running baseline can only
  // mean the transaction was prioritized out-of-band. The baseline itself must not
  // advance past a prioritized or accelerated transaction, or a single boosted
  // transaction would silently raise the floor for everything above it.
  for (let i = orderedTxs.length - 1; i >= 0; i--) {
    const tx = orderedTxs[i];
    const isAccelerated = acceleratedTxids.has(tx.txid);
    const isPrioritized = tx.effectiveFeePerVsize < lastEffectiveRate;
    if (isPrioritized || isAccelerated) {
      for (const clusterTxid of tx.cluster) {
        excluded.add(clusterTxid);
      }
    }
    if (!isPrioritized && !isAccelerated) {
      lastEffectiveRate = tx.effectiveFeePerVsize;
    }
  }
  return excluded;
}
