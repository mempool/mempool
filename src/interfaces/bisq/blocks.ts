import { Tx } from './transactions';

export interface Block {
  height: number;
  time: number;
  hash: string;
  previousBlockHash: string;
  txs: Tx[];
}

export interface BlocksInstance {
  getBlock: (params: { hash: string }) => Promise<Block>;
  getBlocks: (params: { index: number; length: number }) => Promise<Block>;
  getBlocksTipHeight: (params: {
    index: number;
    length: number;
  }) => Promise<number>;
}
