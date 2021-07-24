export interface OptimizedMempoolStats {
  id: number;
  added: string;
  unconfirmed_transactions: number;
  tx_per_second: number;
  vbytes_per_second: number;
  total_fee: number;
  mempool_byte_weight: number;
  vsizes: number[] | string[];
}

interface Ancestor {
  txid: string;
  weight: number;
  fee: number;
}

interface BestDescendant {
  txid: string;
  weight: number;
  fee: number;
}

export interface CpfpInfo {
  ancestors: Ancestor[];
  bestDescendant: BestDescendant | null;
}

export interface DifficultyAdjustment {
  difficultyChange: number;
  estimatedRetargetDate: number;
  previousRetarget: number;
  progressPercent: number;
  remainingBlocks: number;
  remainingTime: number;
}
