import { MempoolConfig, LiquidNetworkReturn } from './interfaces/index';
import {
  makeLiquidAPI,
} from './services/api/index';

import { useAssets as useAssetsLiquid } from './app/liquid/assets';
import { useAddresses as useAddressesLiquid } from './app/liquid/addresses';
import { useBlocks as useBlocksLiquid } from './app/liquid/blocks';
import { useFees as useFeesLiquid } from './app/liquid/fees';
import { useMempool as useMempoolLiquid } from './app/liquid/mempool';
import { useTransactions as useTransactionsLiquid } from './app/liquid/transactions';
import { useWebsocket as useWebsocketLiquid } from './app/liquid/websocket';

const hostnameEndpointDefault = 'liquid.network';
const networkEndpointDefault = 'liquid';

const mempool = (
  { 
    hostname, network }: MempoolConfig = {
    hostname: hostnameEndpointDefault,
    network: networkEndpointDefault,
  }
): LiquidNetworkReturn => {
  if (!hostname) hostname = hostnameEndpointDefault;
  if (!network) network = networkEndpointDefault;

  const { api: apiLiquid } = makeLiquidAPI(hostname);

  return {
    addresses: useAddressesLiquid(apiLiquid),
    assets: useAssetsLiquid(apiLiquid),
    blocks: useBlocksLiquid(apiLiquid),
    fees: useFeesLiquid(apiLiquid),
    mempool: useMempoolLiquid(apiLiquid),
    transactions: useTransactionsLiquid(apiLiquid),
    websocket: useWebsocketLiquid(hostname),
  };
};

mempool.default = mempool;
export = mempool;
