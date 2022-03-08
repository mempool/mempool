import { ILoadingIndicators } from '../services/state.service';
import { Transaction } from './electrs.interface';
import { BlockExtended } from './node-api.interface';

export interface WebsocketResponse {
  block?: BlockExtended;
  blocks?: BlockExtended[];
  conversions?: any;
  txConfirmed?: boolean;
  historicalDate?: string;
  mempoolInfo?: MempoolInfo;
  vBytesPerSecond?: number;
  lastDifficultyAdjustment?: number;
  previousRetarget?: number;
  action?: string;
  data?: string[];
  tx?: Transaction;
  rbfTransaction?: ReplacedTransaction;
  txReplaced?: ReplacedTransaction;
  utxoSpent?: object;
  transactions?: TransactionStripped[];
  loadingIndicators?: ILoadingIndicators;
  backendInfo?: IBackendInfo;
  'track-tx'?: string;
  'track-address'?: string;
  'track-asset'?: string;
  'watch-mempool'?: boolean;
  'track-bisq-market'?: string;
}

export interface ReplacedTransaction extends Transaction {
  txid: string;
}
export interface MempoolBlock {
  blink?: boolean;
  height?: number;
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
  index: number;
}

export interface MempoolInfo {
  loaded: boolean;                 //  (boolean) True if the mempool is fully loaded
  size: number;                    //  (numeric) Current tx count
  bytes: number;                   //  (numeric) Sum of all virtual transaction sizes as defined in BIP 141.
  usage: number;                   //  (numeric) Total memory usage for the mempool
  maxmempool: number;              //  (numeric) Maximum memory usage for the mempool
  mempoolminfee: number;           //  (numeric) Minimum fee rate in BTC/kB for tx to be accepted.
  minrelaytxfee: number;           //  (numeric) Current minimum relay fee for transactions
}

export interface TransactionStripped {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}

export interface IBackendInfo {
  hostname: string;
  gitCommit: string;
  version: string;
}
