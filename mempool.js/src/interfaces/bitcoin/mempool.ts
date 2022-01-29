export interface Mempool {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: number[];
}

export interface MempoolInstance {
  getMempool: () => Promise<Mempool[]>;
  getMempoolTxids: () => Promise<string[]>;
  getMempoolRecent: () => Promise<MempoolRecent[]>;
}

export interface MempoolRecent {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}
