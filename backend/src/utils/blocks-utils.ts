import { BlockExtended } from '../mempool.interfaces';

export function prepareBlock(block: any): BlockExtended {
  return <BlockExtended>{
    id: block.id ?? block.hash, // hash for indexed block
    timestamp: block.timestamp ?? block.blockTimestamp, // blockTimestamp for indexed block
    height: block.height,
    version: block.version,
    bits: block.bits,
    nonce: block.nonce,
    difficulty: block.difficulty,
    merkle_root: block.merkle_root,
    tx_count: block.tx_count,
    size: block.size,
    weight: block.weight,
    previousblockhash: block.previousblockhash,
    extras: {
      coinbaseRaw: block.coinbase_raw ?? block.extras.coinbaseRaw,
      medianFee: block.medianFee ?? block.median_fee ?? block.extras?.medianFee,
      feeRange: block.feeRange ?? block.fee_span,
      reward: block.reward ?? block?.extras?.reward,
      totalFees: block.totalFees ?? block?.fees ?? block?.extras?.totalFees,
      avgFee: block?.extras?.avgFee ?? block.avg_fee,
      avgFeeRate: block?.avgFeeRate ?? block.avg_fee_rate,
      pool: block?.extras?.pool ?? (block?.pool_id ? {
        id: block.pool_id,
        name: block.pool_name,
        slug: block.pool_slug,
      } : undefined),
    }
  };
}
