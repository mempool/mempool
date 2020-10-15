const config = require('../mempool-config.json');
import { Express, Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as express from 'express';
import * as compression from 'compression';
import * as http from 'http';
import * as https from 'https';
import * as WebSocket from 'ws';
import * as cluster from 'cluster';
import * as request from 'request';

import { checkDbConnection } from './database';
import routes from './routes';
import blocks from './api/blocks';
import memPool from './api/mempool';
import diskCache from './api/disk-cache';
import statistics from './api/statistics';
import websocketHandler from './api/websocket-handler';
import fiatConversion from './api/fiat-conversion';
import bisq from './api/bisq/bisq';
import bisqMarkets from './api/bisq/markets';
import donations from './api/donations';
import logger from './logger';
import backendInfo from './api/backend-info';

class Server {
  private wss: WebSocket.Server | undefined;
  private server: https.Server | http.Server | undefined;
  private app: Express;

  constructor() {
    this.app = express();

    if (!config.CLUSTER_NUM_CORES || config.CLUSTER_NUM_CORES === 1) {
      this.startServer();
      return;
    }

    if (cluster.isMaster) {
      logger.notice(`Mempool Server is running on port ${config.HTTP_PORT} (${backendInfo.getShortCommitHash()})`);

      const numCPUs = config.CLUSTER_NUM_CORES;
      for (let i = 0; i < numCPUs; i++) {
        const env = { workerId: i };
        const worker = cluster.fork(env);
        worker.process['env'] = env;
      }

      cluster.on('exit', (worker, code, signal) => {
        const workerId = worker.process['env'].workerId;
        logger.warn(`Mempool Worker PID #${worker.process.pid} workerId: ${workerId} died. Restarting in 10 seconds... ${signal || code}`);
        setTimeout(() => {
          const env = { workerId: workerId };
          const newWorker = cluster.fork(env);
          newWorker.process['env'] = env;
        }, 10000);
      });
    } else {
      this.startServer(true);
    }
  }

  startServer(worker = false) {
    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(compression())
      .use(express.urlencoded({ extended: true }))
      .use(express.json());

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

    if (config.NETWORK === 'bisq') {
      bisq.startBisqService();
      bisq.setPriceCallbackFunction((price) => websocketHandler.setExtraInitProperties('bsq-price', price));
      blocks.setNewBlockCallback(bisq.handleNewBitcoinBlock.bind(bisq));
    }

    if (config.BISQ_MARKET_ENABLED) {
      bisqMarkets.startBisqService();
    }

    this.server.listen(config.HTTP_PORT, () => {
      if (worker) {
        logger.info(`Mempool Server worker #${process.pid} started`);
      } else {
        logger.notice(`Mempool Server is running on port ${config.HTTP_PORT} (${backendInfo.getShortCommitHash()})`);
      }
    });
  }

  async runMempoolIntervalFunctions() {
    await memPool.updateMemPoolInfo();
    await blocks.updateBlocks();
    await memPool.updateMempool();
    setTimeout(this.runMempoolIntervalFunctions.bind(this), config.ELECTRS_POLL_RATE_MS);
  }

  setUpWebsocketHandling() {
    if (this.wss) {
      websocketHandler.setWebsocketServer(this.wss);
    }
    websocketHandler.setupConnectionHandling();
    statistics.setNewStatisticsEntryCallback(websocketHandler.handleNewStatistic.bind(websocketHandler));
    blocks.setNewBlockCallback(websocketHandler.handleNewBlock.bind(websocketHandler));
    memPool.setMempoolChangedCallback(websocketHandler.handleMempoolChange.bind(websocketHandler));
    donations.setNotfyDonationStatusCallback(websocketHandler.handleNewDonation.bind(websocketHandler));
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

    if (config.NETWORK === 'bisq') {
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

    if (config.BISQ_MARKET_ENABLED) {
      this.app
        .get(config.API_ENDPOINT + 'bisq/markets/currencies', routes.getBisqMarketCurrencies.bind(routes))
        .get(config.API_ENDPOINT + 'bisq/markets/depth', routes.getBisqMarketDepth.bind(routes))
        .get(config.API_ENDPOINT + 'bisq/markets/hloc', routes.getBisqMarketHloc.bind(routes))
        .get(config.API_ENDPOINT + 'bisq/markets/markets', routes.getBisqMarketMarkets.bind(routes))
        .get(config.API_ENDPOINT + 'bisq/markets/offers', routes.getBisqMarketOffers.bind(routes))
        .get(config.API_ENDPOINT + 'bisq/markets/ticker', routes.getBisqMarketTicker.bind(routes))
        .get(config.API_ENDPOINT + 'bisq/markets/trades', routes.getBisqMarketTrades.bind(routes))
        .get(config.API_ENDPOINT + 'bisq/markets/volumes', routes.getBisqMarketVolumes.bind(routes))
        ;
    }

    if (config.BTCPAY_URL) {
      this.app
        .get(config.API_ENDPOINT + 'donations', routes.getDonations.bind(routes))
        .post(config.API_ENDPOINT + 'donations', routes.createDonationRequest.bind(routes))
        .post(config.API_ENDPOINT + 'donations-webhook', routes.donationWebhook.bind(routes))
      ;
    } else {
      this.app
        .get(config.API_ENDPOINT + 'donations', (req, res) => {
          req.pipe(request('https://mempool.space/api/v1/donations')).pipe(res);
        });
    }
  }
}

const server = new Server();
