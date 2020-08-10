import { Block, Transaction } from './electrs.interface';

export interface WebsocketResponse {
  block?: Block;
  blocks?: Block[];
  conversions?: any;
  txConfirmed?: boolean;
  historicalDate?: string;
  mempoolInfo?: MempoolInfo;
  vBytesPerSecond?: number;
  action?: string;
  data?: string[];
  tx?: Transaction;
  rbfTransaction?: Transaction;
  'track-tx'?: string;
  'track-address'?: string;
  'track-asset'?: string;
  'watch-mempool'?: boolean;
}

export interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
  index: number;
}

export interface MemPoolState {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
  gitCommit: string;
}

export interface MempoolInfo {
  size: number;
  bytes: number;
  usage?: number;
  maxmempool?: number;
  mempoolminfee?: number;
  minrelaytxfee?: number;
}
