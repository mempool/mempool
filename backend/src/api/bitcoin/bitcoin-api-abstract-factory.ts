import { IMempoolInfo, ITransaction, IBlock } from '../../interfaces';

export interface AbstractBitcoinApi {
  getMempoolInfo(): Promise<IMempoolInfo>;
  getRawMempool(): Promise<ITransaction['txid'][]>;
  getRawTransaction(txId: string): Promise<ITransaction>;
  getBlockCount(): Promise<number>;
  getBlockAndTransactions(hash: string): Promise<IBlock>;
  getBlockHash(height: number): Promise<string>;

  getBlock(hash: string): Promise<IBlock>;
  getBlockTransactions(hash: string): Promise<IBlock>;
  getBlockTransactionsFromIndex(hash: string, index: number): Promise<IBlock>;
  getBlocks(): Promise<string>;
  getBlocksFromHeight(height: number): Promise<string>;
}
