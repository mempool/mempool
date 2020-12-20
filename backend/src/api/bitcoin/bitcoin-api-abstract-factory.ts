import { MempoolInfo, Transaction, Block, MempoolEntries, MempoolEntry } from '../../interfaces';

export interface AbstractBitcoinApi {
  getMempoolInfo(): Promise<MempoolInfo>;
  getRawMempool(): Promise<Transaction['txid'][]>;
  getRawTransaction(txId: string): Promise<Transaction>;
  getBlockHeightTip(): Promise<number>;
  getTxIdsForBlock(hash: string): Promise<string[]>;
  getBlockHash(height: number): Promise<string>;
  getBlock(hash: string): Promise<Block>;
  getMempoolEntry(txid: string): Promise<MempoolEntry>;

  // Custom
  getRawMempoolVerbose(): Promise<MempoolEntries>;
  getRawTransactionBitcond(txId: string): Promise<Transaction>;
}
