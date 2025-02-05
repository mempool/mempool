/**
 * Mempool Server v4.0
 * Enhanced with AI-PoW-R Mining & Stratum Support
 * Last updated: 2025-02-05
 * @josef edwards and @interchain.io ...
 */

import express, {
  Application,
  Request,
  Response,
  NextFunction,
  json,
  urlencoded,
  text,
} from 'express';
import { Server as HttpServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import cluster from 'cluster';
import os from 'os';
import { AxiosError } from 'axios';
import v8 from 'v8';
import { spawn } from 'child_process';
import path from 'path';

// --- Import configurations, types, and services ---
import { ServerConfig } from './types/config';
import { MiningRequest, MiningResponse } from './types/mining';

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

import { Common } from './utils/common';
import { formatBytes, getBytesUnit } from './utils/format';
import { AsyncLock } from './utils/asyncLock';

// --- Import route modules ---
import bitcoinRoutes from './routes/bitcoinRoutes';
import bitcoinCoreRoutes from './routes/bitcoinCoreRoutes';
import pricesRoutes from './routes/pricesRoutes';
import statisticsRoutes from './routes/statisticsRoutes';
import miningRoutes from './routes/miningRoutes';
import liquidRoutes from './routes/liquidRoutes';
import generalLightningRoutes from './routes/generalLightningRoutes';
import nodesRoutes from './routes/nodesRoutes';
import channelsRoutes from './routes/channelsRoutes';
import accelerationRoutes from './routes/accelerationRoutes';
import servicesRoutes from './routes/servicesRoutes';
import aboutRoutes from './routes/aboutRoutes';

// --- Import mining modules ---
import { AIPoWRMiner } from './mining/ai-powr';
import { StratumServer } from './mining/stratum';

interface ServerOptions {
  port: number;
  workers?: number;
  stratumPort?: number;
}

class Server {
  private readonly app: Application;
  private readonly httpServer: HttpServer;
  private readonly wsServer?: WebSocketServer;
  private readonly options: ServerOptions;
  private readonly lock: AsyncLock;
  private readonly miner: AIPoWRMiner;
  private readonly stratum?: StratumServer;

  private memoryStats = {
    maxHeapSize: 0,
    warnThreshold: 0.8,
    checkInterval: 2500, // milliseconds
  };

  constructor(options: ServerOptions) {
    this.options = options;
    this.app = express();
    this.httpServer = new HttpServer(this.app);
    this.lock = new AsyncLock();
    this.miner = new AIPoWRMiner();

    // If a Stratum port is provided, create the Stratum mining server
    if (options.stratumPort) {
      this.stratum = new StratumServer(options.stratumPort);
    }

    // If clustering is enabled, spawn worker processes
    if (config.MEMPOOL.SPAWN_CLUSTER_PROCS && cluster.isPrimary) {
      logger.notice(
        `Mempool Server (Master) is running on port ${this.options.port} (${backendInfo.getShortCommitHash()})`
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
      // Start server immediately in non-cluster mode or in worker processes
      this.setupServer().catch((error) => {
        logger.error('Server setup failed:', error);
        process.exit(1);
      });
    }
  }

  // Setup core components and start services
  private async setupServer(): Promise<void> {
    await this.initializeCore();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupAIMiningRoute();
    this.startStratumServer();

    this.setupWebSockets();

    await this.startAuxiliaryServices();

    this.setUpHttpApiRoutes();
    this.runMainUpdateLoop();

    this.setupMonitoring();

    // Start listening on the configured port
    await new Promise<void>((resolve, reject) => {
      this.httpServer.listen(this.options.port, () => {
        logger.info(`Server started on port ${this.options.port}`);
        resolve();
      });
      this.httpServer.on('error', reject);
    });
  }

  // Initialize database, cache, and spawn workers if needed
  private async initializeCore(): Promise<void> {
    // Register process listeners for graceful shutdown
    this.registerProcessListeners();

    // Database initialization and migration
    if (config.DATABASE.ENABLED) {
      await DB.initialize();
      try {
        if (process.env.npm_config_reindex_blocks === 'true') {
          await databaseMigration.$blocksReindexingTruncate();
        }
        await databaseMigration.$initializeOrMigrateDatabase();
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Database initialization error');
      }
    }

    // Initialize caches
    await this.initializeCache();
  }

  private registerProcessListeners(): void {
    ['exit', 'SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'].forEach((event) => {
      process.on(event, () => this.shutdown(event));
    });
    process.on('uncaughtException', (error) => this.shutdown('uncaughtException', error));
    process.on('unhandledRejection', (reason) => this.shutdown('unhandledRejection', reason));
  }

  private async initializeCache(): Promise<void> {
    if (config.MEMPOOL.ENABLED) {
      if (config.MEMPOOL.CACHE_ENABLED) {
        await diskCache.$loadMempoolCache();
      } else if (config.REDIS.ENABLED) {
        await redisCache.$loadCache();
      }
    }
  }

  private setupMiddleware(): void {
    // Security and CORS headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    });
    // Body parsers
    this.app.use(json({ limit: '50mb' }));
    this.app.use(urlencoded({ extended: true }));
    this.app.use(text({ type: ['text/plain', 'application/base64'] }));
  }

  private setupRoutes(): void {
    // Standard routes (grouped by module)
    bitcoinRoutes.init(this.app);
    if (config.MEMPOOL.OFFICIAL) {
      bitcoinCoreRoutes.init(this.app);
    }
    if (config.STATISTICS.ENABLED) {
      statisticsRoutes.init(this.app);
    }
    if (Common.indexingEnabled()) {
      miningRoutes.init(this.app);
    }
    if (Common.isLiquid()) {
      liquidRoutes.init(this.app);
    }
    if (config.LIGHTNING.ENABLED) {
      generalLightningRoutes.init(this.app);
      nodesRoutes.init(this.app);
      channelsRoutes.init(this.app);
    }
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      accelerationRoutes.init(this.app);
    }
    if (config.WALLETS.ENABLED) {
      servicesRoutes.init(this.app);
    }
    if (!config.MEMPOOL.OFFICIAL) {
      aboutRoutes.init(this.app);
    }
  }

  // AI-PoW-R mining endpoint (HTTP)
  private setupAIMiningRoute(): void {
    this.app.post('/api/v1/mine', async (req: Request<MiningRequest>, res: Response<MiningResponse>) => {
      const { blockData, difficulty } = req.body;
      if (!blockData) {
        return res.status(400).json({ success: false, error: 'Missing blockData' });
      }
      try {
        const result = await this.miner.mine(blockData, difficulty);
        res.json({
          success: true,
          hash: result.hash,
          nonce: result.nonce,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Mining failed:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
  }

  // Start the Stratum mining server (if configured)
  private startStratumServer(): void {
    if (this.stratum) {
      this.stratum.start().catch((error) => {
        logger.error('Stratum server failed to start:', error);
      });
    }
  }

  // Setup WebSocket connections (for mining requests and notifications)
  private setupWebSockets(): void {
    const wsServer = new WebSocketServer({ server: this.httpServer });
    wsServer.on('connection', (ws) => {
      logger.info('WebSocket client connected');
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'mine' && data.blockData) {
            const result = await this.miner.mine(data.blockData, data.difficulty);
            ws.send(JSON.stringify({ type: 'mined', ...result }));
          }
        } catch (error) {
          logger.error('WebSocket error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });
    });

    // Let the shared websocketHandler also perform its setup.
    websocketHandler.setupConnectionHandling();
  }

  // Start auxiliary services such as pools update, asset sync, etc.
  private async startAuxiliaryServices(): Promise<void> {
    await poolsUpdater.updatePoolsJson();
    await syncAssets.syncAssets$();
    await mempoolBlocks.updatePools$();

    if (config.FIAT_PRICE.ENABLED) {
      await priceUpdater.$initializeLatestPriceWithDb();
      priceUpdater.$run();
    }
    await chainTips.updateOrphanedBlocks();

    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && cluster.isPrimary) {
      statistics.startStatistics();
    }

    // Liquid icons refresh
    if (Common.isLiquid()) {
      this.initializeLiquidIcons();
    }
  }

  private setUpHttpApiRoutes(): void {
    // Add any additional API endpoints that are not part of the core routes.
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      });
    });
  }

  // Set up periodic monitoring (memory, health, etc.)
  private setupMonitoring(): void {
    setInterval(() => this.monitorMemory(), this.memoryStats.checkInterval);
  }

  private async monitorMemory(): Promise<void> {
    const stats = v8.getHeapStatistics();
    this.memoryStats.maxHeapSize = Math.max(stats.used_heap_size, this.memoryStats.maxHeapSize);
    if (this.memoryStats.maxHeapSize > stats.heap_size_limit * this.memoryStats.warnThreshold) {
      logger.warn(`Memory usage critical: ${formatBytes(this.memoryStats.maxHeapSize)}`);
    }
  }

  // Main update loop for mempool info, blocks, and other periodic tasks.
  private async runMainUpdateLoop(): Promise<void> {
    const start = Date.now();
    try {
      await memPool.$updateMemPoolInfo();
      const newMempool = await bitcoinApi.$getRawMempool();
      const minFeeMempool = memPool.limitGBT
        ? await bitcoinSecondClient.getRawMemPool()
        : null;
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
      setTimeout(() => this.runMainUpdateLoop(), numHandledBlocks > 0 ? 0 : remainingTime);
    } catch (error: any) {
      logger.error(
        `Exception in runMainUpdateLoop: ${error instanceof Error ? error.message : error}`
      );
      setTimeout(() => this.runMainUpdateLoop(), 1000 * this.options.workers || 1);
    } finally {
      diskCache.unlock();
    }
  }

  // Graceful shutdown
  private async shutdown(event: string, error?: any): Promise<void> {
    logger.info(`Shutdown initiated due to ${event}`);
    if (error) {
      logger.error('Shutdown error:', error);
    }
    await this.lock.acquire('shutdown', async () => {
      this.wsServer?.close();
      this.httpServer.close();
      await this.stratum?.stop();
      if (config.DATABASE.ENABLED) {
        await DB.close();
      }
    });
    process.exit(0);
  }

  // Public method to start the server (used if this module is run as main)
  public async start(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.options.port, () => {
          logger.info(`Server started on port ${this.options.port}`);
          resolve();
        });
        this.httpServer.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  // Public method to stop the server gracefully.
  public async stop(): Promise<void> {
    try {
      await this.lock.acquire('shutdown', async () => {
        this.wsServer?.close();
        this.httpServer.close();
        await this.stratum?.stop();
        if (config.DATABASE.ENABLED) {
          await DB.close();
        }
      });
    } catch (error) {
      logger.error('Error during shutdown:', error);
    }
  }
}

// --- Start the server if this module is the main module ---
if (require.main === module) {
  const server = new Server({
    port: config.MEMPOOL.HTTP_PORT,
    workers: config.MEMPOOL.SPAWN_CLUSTER_PROCS,
    stratumPort: config.STRATUM?.PORT,
  });
  
  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

  // Handle graceful shutdown signals
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received. Starting graceful shutdown...');
    await server.stop();
    process.exit(0);
  });
}

export default Server;

/**
 * Mempool Server v5.0
 * Enhanced with AI-PoW-R Mining, Advanced Clustering, Metrics,
 * Security Middleware, Rate Limiting & Real-time Monitoring
 * @version 5.0.0
 * @lastUpdated 2025-02-05 19:43:19
 * @author ...
 */

import express, {
  Application,
  Request,
  Response,
  NextFunction,
  json,
  urlencoded,
  text,
} from 'express';
import { Server as HttpServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import cluster from 'cluster';
import os from 'os';
import { AxiosError } from 'axios';
import v8 from 'v8';
import { spawn } from 'child_process';
import path from 'path';

// --- Import configuration, types, and core services ---
import { ServerConfig } from './types/config';
import { MiningRequest, MiningResponse } from './types/mining';

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
import { Common } from './utils/common';
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

// --- Import mining modules and advanced services (assumed stubs) ---
import { mineAIBlock } from './miner/ai_powr_miner';
import { AIPoWRMiner } from './mining/ai-powr';
import { StratumServer } from './mining/stratum';
import { MiningPool } from './mining/mining-pool';

// --- Import enhanced utilities (assumed stubs) ---
import { AsyncLock } from './utils/asyncLock';
import { MetricsCollector } from './utils/MetricsCollector';
import { SecurityMiddleware } from './utils/SecurityMiddleware';
import { RateLimiter } from './utils/RateLimiter';

// --- Define ServerOptions and ServerState types ---
interface ServerOptions {
  port: number;
  workers?: number;
  stratumPort?: number;
  metricsEnabled: boolean;
  securityLevel: 'basic' | 'advanced';
  rateLimits: {
    windowMs: number;
    maxRequests: number;
  };
}

enum ServerState {
  INITIALIZING,
  STARTING,
  RUNNING,
  SHUTTING_DOWN,
  STOPPED,
}

// --- The main Server class ---
import { EventEmitter } from 'events';
import { ClusterWorker } from 'cluster'; // assuming your type for worker

class Server extends EventEmitter {
  private readonly app: Application;
  private readonly httpServer: HttpServer;
  private readonly wsServer: WebSocketServer;
  private readonly options: ServerOptions;
  private readonly lock: AsyncLock;
  private readonly miner: AIPoWRMiner;
  private readonly stratum?: StratumServer;
  private readonly pool?: MiningPool;
  private readonly metrics: MetricsCollector;
  private readonly security: SecurityMiddleware;
  private readonly rateLimiter: RateLimiter;
  private state: ServerState = ServerState.INITIALIZING;
  private workers: Map<number, ClusterWorker> = new Map();

  private memoryStats = {
    maxHeapSize: 0,
    warnThreshold: 0.8,
    checkInterval: 2500, // ms
    lastCheck: Date.now(),
    criticalAlerts: 0,
  };

  constructor(options: ServerOptions) {
    super();
    this.options = options;
    this.app = express();
    this.httpServer = new HttpServer(this.app);
    this.lock = new AsyncLock();

    // Initialize enhanced utilities
    this.metrics = new MetricsCollector({
      enabled: options.metricsEnabled,
      interval: 1000,
      retention: 24 * 60 * 60,
    });
    this.security = new SecurityMiddleware({
      level: options.securityLevel,
      metrics: this.metrics,
    });
    this.rateLimiter = new RateLimiter({
      windowMs: options.rateLimits.windowMs,
      maxRequests: options.rateLimits.maxRequests,
      metrics: this.metrics,
    });

    // Initialize mining components with advanced config
    this.miner = new AIPoWRMiner({
      threads: os.cpus().length,
      metrics: this.metrics,
      maxDifficulty: config.MINING.AI_POWR.MAX_DIFFICULTY,
      autoOptimize: true,
    });

    if (options.stratumPort) {
      this.stratum = new StratumServer({
        port: options.stratumPort,
        metrics: this.metrics,
        maxConnections: 1000,
        difficulty: config.MINING.AI_POWR.INITIAL_DIFFICULTY,
      });
      this.pool = new MiningPool({
        miner: this.miner,
        stratum: this.stratum,
        metrics: this.metrics,
        fee: config.MINING.POOL_FEE,
        payoutThreshold: config.MINING.MIN_PAYOUT,
      });
    }

    // Setup enhanced error handling
    this.setupErrorHandling();

    // Initialize clustering if primary; otherwise, run as worker.
    if (config.MEMPOOL.SPAWN_CLUSTER_PROCS && cluster.isPrimary) {
      this.initializePrimaryNode();
    } else {
      this.initializeWorkerNode();
    }
  }

  private validateOptions(options: ServerOptions): ServerOptions {
    // Optionally validate options here
    return options;
  }

  private async initializePrimaryNode(): Promise<void> {
    this.state = ServerState.STARTING;
    logger.notice(
      `Mempool Server v5.0 (Primary) initializing on port ${this.options.port} (${backendInfo.getShortCommitHash()})`
    );

    // Spawn workers
    const numWorkers = this.options.workers || os.cpus().length;
    for (let i = 0; i < numWorkers; i++) {
      await this.spawnWorker(i);
    }
    this.setupWorkerMonitoring();
    await this.initializePrimaryServices();
    this.state = ServerState.RUNNING;
  }

  private async spawnWorker(id: number): Promise<void> {
    return new Promise((resolve) => {
      const env = { workerId: id };
      const worker = cluster.fork(env);
      worker.process['env'] = env;
      this.workers.set(id, worker);
      resolve();
    });
  }

  private setupWorkerMonitoring(): void {
    // Check worker health periodically
    setInterval(() => this.checkWorkersHealth(), 5000);
    // Collect metrics from workers
    setInterval(() => this.collectWorkerMetrics(), 1000);
    cluster.on('message', (worker, message) => {
      this.handleWorkerMessage(worker.id, message);
    });
  }

  private async checkWorkersHealth(): Promise<void> {
    for (const [id, worker] of this.workers.entries()) {
      // Assume each worker has a "lastActive" metric
      const inactiveDuration = Date.now() - (worker as any).metrics?.lastActive;
      if (inactiveDuration > 30000) {
        logger.warn(`Worker ${id} is unresponsive; restarting.`);
        await this.restartWorker(id);
      }
    }
  }

  private async restartWorker(id: number): Promise<void> {
    const worker = this.workers.get(id);
    if (worker) {
      logger.info(`Restarting worker ${id}`);
      worker.process.kill();
      await this.spawnWorker(id);
    }
  }

  private async collectWorkerMetrics(): Promise<void> {
    const metricsArray = await Promise.all(
      Array.from(this.workers.values()).map((worker) =>
        new Promise((resolve) => {
          worker.process.send({ type: 'getMetrics' });
          worker.process.once('message', resolve);
        })
      )
    );
    this.metrics.updateWorkerMetrics(metricsArray);
  }

  private handleWorkerMessage(workerId: number, message: any): void {
    // Process worker messages (e.g., errors, metrics)
    this.metrics.recordWorkerMessage(workerId, message);
  }

  private async initializeWorkerNode(): Promise<void> {
    this.state = ServerState.STARTING;
    await this.setupWorkerComponents();
    await this.initializeCore();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSockets();
    await this.startServices();
    this.state = ServerState.RUNNING;
  }

  private async setupWorkerComponents(): Promise<void> {
    // Apply enhanced security, rate limiting, and metrics middleware
    this.app.use(this.security.middleware());
    this.app.use(this.rateLimiter.middleware());
    this.app.use(this.metrics.middleware());
    this.app.use(this.errorHandler.bind(this));
  }

  private async initializeCore(): Promise<void> {
    this.registerProcessListeners();
    if (config.DATABASE.ENABLED) {
      await DB.initialize();
      try {
        if (process.env.npm_config_reindex_blocks === 'true') {
          await databaseMigration.$blocksReindexingTruncate();
        }
        await databaseMigration.$initializeOrMigrateDatabase();
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Database initialization error');
      }
    }
    await this.initializeCache();
  }

  private registerProcessListeners(): void {
    ['exit', 'SIGHUP', 'SIGINT', 'SIGTERM', 'SIGUSR1', 'SIGUSR2'].forEach((event) => {
      process.on(event, () => this.shutdown(event));
    });
    process.on('uncaughtException', (error) => this.shutdown('uncaughtException', error));
    process.on('unhandledRejection', (reason) => this.shutdown('unhandledRejection', reason));
  }

  private async initializeCache(): Promise<void> {
    if (config.MEMPOOL.ENABLED) {
      if (config.MEMPOOL.CACHE_ENABLED) {
        await diskCache.$loadMempoolCache();
      } else if (config.REDIS.ENABLED) {
        await redisCache.$loadCache();
      }
    }
  }

  private setupMiddleware(): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    });
    this.app.use(json({ limit: '50mb' }));
    this.app.use(urlencoded({ extended: true }));
    this.app.use(text({ type: ['text/plain', 'application/base64'] }));
  }

  private setupRoutes(): void {
    // AI-PoW-R Mining endpoint
    this.app.post('/api/v1/mine', async (req: Request<MiningRequest>, res: Response<MiningResponse>) => {
      const { blockData, difficulty } = req.body;
      if (!blockData) {
        return res.status(400).json({ success: false, error: 'Missing blockData' });
      }
      try {
        const result = await this.miner.mine(blockData, difficulty);
        res.json({
          success: true,
          hash: result.hash,
          nonce: result.nonce,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error('Mining failed:', error);
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });
    // Standard routes
    bitcoinRoutes.init(this.app);
    if (config.MEMPOOL.OFFICIAL) {
      bitcoinCoreRoutes.init(this.app);
    }
    pricesRoutes.init(this.app);
    if (config.STATISTICS.ENABLED && config.DATABASE.ENABLED && config.MEMPOOL.ENABLED) {
      statisticsRoutes.init(this.app);
    }
    if (Common.indexingEnabled() && config.MEMPOOL.ENABLED) {
      miningRoutes.init(this.app);
    }
    if (Common.isLiquid()) {
      liquidRoutes.init(this.app);
    }
    if (config.LIGHTNING.ENABLED) {
      generalLightningRoutes.init(this.app);
      nodesRoutes.init(this.app);
      channelsRoutes.init(this.app);
    }
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      accelerationRoutes.init(this.app);
    }
    if (config.WALLETS.ENABLED) {
      servicesRoutes.init(this.app);
    }
    if (!config.MEMPOOL.OFFICIAL) {
      aboutRoutes.init(this.app);
    }
    // Additional API endpoints
    this.app.get('/health', (req, res) => {
      res.json({
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupWebSockets(): void {
    const wsServer = new WebSocketServer({ server: this.httpServer });
    wsServer.on('connection', (ws) => {
      logger.info('WebSocket client connected');
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          if (data.type === 'mine' && data.blockData) {
            const result = await this.miner.mine(data.blockData, data.difficulty);
            ws.send(JSON.stringify({ type: 'mined', ...result }));
          }
        } catch (error) {
          logger.error('WebSocket error:', error);
          ws.send(
            JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            })
          );
        }
      });
    });
    // Delegate additional connections to the shared websocketHandler
    websocketHandler.setupConnectionHandling();
  }

  private async startServices(): Promise<void> {
    if (config.MEMPOOL.ENABLED) {
      await this.startMempoolSync();
    }
    if (config.FIAT_PRICE.ENABLED) {
      await this.startPriceUpdates();
    }
    if (this.stratum) {
      await this.stratum.start();
    }
  }

  private async startMempoolSync(): Promise<void> {
    // Stubbed implementation; add your mempool sync logic here
    await poolsUpdater.updatePoolsJson();
    await syncAssets.syncAssets$();
    await mempoolBlocks.updatePools$();
  }

  private async startPriceUpdates(): Promise<void> {
    await priceUpdater.$initializeLatestPriceWithDb();
    priceUpdater.$run();
    await chainTips.updateOrphanedBlocks();
  }

  private setupMonitoring(): void {
    setInterval(() => this.monitorMemory(), this.memoryStats.checkInterval);
  }

  private async monitorMemory(): Promise<void> {
    const stats = v8.getHeapStatistics();
    this.memoryStats.maxHeapSize = Math.max(stats.used_heap_size, this.memoryStats.maxHeapSize);
    if (this.memoryStats.maxHeapSize > stats.heap_size_limit * this.memoryStats.warnThreshold) {
      logger.warn(`Memory usage critical: ${formatBytes(this.memoryStats.maxHeapSize)}`);
    }
  }

  private setupErrorHandling(): void {
    // Global error handling for the process
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception:', err);
      this.metrics.recordError(err);
      process.exit(1);
    });
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      this.metrics.recordError(reason);
    });
  }

  private errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
    this.metrics.recordError(err);
    logger.error('HTTP error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      requestId: (req as any).id || 'unknown',
      timestamp: new Date().toISOString(),
    });
  }

  public async start(): Promise<void> {
    try {
      await this.lock.acquire('startup', async () => {
        if (cluster.isPrimary) {
          await this.initializePrimaryNode();
        } else {
          await this.initializeWorkerNode();
        }
      });
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(this.options.port, () => {
          logger.info(`Server started on port ${this.options.port}`);
          resolve();
        });
        this.httpServer.on('error', reject);
      });
    } catch (error) {
      logger.error('Failed to start server:', error);
      this.metrics.recordError('server_start_failed');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    this.state = ServerState.SHUTTING_DOWN;
    try {
      await this.lock.acquire('shutdown', async () => {
        this.wsServer?.close();
        this.httpServer.close();
        await this.miner.stop();
        await this.stratum?.stop();
        await this.pool?.stop();
        for (const worker of this.workers.values()) {
          worker.process.kill();
        }
        if (config.DATABASE.ENABLED) {
          await DB.close();
        }
        this.metrics.stop();
        this.rateLimiter.clear();
      });
    } catch (error) {
      logger.error('Error during shutdown:', error);
      this.metrics.recordError('shutdown_failed');
    }
  }

  private async shutdown(event: string, error?: any): Promise<void> {
    logger.info(`Shutdown initiated due to ${event}`);
    if (error) {
      logger.error('Shutdown error:', error);
    }
    await this.stop();
    process.exit(0);
  }

  // Placeholder for main update loop
  private async runMainUpdateLoop(): Promise<void> {
    const start = Date.now();
    try {
      await memPool.$updateMemPoolInfo();
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
      setTimeout(() => this.runMainUpdateLoop(), numHandledBlocks > 0 ? 0 : remainingTime);
      this.metrics.recordLoopSuccess();
    } catch (e: any) {
      this.metrics.recordError(e);
      logger.error(
        `Exception in runMainUpdateLoop: ${e instanceof Error ? e.message : e}`
      );
      setTimeout(() => this.runMainUpdateLoop(), 1000 * this.options.workers || 1);
    } finally {
      diskCache.unlock();
    }
  }

  // Placeholder for lightning backend startup
  private async $runLightningBackend(): Promise<void> {
    try {
      await fundingTxFetcher.$init();
      await networkSyncService.$startService();
      await lightningStatsUpdater.$startService();
      await forensicsService.$startService();
    } catch (e) {
      logger.error(`Lightning backend error: ${e instanceof Error ? e.message : e}`);
      await Common.sleep$(1000 * 60);
      this.$runLightningBackend();
    }
  }
}

// --- Start the server if this module is the main module ---
if (require.main === module) {
  const server = new Server({
    port: config.MEMPOOL.HTTP_PORT,
    workers: config.MEMPOOL.SPAWN_CLUSTER_PROCS,
    stratumPort: config.STRATUM?.PORT,
    metricsEnabled: true,
    securityLevel: 'advanced',
    rateLimits: {
      windowMs: 15 * 60 * 1000,
      maxRequests: 100,
    },
  });

  server.start().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
  });

  // Handle graceful shutdown signals
  ['SIGTERM', 'SIGINT'].forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      await server.stop();
      process.exit(0);
    });
  });
}

export default Server;
