import express from 'express';
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import cluster from 'cluster';
import DB from './database';
import config from './config';
import blocks from './api/blocks';
import memPool from './api/mempool';
import diskCache from './api/disk-cache';
import statistics from './api/statistics/statistics';
import websocketHandler from './api/websocket-handler';
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
import poolsUpdater from './tasks/pools-updater';
import indexer from './indexer';
import nodesRoutes from './api/explorer/nodes.routes';
import channelsRoutes from './api/explorer/channels.routes';
import generalLightningRoutes from './api/explorer/general.routes';
import lightningStatsUpdater from './tasks/lightning/stats-updater.service';
import networkSyncService from './tasks/lightning/network-sync.service';
import statisticsRoutes from './api/statistics/statistics.routes';
import miningRoutes from './api/mining/mining-routes';
import bisqRoutes from './api/bisq/bisq.routes';
import liquidRoutes from './api/liquid/liquid.routes';
import bitcoinRoutes from './api/bitcoin/bitcoin.routes';
import fundingTxFetcher from './tasks/lightning/sync-tasks/funding-tx-fetcher';
import forensicsService from './tasks/lightning/forensics.service';
import priceUpdater from './tasks/price-updater';
import chainTips from './api/chain-tips';
import { AxiosError } from 'axios';
import v8 from 'v8';
import { formatBytes, getBytesUnit } from './utils/format';

class Server {
  private wss: WebSocket.Server | undefined;
  private server: http.Server | undefined;
  private app: Application;
  private currentBackendRetryInterval = 5;

  private maxHeapSize: number = 0;
  private heapLogInterval: number = 60;
  private warnedHeapCritical: boolean = false;
  private lastHeapLogTime: number | null = null;

  constructor() {
    this.app = express();

    if (!config.MEMPOOL.SPAWN_CLUSTER_PROCS) {
      this.startServer();
      return;
    }

    if (cluster.isPrimary) {
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

  async startServer(worker = false): Promise<void> {
    logger.notice(`Starting Mempool Server${worker ? ' (worker)' : ''}... (${backendInfo.getShortCommitHash()})`);

    if (config.DATABASE.ENABLED) {
      await DB.checkDbConnection();
      try {
        if (process.env.npm_config_reindex_blocks === 'true') { // Re-index requests
          await databaseMigration.$blocksReindexingTruncate();
        }
        await databaseMigration.$initializeOrMigrateDatabase();
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Error');
      }
    }

    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(express.urlencoded({ extended: true }))
      .use(express.text({ type: ['text/plain', 'application/base64'] }))
      ;

    if (config.DATABASE.ENABLED) {
      await priceUpdater.$initializeLatestPriceWithDb();
    }

    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });

    this.setUpWebsocketHandling();

    await poolsUpdater.updatePoolsJson(); // Needs to be done before loading the disk cache because we sometimes wipe it
    await syncAssets.syncAssets$();
    if (config.MEMPOOL.ENABLED) {
      diskCache.loadMempoolCache();
    }

    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && cluster.isPrimary) {
      statistics.startStatistics();
    }

    if (Common.isLiquid()) {
      try {
        icons.loadIcons();
      } catch (e) {
        logger.err('Cannot load liquid icons. Ignoring. Reason: ' + (e instanceof Error ? e.message : e));
      }
    }

    priceUpdater.$run();
    await chainTips.updateOrphanedBlocks();

    this.setUpHttpApiRoutes();

    if (config.MEMPOOL.ENABLED) {
      this.runMainUpdateLoop();
    }

    setInterval(() => { this.healthCheck(); }, 2500);

    if (config.BISQ.ENABLED) {
      bisq.startBisqService();
      bisq.setPriceCallbackFunction((price) => websocketHandler.setExtraInitProperties('bsq-price', price));
      blocks.setNewBlockCallback(bisq.handleNewBitcoinBlock.bind(bisq));
      bisqMarkets.startBisqService();
    }

    if (config.LIGHTNING.ENABLED) {
      this.$runLightningBackend();
    }

    this.server.listen(config.MEMPOOL.HTTP_PORT, () => {
      if (worker) {
        logger.info(`Mempool Server worker #${process.pid} started`);
      } else {
        logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);
      }
    });
  }

  async runMainUpdateLoop(): Promise<void> {
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
      memPool.deleteExpiredTransactions();
      await blocks.$updateBlocks();
      await memPool.$updateMempool();
      indexer.$run();

      setTimeout(this.runMainUpdateLoop.bind(this), config.MEMPOOL.POLL_RATE_MS);
      this.currentBackendRetryInterval = 5;
    } catch (e: any) {
      let loggerMsg = `Exception in runMainUpdateLoop(). Retrying in ${this.currentBackendRetryInterval} sec.`;
      loggerMsg += ` Reason: ${(e instanceof Error ? e.message : e)}.`;
      if (e?.stack) {
        loggerMsg += ` Stack trace: ${e.stack}`;
      }
      // When we get a first Exception, only `logger.debug` it and retry after 5 seconds
      // From the second Exception, `logger.warn` the Exception and increase the retry delay
      // Maximum retry delay is 60 seconds
      if (this.currentBackendRetryInterval > 5) {
        logger.warn(loggerMsg);
        mempool.setOutOfSync();
      } else {
        logger.debug(loggerMsg);
      }
      if (e instanceof AxiosError) {
        logger.debug(`AxiosError: ${e?.message}`);
      }
      setTimeout(this.runMainUpdateLoop.bind(this), 1000 * this.currentBackendRetryInterval);
      this.currentBackendRetryInterval *= 2;
      this.currentBackendRetryInterval = Math.min(this.currentBackendRetryInterval, 60);
    }
  }

  async $runLightningBackend(): Promise<void> {
    try {
      await fundingTxFetcher.$init();
      await networkSyncService.$startService();
      await lightningStatsUpdater.$startService();
      await forensicsService.$startService();
    } catch(e) {
      logger.err(`Exception in $runLightningBackend. Restarting in 1 minute. Reason: ${(e instanceof Error ? e.message : e)}`);
      await Common.sleep$(1000 * 60);
      this.$runLightningBackend();
    };
  }

  setUpWebsocketHandling(): void {
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
    if (config.MEMPOOL.ENABLED) {
      statistics.setNewStatisticsEntryCallback(websocketHandler.handleNewStatistic.bind(websocketHandler));
      memPool.setAsyncMempoolChangedCallback(websocketHandler.handleMempoolChange.bind(websocketHandler));
      blocks.setNewAsyncBlockCallback(websocketHandler.handleNewBlock.bind(websocketHandler));
    }
    priceUpdater.setRatesChangedCallback(websocketHandler.handleNewConversionRates.bind(websocketHandler));
    loadingIndicators.setProgressChangedCallback(websocketHandler.handleLoadingChanged.bind(websocketHandler));
  }
  
  setUpHttpApiRoutes(): void {
    bitcoinRoutes.initRoutes(this.app);
    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && config.MEMPOOL.ENABLED) {
      statisticsRoutes.initRoutes(this.app);
    }
    if (Common.indexingEnabled() && config.MEMPOOL.ENABLED) {
      miningRoutes.initRoutes(this.app);
    }
    if (config.BISQ.ENABLED) {
      bisqRoutes.initRoutes(this.app);
    }
    if (Common.isLiquid()) {
      liquidRoutes.initRoutes(this.app);
    }
    if (config.LIGHTNING.ENABLED) {
      generalLightningRoutes.initRoutes(this.app);
      nodesRoutes.initRoutes(this.app);
      channelsRoutes.initRoutes(this.app);
    }
  }

  healthCheck(): void {
    const now = Date.now();
    const stats = v8.getHeapStatistics();
    this.maxHeapSize = Math.max(stats.used_heap_size, this.maxHeapSize);
    const warnThreshold = 0.8 * stats.heap_size_limit;

    const byteUnits = getBytesUnit(Math.max(this.maxHeapSize, stats.heap_size_limit));

    if (!this.warnedHeapCritical && this.maxHeapSize > warnThreshold) {
      this.warnedHeapCritical = true;
      logger.warn(`Used ${(this.maxHeapSize / stats.heap_size_limit).toFixed(2)}% of heap limit (${formatBytes(this.maxHeapSize, byteUnits, true)} / ${formatBytes(stats.heap_size_limit, byteUnits)})!`);
    }
    if (this.lastHeapLogTime === null || (now - this.lastHeapLogTime) > (this.heapLogInterval * 1000)) {
      logger.debug(`Memory usage: ${formatBytes(this.maxHeapSize, byteUnits)} / ${formatBytes(stats.heap_size_limit, byteUnits)}`);
      this.warnedHeapCritical = false;
      this.maxHeapSize = 0;
      this.lastHeapLogTime = now;
    }
  }
}

((): Server => new Server())();
