import { MempoolConfig, MempoolReturn } from './interfaces';
import { makeAPI } from './services/api';

import { useAddresses } from './app/addresses';
import { useBlocks } from './app/blocks';
import { useFees } from './app/fees';
import { useMempool } from './app/mempool';
import { useTransactions } from './app/transactions';
import { useWebsocket } from './app/websocket';

const apiEndpointDefault = 'https://mempool.space/api/';
const websocketEndpointDefault = 'wss://mempool.space/api/v1/ws';

const mempool = (
  { apiEndpoint, websocketEndpoint }: MempoolConfig = {
    apiEndpoint: apiEndpointDefault,
    websocketEndpoint: websocketEndpointDefault,
  }
): MempoolReturn => {
  const { api } = makeAPI(apiEndpoint);

  return {
    addresses: useAddresses(api),
    blocks: useBlocks(api),
    fees: useFees(api),
    mempool: useMempool(api),
    transactions: useTransactions(api),
    websocket: useWebsocket(websocketEndpoint),
  };
};

mempool.default = mempool;
export = mempool;
