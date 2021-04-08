import { AxiosInstance } from 'axios';
import { Mempool, MempoolRecent, MempoolInstance } from '../interfaces';

export const useMempool = (api: AxiosInstance): MempoolInstance => {
  const getMempool = async () => {
    const { data } = await api.get<Mempool[]>(`/mempool`);
    return data;
  };

  const getMempoolTxids = async () => {
    const { data } = await api.get<string[]>(`/mempool/txids`);
    return data;
  };

  const getMempoolRecent = async () => {
    const { data } = await api.get<MempoolRecent[]>(`/mempool/recent`);
    return data;
  };

  return {
    getMempool,
    getMempoolTxids,
    getMempoolRecent,
  };
};
