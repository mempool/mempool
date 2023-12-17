import { ILoadingIndicators } from '../services/state.service';
import { Transaction } from './electrs.interface';
import { BlockExtended, DifficultyAdjustment, RbfTree } from './node-api.interface';

export interface WebsocketResponse {
  block?: BlockExtended;
  blocks?: BlockExtended[];
  conversions?: any;
  txConfirmed?: string;
  historicalDate?: string;
  mempoolInfo?: MempoolInfo;
  vBytesPerSecond?: number;
  previousRetarget?: number;
  action?: string;
  data?: string[];
  tx?: Transaction;
  rbfTransaction?: ReplacedTransaction;
  txReplaced?: ReplacedTransaction;
  rbfInfo?: RbfTree;
  rbfLatest?: RbfTree[];
  rbfLatestSummary?: ReplacementInfo[];
  utxoSpent?: object;
  transactions?: TransactionStripped[];
  loadingIndicators?: ILoadingIndicators;
  backendInfo?: IBackendInfo;
  da?: DifficultyAdjustment;
  fees?: Recommendedfees;
  'track-tx'?: string;
  'track-address'?: string;
  'track-asset'?: string;
  'track-mempool-block'?: number;
  'track-rbf'?: string;
  'track-rbf-summary'?: boolean;
  'watch-mempool'?: boolean;
  'track-bisq-market'?: string;
  'refresh-blocks'?: boolean;
}

export interface ReplacedTransaction extends Transaction {
  txid: string;
}

export interface ReplacementInfo {
  mined: boolean;
  fullRbf: boolean;
  txid: string;
  oldFee: number;
  oldVsize: number;
  newFee: number;
  newVsize: number;
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
  isStack?: boolean;
}

export interface MempoolBlockWithTransactions extends MempoolBlock {
  transactionIds: string[];
  transactions: TransactionStripped[];
}

export interface MempoolBlockDelta {
  added: TransactionStripped[],
  removed: string[],
  changed?: { txid: string, rate: number | undefined, acc: boolean | undefined }[];
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
  acc?: boolean; // is accelerated?
  rate?: number; // effective fee rate
  flags?: number;
  status?: 'found' | 'missing' | 'sigop' | 'fresh' | 'freshcpfp' | 'added' | 'censored' | 'selected' | 'rbf' | 'accelerated';
  context?: 'projected' | 'actual';
}

export interface IBackendInfo {
  hostname?: string;
  gitCommit: string;
  version: string;
}

export interface Recommendedfees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  minimumFee: number;
  economyFee: number;
}