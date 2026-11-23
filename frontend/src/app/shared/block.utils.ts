import { BlockExtension } from '@interfaces/node-api.interface';

type BlockWithFeeStats = { extras?: Pick<BlockExtension, 'medianFee' | 'feeRange'> };

/**
 * Whether a block's `feeRange` holds effective fee rates rather than Bitcoin Core's `getblockstats`
 * percentiles. The API does not say which. Core's percentiles are whole numbers with the median as
 * the fourth entry; effective rates are fractional.
 */
export function hasEffectiveFeeRange(extras: Pick<BlockExtension, 'medianFee' | 'feeRange'>): boolean {
  return extras.medianFee !== extras.feeRange[3] || extras.feeRange.some(rate => !Number.isInteger(rate));
}

/** Lowest fee rate to show for a block. A `getblockstats` range starts with an outlier, so its 10th percentile is used. */
export function getMinBlockFee(block: BlockWithFeeStats): number {
  if (block?.extras?.feeRange) {
    return hasEffectiveFeeRange(block.extras) ? block.extras.feeRange[0] : block.extras.feeRange[1];
  }
  return 0;
}

/** Highest fee rate to show for a block */
export function getMaxBlockFee(block: BlockWithFeeStats): number {
  if (block?.extras?.feeRange) {
    return block.extras.feeRange[block.extras.feeRange.length - 1];
  }
  return 0;
}
