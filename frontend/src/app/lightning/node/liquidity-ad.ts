export interface ILiquidityAd {
  funding_weight: number;
  lease_fee_basis: number; // lease fee rate in parts-per-thousandth
  lease_fee_base_sat: number; // fixed lease fee in sats
  channel_fee_max_rate: number; // max routing fee rate in parts-per-thousandth
  channel_fee_max_base: number; // max routing base fee in milli-sats
  compact_lease?: string;
}

export function parseLiquidityAdHex(compact_lease: string): ILiquidityAd | false {
  if (!compact_lease || compact_lease.length < 20 || compact_lease.length > 28) {
    return false;
  }
  try {
    const liquidityAd: ILiquidityAd = {
      funding_weight: parseInt(compact_lease.slice(0, 4), 16),
      lease_fee_basis: parseInt(compact_lease.slice(4, 8), 16),
      channel_fee_max_rate: parseInt(compact_lease.slice(8, 12), 16),
      lease_fee_base_sat: parseInt(compact_lease.slice(12, 20), 16),
      channel_fee_max_base: compact_lease.length > 20 ? parseInt(compact_lease.slice(20), 16) : 0,
    };
    if (Object.values(liquidityAd).reduce((valid: boolean, value: number): boolean => (valid && !isNaN(value) && value >= 0), true)) {
      liquidityAd.compact_lease = compact_lease;
      return liquidityAd;
    } else {
      return false;
    }
  } catch (err) {
    return false;
  }
}