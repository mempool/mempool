import { IMempoolInfo, ITransaction, IBlock } from '../../interfaces';

export interface AbstractBitcoinApi {
  getMempoolInfo(): Promise<IMempoolInfo>;
  getRawMempool(): Promise<ITransaction['txid'][]>;
  getRawTransaction(txId: string): Promise<ITransaction>;
  getBlockCount(): Promise<number>;
  getBlock(hash: string): Promise<IBlock>;
  getBlockHash(height: number): Promise<string>;
}
