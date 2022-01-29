import { AxiosInstance } from 'axios';
import { Tx, TransactionsInstance } from '../../interfaces/bisq/transactions';

export const useTransactions = (api: AxiosInstance): TransactionsInstance => {
  const getTx = async (params: { txid: string }) => {
    const { data } = await api.get<Tx>(`/tx/${params.txid}`);
    return data;
  };

  const getTxs = async (params: { index: number; length: number }) => {
    const { data } = await api.get<Tx[]>(
      `/txs/${params.index}/${params.length}`
    );
    return data;
  };

  return {
    getTx,
    getTxs,
  };
};
