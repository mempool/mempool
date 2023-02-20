import { BlockExtended } from '../mempool.interfaces';

export function prepareBlock(block: any): BlockExtended {
  return <BlockExtended>{
    id: block.id ?? block.hash, // hash for indexed block
    timestamp: block.timestamp ?? block.time ?? block.blockTimestamp, // blockTimestamp for indexed block
    height: block.height,
    version: block.version,
    bits: (typeof block.bits === 'string' ? parseInt(block.bits, 16): block.bits),
    nonce: block.nonce,
    difficulty: block.difficulty,
    merkle_root: block.merkle_root ?? block.merkleroot,
    tx_count: block.tx_count ?? block.nTx,
    size: block.size,
    weight: block.weight,
    previousblockhash: block.previousblockhash,
    medianTimestamp: block.extras?.medianTimestamp ?? block.medianTime,
    extras: {
      coinbaseRaw: block.coinbase_raw ?? block.extras?.coinbaseRaw,
      medianFee: block.medianFee ?? block.median_fee ?? block.extras?.medianFee,
      feeRange: block.feeRange ?? block.extras?.feeRange ?? block.fee_span,
      reward: block.reward ?? block.extras?.reward,
      totalFees: block.totalFees ?? block.fees ?? block.extras?.totalFees,
      avgFee: block.extras?.avgFee ?? block.avg_fee,
      avgFeeRate: block.avgFeeRate ?? block.avg_fee_rate,
      pool: block.extras?.pool ?? (block.pool_id ? {
        id: block.pool_id,
        name: block.pool_name,
        slug: block.pool_slug,
      } : undefined),
      usd: block.extras?.usd ?? block.usd ?? null,
      utxoSetChange: block.extras?.utxoSetChange ?? block.utxoset_change,
      avgTxSize: block.extras?.avgTxSize ?? block.avg_tx_size,
      totalInputs: block.extras?.totalInputs ?? block.total_inputs,
      totalOutputs: block.extras?.totalOutputs ?? block.total_outputs,
      totalOutputAmt: block.extras?.totalOutputAmt ?? block.total_output_amt,
      segwitTotalTxs: block.extras?.segwitTotalTxs ?? block.segwit_total_txs,
      segwitTotalSize: block.extras?.segwitTotalSize ?? block.segwit_total_size,
      segwitTotalWeight: block.extras?.segwitTotalWeight ?? block.segwit_total_weight,
      orphans: block.extras?.orphans,
      feePercentiles: block.extras?.feePercentiles ?? block.fee_percentiles ?? null,
      medianFeeAmt: block.extras?.medianFeeAmt ?? block.median_fee_amt ?? null,
      coinbaseAddress: block.extras?.coinbaseAddress ?? block.coinbase_address,
      coinbaseSignature: block.extras?.coinbaseSignature ?? block.coinbase_signature,
      header: block.extras?.header ?? block.header,
      utxoSetSize: block.extras?.utxoSetSize ?? block.utxoset_change ?? null,
      totalInputAmt: block.extras?.totalInputAmt ?? block.total_input_amt ?? null,
    }
  };
}
