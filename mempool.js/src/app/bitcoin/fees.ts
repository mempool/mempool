import { AxiosInstance } from 'axios';
import {
  FeesRecommended,
  FeesMempoolBlocks,
  FeeInstance,
} from '../../interfaces/bitcoin/fees';

export const useFees = (api: AxiosInstance): FeeInstance => {
  const getFeesRecommended = async () => {
    const { data } = await api.get<FeesRecommended>(`/v1/fees/recommended`);
    return data;
  };

  const getFeesMempoolBlocks = async () => {
    const { data } = await api.get<FeesMempoolBlocks[]>(
      `/v1/fees/mempool-blocks`
    );
    return data;
  };

  const getCPFP = async (params: { txid: string }) => {
    const { data } = await api.get<FeesMempoolBlocks[]>(
      `/v1/cpfp/${params.txid}`
    );
    return data;
  };

  return {
    getFeesRecommended,
    getFeesMempoolBlocks,
    getCPFP,
  };
};
