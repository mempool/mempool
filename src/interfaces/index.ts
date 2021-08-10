import { AddressInstance } from './bitcoin/addresses';
import { BlockInstance } from './bitcoin/blocks';
import { DifficultyInstance } from './bitcoin/difficulty';
import { FeeInstance } from './bitcoin/fees';
import { MempoolInstance } from './bitcoin/mempool';
import { TxInstance } from './bitcoin/transactions';
import { WsInstance } from './bitcoin/websockets';

import { AddressesInstance } from './bisq/addresses';
import { BlocksInstance } from './bisq/blocks';
import { StatsInstance } from './bisq/statistics';
import { TransactionsInstance } from './bisq/transactions';
import { MarketsInstance } from './bisq/markets';

import { AssetsInstance } from './liquid/assets';
import { BlockLiquidInstance } from './liquid/block';
export interface MempoolConfig {
  hostname?: string;
  network?: string;
}

export interface MempoolReturn {
  bitcoin: {
    addresses: AddressInstance;
    blocks: BlockInstance;
    difficulty: DifficultyInstance;
    fees: FeeInstance;
    mempool: MempoolInstance;
    transactions: TxInstance;
    websocket: WsInstance;
  };
  bisq: {
    addresses: AddressesInstance;
    blocks: BlocksInstance;
    statistics: StatsInstance;
    transactions: TransactionsInstance;
    markets: MarketsInstance;
  };
  liquid: {
    assets: AssetsInstance;
    addresses: AddressInstance;
    blocks: BlockLiquidInstance;
    fees: FeeInstance;
    mempool: MempoolInstance;
    transactions: TxInstance;
    websocket: WsInstance;
  };
}
export interface BisqMarketsReturn {
  addresses: AddressesInstance;
  blocks: BlocksInstance;
  statistics: StatsInstance;
  transactions: TransactionsInstance;
  markets: MarketsInstance;
}
export interface LiquidNetworkReturn {
  assets: AssetsInstance;
  addresses: AddressInstance;
  blocks: BlockLiquidInstance;
  fees: FeeInstance;
  mempool: MempoolInstance;
  transactions: TxInstance;
  websocket: WsInstance;
}