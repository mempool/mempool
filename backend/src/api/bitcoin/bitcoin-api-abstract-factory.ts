import { IBitcoinApi, SubmitPackageResult, TestMempoolAcceptResult } from './bitcoin-api.interface';
import { IEsploraApi } from './esplora-api.interface';

export interface AbstractBitcoinApi {
  $getRawMempool(): Promise<IEsploraApi.Transaction['txid'][]>;
  $getRawTransaction(txId: string, skipConversion?: boolean, addPrevout?: boolean, lazyPrevouts?: boolean): Promise<IEsploraApi.Transaction>;
  $getRawTransactions(txids: string[]): Promise<IEsploraApi.Transaction[]>;
  $getMempoolTransactions(txids: string[]): Promise<IEsploraApi.Transaction[]>;
  $getAllMempoolTransactions(lastTxid?: string, max_txs?: number);
  $getTransactionHex(txId: string): Promise<string>;
  $getBlockHeightTip(): Promise<number>;
  $getBlockHashTip(): Promise<string>;
  $getTxIdsForBlock(hash: string): Promise<string[]>;
  $getTxsForBlock(hash: string): Promise<IEsploraApi.Transaction[]>;
  $getBlockHash(height: number): Promise<string>;
  $getBlockHeader(hash: string): Promise<string>;
  $getBlock(hash: string): Promise<IEsploraApi.Block>;
  $getRawBlock(hash: string): Promise<Buffer>;
  $getAddress(address: string): Promise<IEsploraApi.Address>;
  $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]>;
  $getAddressPrefix(prefix: string): string[];
  $getScriptHash(scripthash: string): Promise<IEsploraApi.ScriptHash>;
  $getScriptHashTransactions(address: string, lastSeenTxId: string): Promise<IEsploraApi.Transaction[]>;
  $sendRawTransaction(rawTransaction: string): Promise<string>;
  $testMempoolAccept(rawTransactions: string[], maxfeerate?: number): Promise<TestMempoolAcceptResult[]>;
  $submitPackage(rawTransactions: string[], maxfeerate?: number, maxburnamount?: number): Promise<SubmitPackageResult>;
  $getOutspend(txId: string, vout: number): Promise<IEsploraApi.Outspend>;
  $getOutspends(txId: string): Promise<IEsploraApi.Outspend[]>;
  $getBatchedOutspends(txId: string[]): Promise<IEsploraApi.Outspend[][]>;
  $getBatchedOutspendsInternal(txId: string[]): Promise<IEsploraApi.Outspend[][]>;
  $getOutSpendsByOutpoint(outpoints: { txid: string, vout: number }[]): Promise<IEsploraApi.Outspend[]>;
  $getCoinbaseTx(blockhash: string): Promise<IEsploraApi.Transaction>;
  $getAddressTransactionSummary(address: string): Promise<IEsploraApi.AddressTxSummary[]>;

  startHealthChecks(): void;
  getHealthStatus(): HealthCheckHost[];
}
export interface BitcoinRpcCredentials {
  host: string;
  port: number;
  user: string;
  pass: string;
  timeout: number;
  cookie?: string;
}

export interface HealthCheckHost {
  host: string;
  active: boolean;
  rtt: number;
  latestHeight: number;
  socket: boolean;
  outOfSync: boolean;
  unreachable: boolean;
  checked: boolean;
  lastChecked: number;
}
