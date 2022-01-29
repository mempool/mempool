import { Tx } from './transactions';

export interface Address {
  height: number;
  time: number;
  hash: string;
  previousBlockHash: string;
  txs: Tx[];
}

export interface AddressesInstance {
  getAddress: (params: { address: string }) => Promise<Address>;
}
