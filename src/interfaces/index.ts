import { AddressInstance } from './bitcoin/addresses';
import { BlockInstance } from './bitcoin/blocks';
import { FeeInstance } from './bitcoin/fees';
import { MempoolInstance } from './bitcoin/mempool';
import { TxInstance } from './bitcoin/transactions';
import { WsInstance } from './bitcoin/websockets';

import { AddressesInstance } from './bisq/addresses';
import { BlocksInstance } from './bisq/blocks';
import { StatsInstance } from './bisq/statistics';
import { TransactionsInstance } from './bisq/transactions';

import { AssetsInstance } from './liquid/assets';

export interface MempoolConfig {
  hostname?: string;
  network?: string;
}

export interface MempoolReturn {
  bitcoin: {
    addresses: AddressInstance;
    blocks: BlockInstance;
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
  };
  liquid: {
    assets: AssetsInstance;
    addresses: AddressInstance;
    blocks: BlockInstance;
    fees: FeeInstance;
    mempool: MempoolInstance;
    transactions: TxInstance;
    websocket: WsInstance;
  };
}
