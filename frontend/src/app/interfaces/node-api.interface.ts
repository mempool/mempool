
export interface BlockTransaction {
  f: number;
}

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

interface FeeData {
  vsize: { [ fee: string ]: number };
}
