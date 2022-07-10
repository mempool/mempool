import { IEsploraApi } from './esplora-api.interface';

export interface AbstractBitcoinApi {
  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]>;
  $getRawTransaction(txId: string, skipConversion?: boolean, addPrevout?: boolean, lazyPrevouts?: boolean): Promise<IEsploraApi.Transaction>;
  $getBlockHeightTip(): Promise<number>;
  $getBlockHashTip(): Promise<string>;
  $getTxIdsForBlock(hash: string): Promise<string[]>;
  $getBlockHash(height: number): Promise<string>;
  $getBlockHeader(hash: string): Promise<string>;
  $getBlock(hash: string): Promise<IEsploraApi.Block>;
  $getAddress(address: string): Promise<IEsploraApi.Address>;
  $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]>;
  $getAddressPrefix(prefix: string): string[];
  $sendRawTransaction(rawTransaction: string): Promise<string>;
  $getOutspend(txId: string, vout: number): Promise<IEsploraApi.Outspend>;
  $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]>;
  $getBatchedOutspends(txId: string[]): Promise<IEsploraApi.Outspend[][]>;
}
export interface BitcoinRpcCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  timeout: number;
}
