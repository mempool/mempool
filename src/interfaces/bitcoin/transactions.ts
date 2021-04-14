export interface Tx {
  txid: string;
  version: number;
  locktime: number;
  vin: {
    txid: string;
    vout: number;
    prevout: Vout;
    scriptsig: string;
    scriptsig_asm: string;
    is_coinbase: boolean;
    sequence: string;
  }[];
  vout: Vout[];
  size: number;
  weight: number;
  fee: number;
  status: TxStatus;
}

export interface Vout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
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
  status: TxStatus;
}

export interface TxInstance {
  getTx: (params: { txid: string }) => Promise<Tx>;
  getTxStatus: (params: { txid: string }) => Promise<TxStatus>;
  getTxHex: (params: { txid: string }) => Promise<string>;
  getTxRaw: (params: { txid: string }) => Promise<string>;
  getTxMerkleBlockProof: (params: { txid: string }) => Promise<string>;
  getTxMerkleProof: (params: { txid: string }) => Promise<Array<TxMerkleProof>>;
  getTxOutspend: (params: {
    txid: string;
    vout: number;
  }) => Promise<TxOutspend>;
  getTxOutspends: (params: { txid: string }) => Promise<Array<TxOutspend>>;
  postTx: (params: { txid: string }) => Promise<unknown>;
}
