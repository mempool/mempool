export interface MempoolInfo {
  size: number;
  bytes: number;
  usage?: number;
  maxmempool?: number;
  mempoolminfee?: number;
  minrelaytxfee?: number;
}

export interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  feeRange: number[];
}

export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  fee: number;
  size: number;
  weight: number;
  vin: Vin[];
  vout: Vout[];
  status: Status;
}

export interface SimpleTransaction {
  txid: string;
  fee: number;
  size: number;
  vsize: number;
  feePerVsize: number;
}

export interface Prevout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface Vin {
  txid: string;
  vout: number;
  prevout: Prevout;
  scriptsig: string;
  scriptsig_asm: string;
  inner_redeemscript_asm?: string;
  is_coinbase: boolean;
  sequence: any;
  witness?: string[];
  inner_witnessscript_asm?: string;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface Status {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface Block {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  nonce: any;
  bits: number;

  medianFee?: number;
  feeRange?: number[];
}

export interface Address {
  address: string;
  chain_stats: ChainStats;
  mempool_stats: MempoolStats;
}

export interface ChainStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface MempoolStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface Statistic {
  id?: number;
  added: string;
  unconfirmed_transactions: number;
  tx_per_second: number;
  vbytes_per_second: number;
  total_fee: number;
  mempool_byte_weight: number;
  fee_data: string;

  vsize_1: number;
  vsize_2: number;
  vsize_3: number;
  vsize_4: number;
  vsize_5: number;
  vsize_6: number;
  vsize_8: number;
  vsize_10: number;
  vsize_12: number;
  vsize_15: number;
  vsize_20: number;
  vsize_30: number;
  vsize_40: number;
  vsize_50: number;
  vsize_60: number;
  vsize_70: number;
  vsize_80: number;
  vsize_90: number;
  vsize_100: number;
  vsize_125: number;
  vsize_150: number;
  vsize_175: number;
  vsize_200: number;
  vsize_250: number;
  vsize_300: number;
  vsize_350: number;
  vsize_400: number;
  vsize_500: number;
  vsize_600: number;
  vsize_700: number;
  vsize_800: number;
  vsize_900: number;
  vsize_1000: number;
  vsize_1200: number;
  vsize_1400: number;
  vsize_1600: number;
  vsize_1800: number;
  vsize_2000: number;
}

export interface OptimizedStatistic {
  id: number;
  added: string;
  unconfirmed_transactions: number;
  tx_per_second: number;
  vbytes_per_second: number;
  total_fee: number;
  mempool_byte_weight: number;
  vsizes: number[];
}

export interface Outspend {
  spent: boolean;
  txid: string;
  vin: number;
  status: Status;
}

