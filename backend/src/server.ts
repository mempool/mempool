import express, { Application, Request, Response, NextFunction } from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import cluster from 'cluster';
import os from 'os';
import { AxiosError } from 'axios';
import v8 from 'v8';

// Consolidated imports from our local modules
import bitcoinApi from './api/bitcoin/bitcoin-api-factory';
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
import { formatBytes, getBytesUnit } from './utils/format';
import redisCache from './api/redis-cache';
import accelerationApi from './api/services/acceleration';
import bitcoinCoreRoutes from './api/bitcoin/bitcoin-core.routes';
import bitcoinSecondClient from './api/bitcoin/bitcoin-second-client';
import accelerationRoutes from './api/acceleration/acceleration.routes';
import aboutRoutes from './api/about.routes';
import mempoolBlocks from './api/mempool-blocks';
import walletApi from './api/services/wallets';
import stratumApi from './api/services/stratum';

// Import the AI mining function
import { mineAIBlock } from './miner/ai_powr_miner';

class Server {
  private app: Application;
  private server: http.Server;
  private wss?: WebSocket.Server;
  private serverUnixSocket?: http.Server;
  private wssUnixSocket?: WebSocket.Server;

  // Cluster and health check fields
  private currentBackendRetryInterval = 1;
  private backendRetryCount = 0;
  private maxHeapSize = 0;
  private heapLogInterval = 60; // seconds
  private warnedHeapCritical = false;
  private lastHeapLogTime: number | null = null;

  constructor() {
    this.app = express();

    // If clustering is enabled, fork workers
    if (config.MEMPOOL.SPAWN_CLUSTER_PROCS && cluster.isPrimary) {
      logger.notice(
        `Mempool Server (Master) is running on port ${config.MEMPOOL.HTTP_PORT} (${backendInfo.getShortCommitHash()})`
      );
      const numCPUs = config.MEMPOOL.SPAWN_CLUSTER_PROCS || os.cpus().length;
      for (let i = 0; i < numCPUs; i++) {
        const env = { workerId: i };
        const worker = cluster.fork(env);
        worker.process['env'] = env;
      }
      cluster.on('exit', (worker, code, signal) => {
        const workerId = worker.process['env']?.workerId;
        logger.warn(
          `Mempool Worker PID #${worker.process.pid} (workerId: ${workerId}) died. Restarting in 10 seconds... ${signal || code}`
        );
        setTimeout(() => {
          const env = { workerId };
          const newWorker = cluster.fork(env);
          newWorker.process['env'] = env;
        }, 10000);
      });
    } else {
      // If not primary (or clustering disabled) then start server immediately
      this.startServer(cluster.isWorker);
    }
  }

  async startServer(isWorker: boolean = false): Promise<void> {
    logger.notice(
      `Starting Mempool Server${isWorker ? ' (worker)' : ''}... (${backendInfo.getShortCommitHash()})`
    );

    this.registerProcessListeners();
    await this.initializeDatabase();
    this.setupExpressMiddleware();
    this.setupRoutes();
    this.setupAIMiningRoute(); // Add the AI-PoW-R mining route

    // Create HTTP server and optionally a Unix socket server
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    if (config.MEMPOOL.UNIX_SOCKET_PATH) {
      this.serverUnixSocket = http.createServer(this.app);
      this.wssUnixSocket = new WebSocket.Server({ server: this.serverUnixSocket });
    }
    this.setupWebSocketHandling();

    // Update pools, sync assets and caches
    await poolsUpdater.updatePoolsJson();
    await syncAssets.syncAssets$();
    await mempoolBlocks.updatePools$();
    await this.loadCaches();

    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && cluster.isPrimary) {
      statistics.startStatistics();
    }

    if (Common.isLiquid()) {
      this.initializeLiquidIcons();
    }

    if (config.FIAT_PRICE.ENABLED) {
      await priceUpdater.$initializeLatestPriceWithDb();
      priceUpdater.$run();
    }
    await chainTips.updateOrphanedBlocks();

    // Additional HTTP API routes from various modules
    this.setUpHttpApiRoutes();

    // Start main mempool update loop
    if (config.MEMPOOL.ENABLED) {
      this.runMainUpdateLoop();
    }

    // Schedule periodic health checks
    setInterval(() => this.healthCheck(), 2500);

    // Start lightning backend if enabled
    if (config.LIGHTNING.ENABLED) {
      this.$runLightningBackend();
    }

    // Start listening on configured ports
    this.server.listen(config.MEMPOOL.HTTP_PORT, () => {
      if (isWorker) {
        logger.info(`Mempool Server worker #${process.pid} started`);
      } else {
        logger.notice(`Mempool Server is running on port ${config.MEMPOOL.HTTP_PORT}`);
      }
    });
    if (this.serverUnixSocket) {
      this.serverUnixSocket.listen(config.MEMPOOL.UNIX_SOCKET_PATH, () => {
        logger.notice(`Mempool Server is listening on ${config.MEMPOOL.UNIX_SOCKET_PATH}`);
      });
    }

    poolsUpdater.$startService();
  }

  // Register listeners for process exit and errors.
  private registerProcessListeners(): void {
    ['exit', 'SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'].forEach((event) => {
      process.on(event, () => this.onExit(event));
    });
    process.on('uncaughtException', (error) => this.onUnhandledException('uncaughtException', error));
    process.on('unhandledRejection', (reason) => this.onUnhandledException('unhandledRejection', reason));
  }

  // Database initialization and migrations.
  private async initializeDatabase(): Promise<void> {
    if (config.DATABASE.ENABLED) {
      DB.getPidLock();
      await DB.checkDbConnection();
      try {
        if (process.env.npm_config_reindex_blocks === 'true') {
          await databaseMigration.$blocksReindexingTruncate();
        }
        await databaseMigration.$initializeOrMigrateDatabase();
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Database initialization error');
      }
    }
  }

  // Common Express middleware
  private setupExpressMiddleware(): void {
    this.app
      .use((req: Request, res: Response, next: NextFunction) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      })
      .use(express.urlencoded({ extended: true }))
      .use(express.text({ type: ['text/plain', 'application/base64'] }))
      .use(express.json());
  }

  // Set up all HTTP routes from your various modules.
  private setUpHttpApiRoutes(): void {
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

  // Add the AI-PoW-R mining endpoint.
  private setupAIMiningRoute(): void {
    this.app.post('/api/mining/submit', async (req: Request, res: Response) => {
      const { blockData } = req.body;
      if (!blockData) {
        return res.status(400).json({ error: 'Missing blockData' });
      }
      try {
        const minedHash = await mineAIBlock(blockData);
        return res.json({ status: 'success', hash: minedHash });
      } catch (error) {
        logger.err('AI mining error: ' + (error instanceof Error ? error.message : error));
        return res.status(500).json({ error: 'Mining failed' });
      }
    });
  }

  // Set up WebSocket servers and delegate connection handling.
  private setupWebSocketHandling(): void {
    if (this.wss) {
      this.wss.on('connection', (ws) => {
        logger.info('🌐 WebSocket Connection Established');
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            // Process mining requests over WebSocket.
            if (data.type === 'mine' && data.blockData) {
              const minedHash = await mineAIBlock(data.blockData);
              ws.send(JSON.stringify({ type: 'mined', hash: minedHash }));
            }
          } catch (err) {
            logger.err('WebSocket message error: ' + (err instanceof Error ? err.message : err));
          }
        });
      });
    }
    if (this.wssUnixSocket) {
      this.wssUnixSocket.on('connection', (ws) => {
        logger.info('🌐 WebSocket Unix Socket Connection Established');
      });
    }
    // Let the shared websocketHandler take care of additional connections.
    websocketHandler.setupConnectionHandling();
    // Liquid-specific block callbacks.
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
    // Setup callbacks for mempool, statistics, and loading indicators.
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
    if (config.STRATUM.ENABLED) {
      stratumApi.connectWebsocket();
    }
  }

  // Load caches from disk or Redis as configured.
  private async loadCaches(): Promise<void> {
    if (config.MEMPOOL.ENABLED) {
      if (config.MEMPOOL.CACHE_ENABLED) {
        await diskCache.$loadMempoolCache();
      } else if (config.REDIS.ENABLED) {
        await redisCache.$loadCache();
      }
    }
  }

  // Liquid icons loading and refresh.
  private initializeLiquidIcons(): void {
    try {
      icons.loadIcons();
    } catch (e) {
      logger.err('Cannot load liquid icons. Ignoring. Reason: ' + (e instanceof Error ? e.message : e));
    }
    setInterval(() => {
      try {
        icons.loadIcons();
      } catch (e) {
        logger.err('Cannot load liquid icons on refresh. Reason: ' + (e instanceof Error ? e.message : e));
      }
    }, 3600_000);
  }

  // The main update loop that refreshes mempool info, blocks, etc.
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
        walletApi.$syncWallets();
      }
      if (config.FIAT_PRICE.ENABLED) {
        priceUpdater.$run();
      }
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

  // Lightning backend initialization.
  async $runLightningBackend(): Promise<void> {
    try {
      await fundingTxFetcher.$init();
      await networkSyncService.$startService();
      await lightningStatsUpdater.$startService();
      await forensicsService.$startService();
    } catch (e) {
      logger.err(`Exception in $runLightningBackend. Restarting in 1 minute. Reason: ${(e instanceof Error ? e.message : e)}`);
      await Common.sleep$(1000 * 60);
      this.$runLightningBackend();
    }
  }

  // Health check monitors memory usage and logs warnings if near the limit.
  healthCheck(): void {
    const now = Date.now();
    const stats = v8.getHeapStatistics();
    this.maxHeapSize = Math.max(stats.used_heap_size, this.maxHeapSize);
    const warnThreshold = 0.8 * stats.heap_size_limit;
    const byteUnits = getBytesUnit(Math.max(this.maxHeapSize, stats.heap_size_limit));
    if (!this.warnedHeapCritical && this.maxHeapSize > warnThreshold) {
      this.warnedHeapCritical = true;
      logger.warn(
        `Used ${(this.maxHeapSize / stats.heap_size_limit * 100).toFixed(2)}% of heap limit (${formatBytes(this.maxHeapSize, byteUnits, true)} / ${formatBytes(stats.heap_size_limit, byteUnits)})!`
      );
    }
    if (this.lastHeapLogTime === null || (now - this.lastHeapLogTime) > (this.heapLogInterval * 1000)) {
      logger.debug(`Memory usage: ${formatBytes(this.maxHeapSize, byteUnits)} / ${formatBytes(stats.heap_size_limit, byteUnits)}`);
      this.warnedHeapCritical = false;
      this.maxHeapSize = 0;
      this.lastHeapLogTime = now;
    }
  }

  // Graceful shutdown on exit signals.
  onExit(exitEvent: string, code = 0): void {
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

  // Log and exit on unhandled errors.
  onUnhandledException(type: string, error: any): void {
    console.error(`${type}:`, error);
    this.onExit(type, 1);
  }
}

// Start the server immediately.
((): Server => new Server())();
