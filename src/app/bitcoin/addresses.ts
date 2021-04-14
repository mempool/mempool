import { AxiosInstance } from 'axios';
import {
  Address,
  AddressTxsUtxo,
  AddressInstance,
} from '../../interfaces/bitcoin/addresses';
import { Tx } from '../../interfaces/bitcoin/transactions';

export const useAddresses = (api: AxiosInstance): AddressInstance => {
  const getAddress = async (params: { address: string }) => {
    const { data } = await api.get<Address>(`/address/${params.address}`);
    return data;
  };

  const getAddressTxs = async (params: { address: string }) => {
    const { data } = await api.get<Tx[]>(`/address/${params.address}/txs`);
    return data;
  };

  const getAddressTxsChain = async (params: { address: string }) => {
    const { data } = await api.get<Tx[]>(
      `/address/${params.address}/txs/chain`
    );
    return data;
  };

  const getAddressTxsMempool = async (params: { address: string }) => {
    const { data } = await api.get<Tx[]>(
      `/address/${params.address}/txs/mempool`
    );
    return data;
  };

  const getAddressTxsUtxo = async (params: { address: string }) => {
    const { data } = await api.get<AddressTxsUtxo[]>(
      `/address/${params.address}/utxo`
    );
    return data;
  };

  return {
    getAddress,
    getAddressTxs,
    getAddressTxsChain,
    getAddressTxsMempool,
    getAddressTxsUtxo,
  };
};
