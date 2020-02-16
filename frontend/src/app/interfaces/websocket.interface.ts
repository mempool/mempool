import { Block } from './electrs.interface';

export interface WebsocketResponse {
  block?: Block;
  blocks?: Block[];
  conversions?: any;
  txId?: string;
  txConfirmed?: boolean;
  historicalDate?: string;
}

export interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  feeRange: number[];
}
