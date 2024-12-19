import express from 'express';
import { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import bitcoinApi from './api/bitcoin/bitcoin-api-factory';
import cluster from 'cluster';
import DB from './database';
import config from './config';
import blocks from './api/blocks';
import memPool from './api/mempool';
import diskCache from './api/disk-cache';
import statistics from './api/statistics/statistics';
import websocketHandler from './api/websocket-handler';
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
import pricesRoutes from './api/prices/prices.routes';
import miningRoutes from './api/mining/mining-routes';
import liquidRoutes from './api/liquid/liquid.routes';
import bitcoinRoutes from './api/bitcoin/bitcoin.routes';
import servicesRoutes from './api/services/services-routes';
import fundingTxFetcher from './tasks/lightning/sync-tasks/funding-tx-fetcher';
import forensicsService from './tasks/lightning/forensics.service';
import priceUpdater from './tasks/price-updater';
import chainTips from './api/chain-tips';
import { AxiosError } from 'axios';
import v8 from 'v8';
import { formatBytes, getBytesUnit } from './utils/format';
import redisCache from './api/redis-cache';
import accelerationApi from './api/services/acceleration';
import bitcoinCoreRoutes from './api/bitcoin/bitcoin-core.routes';
import bitcoinSecondClient from './api/bitcoin/bitcoin-second-client';
import accelerationRoutes from './api/acceleration/acceleration.routes';
import aboutRoutes from './api/about.routes';
import mempoolBlocks from './api/mempool-blocks';
import walletApi from './api/services/wallets';

class Server {
  private wss: WebSocket.Server | undefined;
  private wssUnixSocket: WebSocket.Server | undefined;
  private server: http.Server | undefined;
  private serverUnixSocket: http.Server | undefined;
  private app: Application;
  private currentBackendRetryInterval = 1;
  private backendRetryCount = 0;

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

    // Register cleanup listeners for exit events
    ['exit', 'SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'].forEach(event => {
      process.on(event, () => { this.onExit(event); });
    });
    process.on('uncaughtException', (error) => {
      this.onUnhandledException('uncaughtException', error);
    });
    process.on('unhandledRejection', (reason, promise) => {
      this.onUnhandledException('unhandledRejection', reason);
    });

    if (config.MEMPOOL.BACKEND === 'esplora') {
      bitcoinApi.startHealthChecks();
    }

    if (config.DATABASE.ENABLED) {
      DB.getPidLock();

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
      .use(express.json())
      ;

    if (config.DATABASE.ENABLED && config.FIAT_PRICE.ENABLED) {
      await priceUpdater.$initializeLatestPriceWithDb();
    }

    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    if (config.MEMPOOL.UNIX_SOCKET_PATH) {
      this.serverUnixSocket = http.createServer(this.app);
      this.wssUnixSocket = new WebSocket.Server({ server: this.serverUnixSocket });
    }

    this.setUpWebsocketHandling();

    await poolsUpdater.updatePoolsJson(); // Needs to be done before loading the disk cache because we sometimes wipe it
    await syncAssets.syncAssets$();
    await mempoolBlocks.updatePools$();
    if (config.MEMPOOL.ENABLED) {
      if (config.MEMPOOL.CACHE_ENABLED) {
        await diskCache.$loadMempoolCache();
      } else if (config.REDIS.ENABLED) {
        await redisCache.$loadCache();
      }
    }

    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && cluster.isPrimary) {
      statistics.startStatistics();
    }

    if (Common.isLiquid()) {
      const refreshIcons = () => {
        try {
          icons.loadIcons();
        } catch (e) {
          logger.err('Cannot load liquid icons. Ignoring. Reason: ' + (e instanceof Error ? e.message : e));
        }
      };
      // Run once on startup.
      refreshIcons();
      // Matches crontab refresh interval for asset db.
      setInterval(refreshIcons, 3600_000);
    }

    if (config.FIAT_PRICE.ENABLED) {
      priceUpdater.$run();
    }
    await chainTips.updateOrphanedBlocks();

    this.setUpHttpApiRoutes();

    if (config.MEMPOOL.ENABLED) {
      this.runMainUpdateLoop();
    }

    setInterval(() => { this.healthCheck(); }, 2500);

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

    if (this.serverUnixSocket) {
      this.serverUnixSocket.listen(config.MEMPOOL.UNIX_SOCKET_PATH, () => {
        if (worker) {
          logger.info(`Mempool Server worker #${process.pid} started`);
        } else {
          logger.notice(`Mempool Server is listening on ${config.MEMPOOL.UNIX_SOCKET_PATH}`);
        }
      });
    }

    poolsUpdater.$startService();
  }

  async runMainUpdateLoop(): Promise<void> {
    const start = Date.now();
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
      const newMempool = await bitcoinApi.$getRawMempool();
      const minFeeMempool = memPool.limitGBT ? await bitcoinSecondClient.getRawMemPool() : null;
      const minFeeTip = memPool.limitGBT ? await bitcoinSecondClient.getBlockCount() : -1;
      const latestAccelerations = await accelerationApi.$updateAccelerations();
      const numHandledBlocks = await blocks.$updateBlocks();
      const pollRate = config.MEMPOOL.POLL_RATE_MS * (indexer.indexerIsRunning() ? 10 : 1);
      if (numHandledBlocks === 0) {
        await memPool.$updateMempool(newMempool, latestAccelerations, minFeeMempool, minFeeTip, pollRate);
      }
      indexer.$run();
      if (config.WALLETS.ENABLED) {
        // might take a while, so run in the background
        walletApi.$syncWallets();
      }
      if (config.FIAT_PRICE.ENABLED) {
        priceUpdater.$run();
      }

      // rerun immediately if we skipped the mempool update, otherwise wait POLL_RATE_MS
      const elapsed = Date.now() - start;
      const remainingTime = Math.max(0, pollRate - elapsed);
      setTimeout(this.runMainUpdateLoop.bind(this), numHandledBlocks > 0 ? 0 : remainingTime);
      this.backendRetryCount = 0;
    } catch (e: any) {
      this.backendRetryCount++;
      let loggerMsg = `Exception in runMainUpdateLoop() (count: ${this.backendRetryCount}). Retrying in ${this.currentBackendRetryInterval} sec.`;
      loggerMsg += ` Reason: ${(e instanceof Error ? e.message : e)}.`;
      if (e?.stack) {
        loggerMsg += ` Stack trace: ${e.stack}`;
      }
      // When we get a first Exception, only `logger.debug` it and retry after 5 seconds
      // From the second Exception, `logger.warn` the Exception and increase the retry delay
      if (this.backendRetryCount >= 5) {
        logger.warn(loggerMsg);
        mempool.setOutOfSync();
      } else {
        logger.debug(loggerMsg);
      }
      if (e instanceof AxiosError) {
        logger.debug(`AxiosError: ${e?.message}`);
      }
      setTimeout(this.runMainUpdateLoop.bind(this), 1000 * this.currentBackendRetryInterval);
    } finally {
      diskCache.unlock();
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
      websocketHandler.addWebsocketServer(this.wss);
    }
    if (this.wssUnixSocket) {
      websocketHandler.addWebsocketServer(this.wssUnixSocket);
    }

    if (Common.isLiquid() && config.DATABASE.ENABLED) {
      blocks.setNewBlockCallback(async () => {
        try {
          await elementsParser.$parse();
          await elementsParser.$updateFederationUtxos();
        } catch (e) {
          logger.warn('Elements parsing error: ' + (e instanceof Error ? e.message : e));
        }
      });
    }
    websocketHandler.setupConnectionHandling();
    if (config.MEMPOOL.ENABLED) {
      statistics.setNewStatisticsEntryCallback(websocketHandler.handleNewStatistic.bind(websocketHandler));
      memPool.setAsyncMempoolChangedCallback(websocketHandler.$handleMempoolChange.bind(websocketHandler));
      blocks.setNewAsyncBlockCallback(websocketHandler.handleNewBlock.bind(websocketHandler));
    }
    if (config.FIAT_PRICE.ENABLED) {
      priceUpdater.setRatesChangedCallback(websocketHandler.handleNewConversionRates.bind(websocketHandler));
    }
    loadingIndicators.setProgressChangedCallback(websocketHandler.handleLoadingChanged.bind(websocketHandler));

    accelerationApi.connectWebsocket();
  }

  setUpHttpApiRoutes(): void {
    bitcoinRoutes.initRoutes(this.app);
    if (config.MEMPOOL.OFFICIAL) {
      bitcoinCoreRoutes.initRoutes(this.app);
    }
    pricesRoutes.initRoutes(this.app);
    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && config.MEMPOOL.ENABLED) {
      statisticsRoutes.initRoutes(this.app);
    }
    if (Common.indexingEnabled() && config.MEMPOOL.ENABLED) {
      miningRoutes.initRoutes(this.app);
    }
    if (Common.isLiquid()) {
      liquidRoutes.initRoutes(this.app);
    }
    if (config.LIGHTNING.ENABLED) {
      generalLightningRoutes.initRoutes(this.app);
      nodesRoutes.initRoutes(this.app);
      channelsRoutes.initRoutes(this.app);
    }
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      accelerationRoutes.initRoutes(this.app);
    }
    if (config.WALLETS.ENABLED) {
      servicesRoutes.initRoutes(this.app);
    }
    if (!config.MEMPOOL.OFFICIAL) {
      aboutRoutes.initRoutes(this.app);
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
      logger.warn(`Used ${(this.maxHeapSize / stats.heap_size_limit * 100).toFixed(2)}% of heap limit (${formatBytes(this.maxHeapSize, byteUnits, true)} / ${formatBytes(stats.heap_size_limit, byteUnits)})!`);
    }
    if (this.lastHeapLogTime === null || (now - this.lastHeapLogTime) > (this.heapLogInterval * 1000)) {
      logger.debug(`Memory usage: ${formatBytes(this.maxHeapSize, byteUnits)} / ${formatBytes(stats.heap_size_limit, byteUnits)}`);
      this.warnedHeapCritical = false;
      this.maxHeapSize = 0;
      this.lastHeapLogTime = now;
    }
  }

  onExit(exitEvent, code = 0): void {
    logger.debug(`onExit for signal: ${exitEvent}`);
    if (config.DATABASE.ENABLED) {
      DB.releasePidLock();
    }
    this.server?.close();
    this.serverUnixSocket?.close();
    this.wss?.close();
    if (this.wssUnixSocket) {
      this.wssUnixSocket.close();
    }
    process.exit(code);
  }

  onUnhandledException(type, error): void {
    console.error(`${type}:`, error);
    this.onExit(type, 1);
  }
}

((): Server => new Server())();
