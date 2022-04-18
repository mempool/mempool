import config from './config';
import logger from './logger';
import DB from './database';
import lightningApi from './api/lightning-api-factory';

logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);

class LightningServer {
  constructor() {
    this.init();
  }

  async init() {
    await DB.checkDbConnection();

    const networkInfo = await lightningApi.getNetworkInfo();
    logger.info(JSON.stringify(networkInfo));

    const networkGraph = await lightningApi.getNetworkGraph();
    logger.info('Network graph channels: ' + networkGraph.channels.length);
    logger.info('Network graph nodes: ' + networkGraph.nodes.length);
  }
}

const lightningServer = new LightningServer();
