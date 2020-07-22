const config = require('../mempool-config.json');
import { Express, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as express from 'express';
import * as compression from 'compression';
import * as http from 'http';
import * as https from 'https';
import * as WebSocket from 'ws';

import { checkDbConnection } from './database';
import routes from './routes';
import blocks from './api/blocks';
import memPool from './api/mempool';
import diskCache from './api/disk-cache';
import statistics from './api/statistics';
import websocketHandler from './api/websocket-handler';
import fiatConversion from './api/fiat-conversion';
import bisq from './api/bisq';

class Server {
  wss: WebSocket.Server;
  server: https.Server | http.Server;
  app: Express;

  constructor() {
    this.app = express();

    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(compression());

    if (config.SSL === true) {
      const credentials = {
        cert: fs.readFileSync(config.SSL_CERT_FILE_PATH),
        key: fs.readFileSync(config.SSL_KEY_FILE_PATH),
      };
      this.server = https.createServer(credentials, this.app);
      this.wss = new WebSocket.Server({ server: this.server });
    } else {
      this.server = http.createServer(this.app);
      this.wss = new WebSocket.Server({ server: this.server });
    }

    if (!config.DB_DISABLED) {
      checkDbConnection();
      statistics.startStatistics();
    }

    this.setUpHttpApiRoutes();
    this.setUpWebsocketHandling();
    this.runMempoolIntervalFunctions();

    fiatConversion.startService();
    diskCache.loadMempoolCache();

    if (config.BISQ_ENABLED) {
      bisq.startBisqService();
      bisq.setPriceCallbackFunction((price) => websocketHandler.setExtraInitProperties('bsq-price', price));
    }

    this.server.listen(config.HTTP_PORT, () => {
      console.log(`Server started on port ${config.HTTP_PORT}`);
    });
  }

  async runMempoolIntervalFunctions() {
    await memPool.updateMemPoolInfo();
    await blocks.updateBlocks();
    await memPool.updateMempool();
    setTimeout(this.runMempoolIntervalFunctions.bind(this), config.ELECTRS_POLL_RATE_MS);
  }

  setUpWebsocketHandling() {
    websocketHandler.setWebsocketServer(this.wss);
    websocketHandler.setupConnectionHandling();
    statistics.setNewStatisticsEntryCallback(websocketHandler.handleNewStatistic.bind(websocketHandler));
    blocks.setNewBlockCallback(websocketHandler.handleNewBlock.bind(websocketHandler));
    memPool.setMempoolChangedCallback(websocketHandler.handleMempoolChange.bind(websocketHandler));
  }

  setUpHttpApiRoutes() {
    this.app
      .get(config.API_ENDPOINT + 'transaction-times', routes.getTransactionTimes)
      .get(config.API_ENDPOINT + 'fees/recommended', routes.getRecommendedFees)
      .get(config.API_ENDPOINT + 'fees/mempool-blocks', routes.getMempoolBlocks)
      .get(config.API_ENDPOINT + 'statistics/2h', routes.get2HStatistics)
      .get(config.API_ENDPOINT + 'statistics/24h', routes.get24HStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1w', routes.get1WHStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1m', routes.get1MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/3m', routes.get3MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/6m', routes.get6MStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'statistics/1y', routes.get1YStatistics.bind(routes))
      .get(config.API_ENDPOINT + 'backend-info', routes.getBackendInfo)
    ;

    if (config.BISQ_ENABLED) {
      this.app
        .get(config.API_ENDPOINT + 'bisq/stats', routes.getBisqStats)
        .get(config.API_ENDPOINT + 'bisq/tx/:txId', routes.getBisqTransaction)
        .get(config.API_ENDPOINT + 'bisq/block/:hash', routes.getBisqBlock)
        .get(config.API_ENDPOINT + 'bisq/blocks/tip/height', routes.getBisqTip)
        .get(config.API_ENDPOINT + 'bisq/blocks/:index/:length', routes.getBisqBlocks)
        .get(config.API_ENDPOINT + 'bisq/address/:address', routes.getBisqAddress)
        .get(config.API_ENDPOINT + 'bisq/txs/:index/:length', routes.getBisqTransactions)
      ;
    }
  }
}

const server = new Server();
