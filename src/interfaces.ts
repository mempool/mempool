import WebSocketServer from 'ws';
export interface Address {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

export interface AddressInstance {
  getAddress: (address: string) => Promise<Address>;
  getAddressTxs: (address: string) => Promise<Tx[]>;
  getAddressTxsChain: (address: string) => Promise<Tx[]>;
  getAddressTxsMempool: (address: string) => Promise<Tx[]>;
  getAddressTxsUtxo: (address: string) => Promise<AddressTxsUtxo[]>;
}

export interface AddressTxsUtxo {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
  value: number;
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
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

export interface BlockInstance {
  getBlock: (hash: string) => Promise<Block>;
  getBlocks: (params: { start_height?: number }) => Promise<Block>;
  getBlockStatus: (hash: string) => Promise<BlockStatus>;
  getBlockTxs: (params: { hash: string; start_index?: number }) => Promise<Tx>;
  getBlockTxids: (hash: string) => Promise<string[]>;
  getBlockTxid: (params: { hash: string; index: number }) => Promise<string>;
  getBlockRaw: (hash: string) => Promise<string>;
  getBlockHeight: (height: number) => Promise<string>;
  getBlocksTipHeight: () => Promise<number>;
  getBlocksTipHash: () => Promise<string>;
}

export interface BlockStatus {
  in_best_chain: boolean;
  height: number;
  next_best: string;
}

export interface FeeInstance {
  getFeesRecommended: () => Promise<FeesRecommended>;
  getFeesMempoolBlocks: () => Promise<FeesMempoolBlocks[]>;
}

export interface FeesMempoolBlocks {
  blockSize: number;
  blockVSize: number;
  nTx: number;
  totalFees: number;
  medianFee: number;
  feeRange: number[];
}

export interface FeesRecommended {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  minimumFee: number;
}

export interface Mempool {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: number[];
}

export interface MempoolConfig {
  apiEndpoint?: string;
  websocketEndpoint?: string;
}

export interface MempoolInstance {
  getMempool: () => Promise<Mempool[]>;
  getMempoolTxids: () => Promise<string[]>;
  getMempoolRecent: () => Promise<MempoolRecent[]>;
}

export interface MempoolReturn {
  addresses: AddressInstance;
  blocks: BlockInstance;
  fees: FeeInstance;
  mempool: MempoolInstance;
  transactions: TxInstance;
  websocket: WsInstance;
}

export interface MempoolRecent {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
}

export interface Tx {
  txid: string;
  version: number;
  locktime: number;
  vin: {
    txid: string;
    vout: number;
    prevout: {
      scriptpubkey: string;
      scriptpubkey_asm: string;
      scriptpubkey_type: string;
      scriptpubkey_address: string;
      value: number;
    };
    scriptsig: string;
    scriptsig_asm: string;
    is_coinbase: boolean;
    sequence: string;
  }[];
  vout: {
    scriptpubkey: string;
    scriptpubkey_asm: string;
    scriptpubkey_type: string;
    scriptpubkey_address: string;
    value: number;
  }[];
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
}

export interface TxStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

export interface TxMerkleProof {
  block_height: number;
  merkle: string[];
  pos: number;
}

export interface TxOutspend {
  spent: boolean;
  txid: string;
  vin: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
}

export interface TxInstance {
  getTx: (txid: string) => Promise<Tx>;
  getTxStatus: (txid: string) => Promise<TxStatus>;
  getTxHex: (txid: string) => Promise<string>;
  getTxRaw: (txid: string) => Promise<string>;
  getTxMerkleBlockProof: (txid: string) => Promise<string>;
  getTxMerkleProof: (txid: string) => Promise<Array<TxMerkleProof>>;
  getTxOutspend: (params: {
    txid: string;
    vout: number;
  }) => Promise<TxOutspend>;
  getTxOutspends: (txid: string) => Promise<Array<TxOutspend>>;
  postTx: (txid: string) => Promise<unknown>;
}

export interface WsInterface {
  options: string[];
}

export interface WsInstance {
  initClient: ({ options }: WsInterface) => WebSocket;
  initServer: ({ options }: WsInterface) => WebSocketServer;
}
