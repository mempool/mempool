export interface Tx {
  txVersion: string;
  id: string;
  blockHeight: number;
  blockHash: string;
  time: number;
  inputs: [];
  outputs: [
    {
      txVersion: string;
      txId: string;
      index: number;
      bsqAmount: number;
      btcAmount: number;
      height: number;
      isVerified: true;
      burntFee: number;
      invalidatedBsq: number;
      address: string;
      scriptPubKey: {
        addresses: [string];
        asm: string;
        hex: string;
        reqSigs: number;
        type: string;
      };
      time: number;
      txType: string;
      txTypeDisplayString: string;
      txOutputType: string;
      txOutputTypeDisplayString: string;
      lockTime: number;
      isUnspent: true;
    }
  ];
  txType: string;
  txTypeDisplayString: string;
  burntFee: number;
  invalidatedBsq: number;
  unlockBlockHeight: number;
}

export interface TransactionsInstance {
  getTx: (params: { txid: string }) => Promise<Tx>;
  getTxs: (params: { index: number; length: number }) => Promise<Tx[]>;
}
