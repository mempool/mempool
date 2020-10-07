import { Block, Transaction } from './electrs.interface';

export interface WebsocketResponse {
  block?: Block;
  blocks?: Block[];
  conversions?: any;
  txConfirmed?: boolean;
  historicalDate?: string;
  mempoolInfo?: MempoolInfo;
  vBytesPerSecond?: number;
  lastDifficultyAdjustment?: number;
  action?: string;
  data?: string[];
  tx?: Transaction;
  rbfTransaction?: Transaction;
  transactions?: TransactionStripped[];
  donationConfirmed?: boolean;
  'track-tx'?: string;
  'track-address'?: string;
  'track-asset'?: string;
  'watch-mempool'?: boolean;
  'track-donation'?: string;
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

export interface MempoolInfo {
  size: number;
  bytes: number;
}

export interface TransactionStripped {
  txid: string;
  fee: number;
  weight: number;
  value: number;
}

