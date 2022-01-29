import { Tx, TxStatus } from './transactions';

export interface Address {
  address: string;
  chain_stats: StatsInfo;
  mempool_stats: StatsInfo;
}

export interface StatsInfo {
  funded_txo_count: number;
  funded_txo_sum: number;
  spent_txo_count: number;
  spent_txo_sum: number;
  tx_count: number;
}

export interface AddressTxsUtxo {
  txid: string;
  vout: number;
  status: TxStatus;
  value: number;
}

export interface AddressInstance {
  getAddress: (params: { address: string }) => Promise<Address>;
  getAddressTxs: (params: { address: string }) => Promise<Tx[]>;
  getAddressTxsChain: (params: { address: string }) => Promise<Tx[]>;
  getAddressTxsMempool: (params: { address: string }) => Promise<Tx[]>;
  getAddressTxsUtxo: (params: { address: string }) => Promise<AddressTxsUtxo[]>;
}
