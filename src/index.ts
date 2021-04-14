import { MempoolConfig, MempoolReturn } from './interfaces/index';
import {
  makeBitcoinAPI,
  makeBisqAPI,
  makeLiquidAPI,
} from './services/api/index';

import { useAddresses } from './app/bitcoin/addresses';
import { useBlocks } from './app/bitcoin/blocks';
import { useFees } from './app/bitcoin/fees';
import { useMempool } from './app/bitcoin/mempool';
import { useTransactions } from './app/bitcoin/transactions';
import { useWebsocket } from './app/bitcoin/websocket';

import { useAddresses as useAddressesBisq } from './app/bisq/addresses';
import { useBlocks as useBlocksBisq } from './app/bisq/blocks';
import { useStatistics as useStatisticsBisq } from './app/bisq/statistics';
import { useTransactions as useTransactionsBisq } from './app/bisq/transactions';

import { useAssets as useAssetsLiquid } from './app/liquid/assets';
import { useAddresses as useAddressesLiquid } from './app/liquid/addresses';
import { useBlocks as useBlocksLiquid } from './app/liquid/blocks';
import { useFees as useFeesLiquid } from './app/liquid/fees';
import { useMempool as useMempoolLiquid } from './app/liquid/mempool';
import { useTransactions as useTransactionsLiquid } from './app/liquid/transactions';
import { useWebsocket as useWebsocketLiquid } from './app/liquid/websocket';

const hostnameEndpointDefault = 'mempool.space';
const networkEndpointDefault = 'main';

const mempool = (
  { hostname, network }: MempoolConfig = {
    hostname: hostnameEndpointDefault,
    network: networkEndpointDefault,
  }
): MempoolReturn => {
  if (!hostname) hostname = hostnameEndpointDefault;
  if (!network) network = networkEndpointDefault;

  const { api: apiBitcoin } = makeBitcoinAPI({ hostname, network });
  const { api: apiBisq } = makeBisqAPI(hostname);
  const { api: apiLiquid } = makeLiquidAPI(hostname);

  return {
    bitcoin: {
      addresses: useAddresses(apiBitcoin),
      blocks: useBlocks(apiBitcoin),
      fees: useFees(apiBitcoin),
      mempool: useMempool(apiBitcoin),
      transactions: useTransactions(apiBitcoin),
      websocket: useWebsocket(hostname),
    },
    bisq: {
      statistics: useStatisticsBisq(apiBisq),
      addresses: useAddressesBisq(apiBisq),
      blocks: useBlocksBisq(apiBisq),
      transactions: useTransactionsBisq(apiBisq),
    },
    liquid: {
      addresses: useAddressesLiquid(apiLiquid),
      assets: useAssetsLiquid(apiLiquid),
      blocks: useBlocksLiquid(apiLiquid),
      fees: useFeesLiquid(apiLiquid),
      mempool: useMempoolLiquid(apiLiquid),
      transactions: useTransactionsLiquid(apiLiquid),
      websocket: useWebsocketLiquid(hostname),
    },
  };
};

mempool.default = mempool;
export = mempool;
