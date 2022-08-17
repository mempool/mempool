import { IEsploraApi } from './api/bitcoin/esplora-api.interface';

export interface PoolTag {
  id: number; // mysql row id
  name: string;
  link: string;
  regexes: string; // JSON array
  addresses: string; // JSON array
  slug: string;
}

export interface PoolInfo {
  poolId: number; // mysql row id
  name: string;
  link: string;
  blockCount: number;
  slug: string;
}

export interface PoolStats extends PoolInfo {
  rank: number;
  emptyBlocks: number;
}

export interface BlockAudit {
  time: number,
  height: number,
  hash: string,
  missingTxs: string[],
  addedTxs: string[],
  matchRate: number,
}

export interface MempoolBlock {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  medianFee: number;
  totalFees: number;
  feeRange: number[];
}

export interface MempoolBlockWithTransactions extends MempoolBlock {
  transactionIds: string[];
  transactions: TransactionStripped[];
}

export interface MempoolBlockDelta {
  added: TransactionStripped[];
  removed: string[];
}

interface VinStrippedToScriptsig {
  scriptsig: string;
}

interface VoutStrippedToScriptPubkey {
  scriptpubkey_address: string | undefined;
  value: number;
}

export interface TransactionExtended extends IEsploraApi.Transaction {
  vsize: number;
  feePerVsize: number;
  firstSeen?: number;
  effectiveFeePerVsize: number;
  ancestors?: Ancestor[];
  bestDescendant?: BestDescendant | null;
  cpfpChecked?: boolean;
  deleteAfter?: number;
}

interface Ancestor {
  txid: string;
  weight: number;
  fee: number;
}

interface BestDescendant {
  txid: string;
  weight: number;
  fee: number;
}

export interface CpfpInfo {
  ancestors: Ancestor[];
  bestDescendant: BestDescendant | null;
}

export interface TransactionStripped {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}

export interface BlockExtension {
  totalFees?: number;
  medianFee?: number;
  feeRange?: number[];
  reward?: number;
  coinbaseTx?: TransactionMinerInfo;
  matchRate?: number;
  pool?: {
    id: number;
    name: string;
    slug: string;
  };
  avgFee?: number;
  avgFeeRate?: number;
  coinbaseRaw?: string;
  usd?: number | null;
}

export interface BlockExtended extends IEsploraApi.Block {
  extras: BlockExtension;
}

export interface BlockSummary {
  id: string;
  transactions: TransactionStripped[];
}

export interface BlockPrice {
  height: number;
  priceId: number;
}

export interface TransactionMinerInfo {
  vin: VinStrippedToScriptsig[];
  vout: VoutStrippedToScriptPubkey[];
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
  added: string;
  vbytes_per_second: number;
  total_fee: number;
  mempool_byte_weight: number;
  vsizes: number[];
}

export interface WebsocketResponse {
  action: string;
  data: string[];
  'track-tx': string;
  'track-address': string;
  'watch-mempool': boolean;
  'track-bisq-market': string;
}

export interface VbytesPerSecond {
  unixTime: number;
  vSize: number;
}

export interface RequiredSpec { [name: string]: RequiredParams; }

interface RequiredParams {
  required: boolean;
  types: ('@string' | '@number' | '@boolean' | string)[];
}

export interface ILoadingIndicators { [name: string]: number; }
export interface IConversionRates { [currency: string]: number; }

export interface IBackendInfo {
  hostname: string;
  gitCommit: string;
  version: string;
}

export interface IDifficultyAdjustment {
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
}

export interface IndexedDifficultyAdjustment {
  time: number; // UNIX timestamp
  height: number; // Block height
  difficulty: number;
  adjustment: number;
}

export interface RewardStats {
  totalReward: number;
  totalFee: number;
  totalTx: number;
}

export interface ITopNodesPerChannels {
  publicKey: string,
  alias: string,
  channels?: number,
  capacity: number,
  firstSeen?: number,
  updatedAt?: number,
  city?: any,
  country?: any,
}

export interface ITopNodesPerCapacity {
  publicKey: string,
  alias: string,
  capacity: number,
  channels?: number,
  firstSeen?: number,
  updatedAt?: number,
  city?: any,
  country?: any,
}

export interface INodesRanking {
  topByCapacity: ITopNodesPerCapacity[];
  topByChannels: ITopNodesPerChannels[];
}

export interface IOldestNodes {
  publicKey: string,
  alias: string,
  firstSeen: number,
  channels?: number,
  capacity: number,
  updatedAt?: number,
  city?: any,
  country?: any,
}