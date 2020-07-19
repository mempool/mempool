
export interface BisqBlocks {
  chainHeight: number;
  blocks: BisqBlock[];
}

export interface BisqBlock {
  height: number;
  time: number;
  hash: string;
  previousBlockHash: string;
  txs: BisqTransaction[];
}

export interface BisqTransaction {
  txVersion: string;
  id: string;
  blockHeight: number;
  blockHash: string;
  time: number;
  inputs: BisqInput[];
  outputs: BisqOutput[];
  txType: string;
  txTypeDisplayString: string;
  burntFee: number;
  invalidatedBsq: number;
  unlockBlockHeight: number;
}

interface BisqInput {
  spendingTxOutputIndex: number;
  spendingTxId: string;
  bsqAmount: number;
  isVerified: boolean;
  address: string;
  time: number;
}

export interface BisqOutput {
  txVersion: string;
  txId: string;
  index: number;
  bsqAmount: number;
  btcAmount: number;
  height: number;
  isVerified: boolean;
  burntFee: number;
  invalidatedBsq: number;
  address: string;
  scriptPubKey: BisqScriptPubKey;
  spentInfo?: SpentInfo;
  time: any;
  txType: string;
  txTypeDisplayString: string;
  txOutputType: string;
  txOutputTypeDisplayString: string;
  lockTime: number;
  isUnspent: boolean;
  opReturn?: string;
}

export interface BisqStats {
  minted: number;
  burnt: number;
  addresses: number;
  unspent_txos: number;
  spent_txos: number;
}

interface BisqScriptPubKey {
  addresses: string[];
  asm: string;
  hex: string;
  reqSigs: number;
  type: string;
}

interface SpentInfo {
  height: number;
  inputIndex: number;
  txId: string;
}
