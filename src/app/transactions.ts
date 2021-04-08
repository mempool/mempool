import { AxiosInstance } from 'axios';
import {
  Tx,
  TxStatus,
  TxMerkleProof,
  TxOutspend,
  TxInstance,
} from '../interfaces';

export const useTransactions = (api: AxiosInstance): TxInstance => {
  const getTx = async (txid: string) => {
    const { data } = await api.get<Tx>(`/tx/${txid}`);
    return data;
  };

  const getTxStatus = async (txid: string) => {
    const { data } = await api.get<TxStatus>(`/tx/${txid}/status`);
    return data;
  };

  const getTxHex = async (txid: string) => {
    const { data } = await api.get<string>(`/tx/${txid}/hex`);
    return data;
  };

  const getTxRaw = async (txid: string) => {
    const { data } = await api.get<string>(`/tx/${txid}/raw`);
    return data;
  };

  const getTxMerkleBlockProof = async (txid: string) => {
    const { data } = await api.get<string>(`/tx/${txid}/merkleblock-proof`);
    return data;
  };

  const getTxMerkleProof = async (txid: string) => {
    const { data } = await api.get<Array<TxMerkleProof>>(
      `/tx/${txid}/merkle-proof`
    );
    return data;
  };

  const getTxOutspend = async (params: { txid: string; vout: number }) => {
    const { data } = await api.get<TxOutspend>(
      `/tx/${params.txid}/outspend/${params.vout}`
    );
    return data;
  };

  const getTxOutspends = async (txid: string) => {
    const { data } = await api.get<Array<TxOutspend>>(`/tx/${txid}/outspends`);
    return data;
  };

  const postTx = async (txid: string) => {
    const { data } = await api.post<string>(`/tx`, { txid: txid });
    return data;
  };

  return {
    getTx,
    getTxStatus,
    getTxHex,
    getTxRaw,
    getTxMerkleBlockProof,
    getTxMerkleProof,
    getTxOutspend,
    getTxOutspends,
    postTx,
  };
};
