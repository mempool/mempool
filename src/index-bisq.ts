import { MempoolConfig, BisqMarketsReturn } from './interfaces/index';
import { makeBisqAPI, makeBisqMarketsAPI } from './services/api/index';

import { useAddresses as useAddressesBisq } from './app/bisq/addresses';
import { useBlocks as useBlocksBisq } from './app/bisq/blocks';
import { useStatistics as useStatisticsBisq } from './app/bisq/statistics';
import { useTransactions as useTransactionsBisq } from './app/bisq/transactions';
import { useMarkets as useMarkets } from './app/bisq/markets';

const hostnameEndpointDefault = 'mempool.space';
const networkEndpointDefault = 'bisq';

const mempool = ({ hostname, network }: MempoolConfig = {
    hostname: hostnameEndpointDefault,
    network: networkEndpointDefault,
  }): BisqMarketsReturn => {
  if (!hostname) hostname = hostnameEndpointDefault;
  if (!network) network = networkEndpointDefault;

  const { api: apiBisq } = makeBisqAPI(hostname);
  const { api: apiBisqMarkets } = makeBisqMarketsAPI();

  return {
    statistics: useStatisticsBisq(apiBisq),
    addresses: useAddressesBisq(apiBisq),
    blocks: useBlocksBisq(apiBisq),
    transactions: useTransactionsBisq(apiBisq),
    markets: useMarkets(apiBisqMarkets),
  };
};

mempool.default = mempool;
export = mempool;
