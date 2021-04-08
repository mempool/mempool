import { AxiosInstance } from 'axios';
import { Block, BlockStatus, BlockInstance, Tx } from '../interfaces';

export const useBlocks = (api: AxiosInstance): BlockInstance => {
  const getBlock = async (hash: string) => {
    const { data } = await api.get<Block>(`/block/${hash}`);
    return data;
  };

  const getBlockStatus = async (hash: string) => {
    const { data } = await api.get<BlockStatus>(`/block/${hash}/status`);
    return data;
  };

  const getBlockTxs = async (params: {
    hash: string;
    start_index?: number;
  }) => {
    const { data } = await api.get<Tx>(
      `/block/${params.hash}/txs/${params.start_index}`
    );
    return data;
  };

  const getBlockTxids = async (hash: string) => {
    const { data } = await api.get<string[]>(`/block/${hash}/txids`);
    return data;
  };

  const getBlockTxid = async (params: { hash: string; index: number }) => {
    const { data } = await api.get<string>(
      `/block/${params.hash}/txid/${params.index}`
    );
    return data;
  };

  const getBlockRaw = async (hash: string) => {
    const { data } = await api.get<string>(`/block/${hash}/raw`);
    return data;
  };

  const getBlockHeight = async (height: number) => {
    const { data } = await api.get<string>(`/block-height/${height}`);
    return data;
  };

  const getBlocks = async (params: { start_height?: number }) => {
    const { data } = await api.get<Block>(`/blocks/${params.start_height}`);
    return data;
  };

  const getBlocksTipHeight = async () => {
    const { data } = await api.get<number>(`/blocks/tip/height`);
    return data;
  };

  const getBlocksTipHash = async () => {
    const { data } = await api.get<string>(`/blocks/tip/hash`);
    return data;
  };

  return {
    getBlock,
    getBlocks,
    getBlockStatus,
    getBlockTxs,
    getBlockTxid,
    getBlockTxids,
    getBlockRaw,
    getBlockHeight,
    getBlocksTipHash,
    getBlocksTipHeight,
  };
};
