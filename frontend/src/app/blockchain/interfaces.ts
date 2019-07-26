export interface IMempoolInfo {
  size: number;
  bytes: number;
  usage: number;
  maxmempool: number;
  mempoolminfee: number;
  minrelaytxfee: number;
}

export interface IMempoolDefaultResponse {
  mempoolInfo?: IMempoolInfo;
  blocks?: IBlock[];
  block?: IBlock;
  projectedBlocks?: IProjectedBlock[];
  'live-2h-chart'?: IMempoolStats;
  txPerSecond?: number;
  vBytesPerSecond: number;
  'track-tx'?: ITrackTx;
  conversions?: any;
}

export interface ITrackTx {
  tx?: ITransaction;
  blockHeight: number;
  tracking: boolean;
  message?: string;
}

export interface IProjectedBlock {
  blockSize: number;
  blockWeight: number;
  maxFee: number;
  maxWeightFee: number;
  medianFee: number;
  minFee: number;
  minWeightFee: number;
  nTx: number;
  hasMytx: boolean;
}

export interface IStrippedBlock {
  bits: number;
  difficulty: number;
  hash: string;
  height: number;
  nTx: number;
  size: number;
  strippedsize: number;
  time: number;
  weight: number;
}

export interface ITransaction {
  txid: string;
  hash: string;
  version: number;
  size: number;
  vsize: number;
  locktime: number;
  vin: Vin[];
  vout: Vout[];
  hex: string;

  fee: number;
  feePerVsize: number;
  feePerWeightUnit: number;
}

export interface IBlock {
  hash: string;
  confirmations: number;
  strippedsize: number;
  size: number;
  weight: number;
  height: number;
  version: number;
  versionHex: string;
  merkleroot: string;
  tx: ITransaction[];
  time: number;
  mediantime: number;
  nonce: number;
  bits: string;
  difficulty: number;
  chainwork: string;
  nTx: number;
  previousblockhash: string;

  minFee: number;
  maxFee: number;
  medianFee: number;
  fees: number;
}

interface ScriptSig {
  asm: string;
  hex: string;
}

interface Vin {
  txid: string;
  vout: number;
  scriptSig: ScriptSig;
  sequence: number;
}

interface ScriptPubKey {
  asm: string;
  hex: string;
  reqSigs: number;
  type: string;
  addresses: string[];
}

interface Vout {
  value: number;
  n: number;
  scriptPubKey: ScriptPubKey;
}

export interface IMempoolStats {
  id: number;
  added: string;
  unconfirmed_transactions: number;
  tx_per_second: number;
  vbytes_per_second: number;
  mempool_byte_weight: number;
  fee_data: IFeeData;
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

export interface IBlockTransaction {
  f: number;
  fpv: number;
}

interface IFeeData {
  wu: { [ fee: string ]: number };
  vsize: { [ fee: string ]: number };
}
