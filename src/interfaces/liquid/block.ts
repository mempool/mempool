import { Tx } from '../bitcoin/transactions';

export interface Block {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

export interface BlockStatus {
  in_best_chain: boolean;
  height: number;
  next_best: string;
}

export interface BlockLiquidInstance {
  getBlock: (params: { hash: string }) => Promise<Block>;
  getBlocks: (params: { start_height?: number }) => Promise<Block>;
  getBlockStatus: (params: { hash: string }) => Promise<BlockStatus>;
  getBlockTxs: (params: { hash: string; start_index?: number }) => Promise<Tx>;
  getBlockTxids: (params: { hash: string }) => Promise<string[]>;
  getBlockTxid: (params: { hash: string; index: number }) => Promise<string>;
  getBlockRaw: (params: { hash: string }) => Promise<string>;
  getBlockHeight: (params: { height: number }) => Promise<string>;
  getBlocksTipHeight: () => Promise<number>;
  getBlocksTipHash: () => Promise<string>;
}
