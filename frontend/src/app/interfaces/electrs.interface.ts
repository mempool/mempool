export interface Transaction {
  txid: string;
  version: number;
  locktime: number;
  fee: number;
  size: number;
  weight: number;
  vin: Vin[];
  vout: Vout[];
  status: Status;
  firstSeen?: number;
}

export interface Recent {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}

export interface Prevout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface Vin {
  txid: string;
  vout: number;
  prevout: Prevout;
  scriptsig: string;
  scriptsig_asm: string;
  inner_redeemscript_asm?: string;
  is_coinbase: boolean;
  sequence: any;
  witness?: string[];
  inner_witnessscript_asm?: string;
  is_pegin?: boolean;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
  valuecommitment?: number;
  asset?: string;
  pegout?: Pegout;
}

interface Pegout {
  genesis_hash: string;
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_addres: string;
}

export interface Status {
  confirmed: boolean;
  block_height?: number;
  block_hash?: string;
  block_time?: number;
}

export interface Block {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;

  medianFee?: number;
  feeRange?: number[];
  reward?: number;
}

export interface Address {
  address: string;
  chain_stats: ChainStats;
  mempool_stats: MempoolStats;
}

export interface ChainStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface MempoolStats {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface Outspend {
  spent: boolean;
  txid: string;
  vin: number;
  status: Status;
}

export interface Asset {
  asset_id: string;
  issuance_txin: IssuanceTxin;
  issuance_prevout: IssuancePrevout;
  reissuance_token: string;
  contract_hash: string;
  status: Status;
  chain_stats: AssetChainStats;
  mempool_stats: AssetMempoolStats;
}

interface IssuanceTxin {
  txid: string;
  vin: number;
}

interface IssuancePrevout {
  txid: string;
  vout: number;
}

interface AssetChainStats {
  tx_count: number;
  issuance_count: number;
  issued_amount: number;
  burned_amount: number;
  has_blinded_issuances: boolean;
  reissuance_tokens: number;
  burned_reissuance_tokens: number;

  peg_in_count: number;
  peg_in_amount: number;
  peg_out_count: number;
  peg_out_amount: number;
  burn_count: number;
}

interface AssetMempoolStats {
  tx_count: number;
  issuance_count: number;
  issued_amount: number;
  burned_amount: number;
  has_blinded_issuances: boolean;
  reissuance_tokens: any;
  burned_reissuance_tokens: number;

  peg_in_count: number;
  peg_in_amount: number;
  peg_out_count: number;
  peg_out_amount: number;
  burn_count: number;
}

interface Entity {
  domain: string;
}
