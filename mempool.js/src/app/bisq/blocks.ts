import { AxiosInstance } from 'axios';
import { Block, BlocksInstance } from '../../interfaces/bisq/blocks';

export const useBlocks = (api: AxiosInstance): BlocksInstance => {
  const getBlock = async (params: { hash: string }) => {
    const { data } = await api.get<Block>(`/block/${params.hash}`);
    return data;
  };

  const getBlocks = async (params: { index: number; length: number }) => {
    const { data } = await api.get<Block>(
      `/blocks/${params.index}/${params.length}`
    );
    return data;
  };

  const getBlocksTipHeight = async () => {
    const { data } = await api.get<number>(`/blocks/tip/height`);
    return data;
  };

  return {
    getBlock,
    getBlocks,
    getBlocksTipHeight,
  };
};
