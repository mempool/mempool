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

interface DescendedFees {
  txid: string;
  weight: number;
  fee: number;
}

export interface CpfpInfo {
  ancestors: Ancestor[];
  descended: DescendedFees | null;
}
