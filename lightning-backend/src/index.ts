import config from './config';
import logger from './logger';
import DB from './database';
import lightningApi from './api/lightning-api-factory';
import statsUpdater from './tasks/stats-updater';

logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);

class LightningServer {
  constructor() {
    this.init();
  }

  async init() {
    await DB.checkDbConnection();

    statsUpdater.startService();

    const networkGraph = await lightningApi.getNetworkGraph();
    logger.info('Network graph channels: ' + networkGraph.channels.length);
    logger.info('Network graph nodes: ' + networkGraph.nodes.length);
  }
}

const lightningServer = new LightningServer();
