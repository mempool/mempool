import { Block } from './electrs.interface';

export interface WebsocketResponse {
  block?: Block;
  blocks?: Block[];
  conversions?: any;
  txId?: string;
  txConfirmed?: boolean;
  historicalDate?: string;
  mempoolInfo?: MempoolInfo;
  vBytesPerSecond?: number;
  action?: string;
  data?: string[];
}

export interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  feeRange: number[];
}

export interface MemPoolState {
  memPoolInfo: MempoolInfo;
  vBytesPerSecond: number;
}

export interface MempoolInfo {
  size: number;
  bytes: number;
  usage?: number;
  maxmempool?: number;
  mempoolminfee?: number;
  minrelaytxfee?: number;
}
