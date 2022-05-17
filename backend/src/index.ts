import { Express, Request, Response, NextFunction } from 'express';
import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import * as cluster from 'cluster';
import axios from 'axios';

import DB from './database';
import config from './config';
import routes from './routes';
import blocks from './api/blocks';
import memPool from './api/mempool';
import diskCache from './api/disk-cache';
import statistics from './api/statistics';
import websocketHandler from './api/websocket-handler';
import fiatConversion from './api/fiat-conversion';
import bisq from './api/bisq/bisq';
import bisqMarkets from './api/bisq/markets';
import logger from './logger';
import backendInfo from './api/backend-info';
import loadingIndicators from './api/loading-indicators';
import mempool from './api/mempool';
import elementsParser from './api/liquid/elements-parser';
import databaseMigration from './api/database-migration';
import syncAssets from './sync-assets';
import icons from './api/liquid/icons';
import { Common } from './api/common';
import mining from './api/mining';
import HashratesRepository from './repositories/HashratesRepository';
import BlocksRepository from './repositories/BlocksRepository';
import poolsUpdater from './tasks/pools-updater';

class Server {
  private wss: WebSocket.Server | undefined;
  private server: http.Server | undefined;
  private app: Express;
  private currentBackendRetryInterval = 5;

  constructor() {
    this.app = express();

    if (!config.MEMPOOL.SPAWN_CLUSTER_PROCS) {
      this.startServer();
      return;
    }

    if (cluster.isMaster) {
      logger.notice(`Mempool Server (Master) is running on port ${config.MEMPOOL.HTTP_PORT} (${backendInfo.getShortCommitHash()})`);

      const numCPUs = config.MEMPOOL.SPAWN_CLUSTER_PROCS;
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

  async startServer(worker = false) {
    logger.debug(`Starting Mempool Server${worker ? ' (worker)' : ''}... (${backendInfo.getShortCommitHash()})`);

    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(express.urlencoded({ extended: true }))
      .use(express.text())
    ;

    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.setUpWebsocketHandling();

    await syncAssets.syncAssets$();
    diskCache.loadMempoolCache();

    if (config.DATABASE.ENABLED) {
      await DB.checkDbConnection();
      try {
        if (process.env.npm_config_reindex !== undefined) { // Re-index requests
          const tables = process.env.npm_config_reindex.split(',');
          logger.warn(`Indexed data for "${process.env.npm_config_reindex}" tables will be erased in 5 seconds (using '--reindex')`);
          await Common.sleep$(5000);
          await databaseMigration.$truncateIndexedData(tables);
        }
        await databaseMigration.$initializeOrMigrateDatabase();
        if (Common.indexingEnabled()) {
          await this.$resetHashratesIndexingState();
        }
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Error');
      }
    }

    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && cluster.isMaster) {
      statistics.startStatistics();
    }

    if (Common.isLiquid()) {
      try {
        icons.loadIcons();
      } catch (e) {
        logger.err('Cannot load liquid icons. Ignoring. Reason: ' + (e instanceof Error ? e.message : e));
      }
    }

    fiatConversion.startService();

    this.setUpHttpApiRoutes();
    this.runMainUpdateLoop();

    if (config.BISQ.ENABLED) {
      bisq.startBisqService();
      bisq.setPriceCallbackFunction((price) => websocketHandler.setExtraInitProperties('bsq-price', price));
      blocks.setNewBlockCallback(bisq.handleNewBitcoinBlock.bind(bisq));
      bisqMarkets.startBisqService();
    }

    this.server.listen(config.MEMPOOL.HTTP_PORT, () => {
      if (worker) {
        logger.info(`Mempool Server worker #${process.pid} started`);
      } else {
        logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);
      }
    });
  }

  async runMainUpdateLoop() {
    try {
      try {
        await memPool.$updateMemPoolInfo();
      } catch (e) {
        const msg = `updateMempoolInfo: ${(e instanceof Error ? e.message : e)}`;
        if (config.MEMPOOL.USE_SECOND_NODE_FOR_MINFEE) {
          logger.warn(msg);
        } else {
          logger.debug(msg);
        }
      }
      await poolsUpdater.updatePoolsJson();
      await blocks.$updateBlocks();
      await memPool.$updateMempool();
      this.$runIndexingWhenReady();

      setTimeout(this.runMainUpdateLoop.bind(this), config.MEMPOOL.POLL_RATE_MS);
      this.currentBackendRetryInterval = 5;
    } catch (e) {
      const loggerMsg = `runMainLoop error: ${(e instanceof Error ? e.message : e)}. Retrying in ${this.currentBackendRetryInterval} sec.`;
      if (this.currentBackendRetryInterval > 5) {
        logger.warn(loggerMsg);
        mempool.setOutOfSync();
      } else {
        logger.debug(loggerMsg);
      }
      logger.debug(JSON.stringify(e));
      setTimeout(this.runMainUpdateLoop.bind(this), 1000 * this.currentBackendRetryInterval);
      this.currentBackendRetryInterval *= 2;
      this.currentBackendRetryInterval = Math.min(this.currentBackendRetryInterval, 60);
    }
  }

  async $resetHashratesIndexingState() {
    try {
      await HashratesRepository.$setLatestRun('last_hashrates_indexing', 0);
      await HashratesRepository.$setLatestRun('last_weekly_hashrates_indexing', 0);
    } catch (e) {
      logger.err(`Cannot reset hashrate indexing timestamps. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  async $runIndexingWhenReady() {
    if (!Common.indexingEnabled() || mempool.hasPriority()) {
      return;
    }

    try {
      await blocks.$generateBlockDatabase();
      await mining.$generateNetworkHashrateHistory();
      await mining.$generatePoolHashrateHistory();
    } catch (e) {
      logger.err(`Indexing failed, trying again later. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  setUpWebsocketHandling() {
    if (this.wss) {
      websocketHandler.setWebsocketServer(this.wss);
    }
    if (Common.isLiquid() && config.DATABASE.ENABLED) {
      blocks.setNewBlockCallback(async () => {
        try {
          await elementsParser.$parse();
        } catch (e) {
          logger.warn('Elements parsing error: ' + (e instanceof Error ? e.message : e));
        }
      });
    }
    websocketHandler.setupConnectionHandling();
    statistics.setNewStatisticsEntryCallback(websocketHandler.handleNewStatistic.bind(websocketHandler));
    blocks.setNewBlockCallback(websocketHandler.handleNewBlock.bind(websocketHandler));
    memPool.setMempoolChangedCallback(websocketHandler.handleMempoolChange.bind(websocketHandler));
    fiatConversion.setProgressChangedCallback(websocketHandler.handleNewConversionRates.bind(websocketHandler));
    loadingIndicators.setProgressChangedCallback(websocketHandler.handleLoadingChanged.bind(websocketHandler));
  }

  setUpHttpApiRoutes() {
    this.app
      .get(config.MEMPOOL.API_URL_PREFIX + 'transaction-times', routes.getTransactionTimes)
      .get(config.MEMPOOL.API_URL_PREFIX + 'cpfp/:txId', routes.getCpfpInfo)
      .get(config.MEMPOOL.API_URL_PREFIX + 'difficulty-adjustment', routes.getDifficultyChange)
      .get(config.MEMPOOL.API_URL_PREFIX + 'fees/recommended', routes.getRecommendedFees)
      .get(config.MEMPOOL.API_URL_PREFIX + 'fees/mempool-blocks', routes.getMempoolBlocks)
      .get(config.MEMPOOL.API_URL_PREFIX + 'backend-info', routes.getBackendInfo)
      .get(config.MEMPOOL.API_URL_PREFIX + 'init-data', routes.getInitData)
      .get(config.MEMPOOL.API_URL_PREFIX + 'validate-address/:address', routes.validateAddress)
      .post(config.MEMPOOL.API_URL_PREFIX + 'tx/push', routes.$postTransactionForm)
      .get(config.MEMPOOL.API_URL_PREFIX + 'donations', async (req, res) => {
        try {
          const response = await axios.get('https://mempool.space/api/v1/donations', { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'donations/images/:id', async (req, res) => {
        try {
          const response = await axios.get('https://mempool.space/api/v1/donations/images/' + req.params.id, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'contributors', async (req, res) => {
        try {
          const response = await axios.get('https://mempool.space/api/v1/contributors', { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'contributors/images/:id', async (req, res) => {
        try {
          const response = await axios.get('https://mempool.space/api/v1/contributors/images/' + req.params.id, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'translators', async (req, res) => {
        try {
          const response = await axios.get('https://mempool.space/api/v1/translators', { responseType: 'stream', timeout: 10000 });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
      .get(config.MEMPOOL.API_URL_PREFIX + 'translators/images/:id', async (req, res) => {
        try {
          const response = await axios.get('https://mempool.space/api/v1/translators/images/' + req.params.id, {
            responseType: 'stream', timeout: 10000
          });
          response.data.pipe(res);
        } catch (e) {
          res.status(500).end();
        }
      })
    ;

    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED) {
      this.app
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/2h', routes.$getStatisticsByTime.bind(routes, '2h'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/24h', routes.$getStatisticsByTime.bind(routes, '24h'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/1w', routes.$getStatisticsByTime.bind(routes, '1w'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/1m', routes.$getStatisticsByTime.bind(routes, '1m'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/3m', routes.$getStatisticsByTime.bind(routes, '3m'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/6m', routes.$getStatisticsByTime.bind(routes, '6m'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/1y', routes.$getStatisticsByTime.bind(routes, '1y'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/2y', routes.$getStatisticsByTime.bind(routes, '2y'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'statistics/3y', routes.$getStatisticsByTime.bind(routes, '3y'))
        ;
    }

    if (Common.indexingEnabled()) {
      this.app
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/24h', routes.$getPools.bind(routes, '24h'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/3d', routes.$getPools.bind(routes, '3d'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/1w', routes.$getPools.bind(routes, '1w'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/1m', routes.$getPools.bind(routes, '1m'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/3m', routes.$getPools.bind(routes, '3m'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/6m', routes.$getPools.bind(routes, '6m'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/1y', routes.$getPools.bind(routes, '1y'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/2y', routes.$getPools.bind(routes, '2y'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/3y', routes.$getPools.bind(routes, '3y'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pools/all', routes.$getPools.bind(routes, 'all'))
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/hashrate', routes.$getPoolHistoricalHashrate)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/blocks', routes.$getPoolBlocks)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/blocks/:height', routes.$getPoolBlocks)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug', routes.$getPool)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/pool/:slug/:interval', routes.$getPool)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate/pools', routes.$getPoolsHistoricalHashrate)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate/pools/:interval', routes.$getPoolsHistoricalHashrate)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate', routes.$getHistoricalHashrate)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/hashrate/:interval', routes.$getHistoricalHashrate)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/reward-stats/:blockCount', routes.$getRewardStats)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/fees/:interval', routes.$getHistoricalBlockFees)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/rewards/:interval', routes.$getHistoricalBlockRewards)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/fee-rates/:interval', routes.$getHistoricalBlockFeeRates)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mining/blocks/sizes-weights/:interval', routes.$getHistoricalBlockSizeAndWeight)
      ;
    }

    if (config.BISQ.ENABLED) {
      this.app
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/stats', routes.getBisqStats)
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/tx/:txId', routes.getBisqTransaction)
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/block/:hash', routes.getBisqBlock)
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/blocks/tip/height', routes.getBisqTip)
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/blocks/:index/:length', routes.getBisqBlocks)
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/address/:address', routes.getBisqAddress)
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/txs/:index/:length', routes.getBisqTransactions)
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/currencies', routes.getBisqMarketCurrencies.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/depth', routes.getBisqMarketDepth.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/hloc', routes.getBisqMarketHloc.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/markets', routes.getBisqMarketMarkets.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/offers', routes.getBisqMarketOffers.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/ticker', routes.getBisqMarketTicker.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/trades', routes.getBisqMarketTrades.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/volumes', routes.getBisqMarketVolumes.bind(routes))
        .get(config.MEMPOOL.API_URL_PREFIX + 'bisq/markets/volumes/7d', routes.getBisqMarketVolumes7d.bind(routes))
        ;
    }

    this.app
      .get(config.MEMPOOL.API_URL_PREFIX + 'blocks-extras', routes.getBlocksExtras)
      .get(config.MEMPOOL.API_URL_PREFIX + 'blocks-extras/:height', routes.getBlocksExtras)
      .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash', routes.getBlock);

    if (config.MEMPOOL.BACKEND !== 'esplora') {
      this.app
        .get(config.MEMPOOL.API_URL_PREFIX + 'mempool', routes.getMempool)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mempool/txids', routes.getMempoolTxIds)
        .get(config.MEMPOOL.API_URL_PREFIX + 'mempool/recent', routes.getRecentMempoolTransactions)
        .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId', routes.getTransaction)
        .post(config.MEMPOOL.API_URL_PREFIX + 'tx', routes.$postTransaction)
        .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId/hex', routes.getRawTransaction)
        .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId/status', routes.getTransactionStatus)
        .get(config.MEMPOOL.API_URL_PREFIX + 'tx/:txId/outspends', routes.getTransactionOutspends)
        .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/header', routes.getBlockHeader)
        .get(config.MEMPOOL.API_URL_PREFIX + 'blocks', routes.getBlocks)
        .get(config.MEMPOOL.API_URL_PREFIX + 'blocks/:height', routes.getBlocks)
        .get(config.MEMPOOL.API_URL_PREFIX + 'blocks/tip/height', routes.getBlockTipHeight)
        .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/txs', routes.getBlockTransactions)
        .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/txs/:index', routes.getBlockTransactions)
        .get(config.MEMPOOL.API_URL_PREFIX + 'block/:hash/txids', routes.getTxIdsForBlock)
        .get(config.MEMPOOL.API_URL_PREFIX + 'block-height/:height', routes.getBlockHeight)
        .get(config.MEMPOOL.API_URL_PREFIX + 'address/:address', routes.getAddress)
        .get(config.MEMPOOL.API_URL_PREFIX + 'address/:address/txs', routes.getAddressTransactions)
        .get(config.MEMPOOL.API_URL_PREFIX + 'address/:address/txs/chain/:txId', routes.getAddressTransactions)
        .get(config.MEMPOOL.API_URL_PREFIX + 'address-prefix/:prefix', routes.getAddressPrefix)
      ;
    }

    if (Common.isLiquid()) {
      this.app
        .get(config.MEMPOOL.API_URL_PREFIX + 'assets/icons', routes.getAllLiquidIcon)
        .get(config.MEMPOOL.API_URL_PREFIX + 'assets/featured', routes.$getAllFeaturedLiquidAssets)
        .get(config.MEMPOOL.API_URL_PREFIX + 'asset/:assetId/icon', routes.getLiquidIcon)
        .get(config.MEMPOOL.API_URL_PREFIX + 'assets/group/:id', routes.$getAssetGroup)
      ;
    }

    if (Common.isLiquid() && config.DATABASE.ENABLED) {
      this.app
        .get(config.MEMPOOL.API_URL_PREFIX + 'liquid/pegs/month', routes.$getElementsPegsByMonth)
      ;
    }
  }
}

const server = new Server();
