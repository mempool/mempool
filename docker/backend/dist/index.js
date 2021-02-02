"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cluster = require("cluster");
const axios_1 = require("axios");
const database_1 = require("./database");
const config_1 = require("./config");
const routes_1 = require("./routes");
const blocks_1 = require("./api/blocks");
const mempool_1 = require("./api/mempool");
const disk_cache_1 = require("./api/disk-cache");
const statistics_1 = require("./api/statistics");
const websocket_handler_1 = require("./api/websocket-handler");
const fiat_conversion_1 = require("./api/fiat-conversion");
const bisq_1 = require("./api/bisq/bisq");
const markets_1 = require("./api/bisq/markets");
const donations_1 = require("./api/donations");
const logger_1 = require("./logger");
const backend_info_1 = require("./api/backend-info");
const loading_indicators_1 = require("./api/loading-indicators");
const mempool_2 = require("./api/mempool");
class Server {
    constructor() {
        this.currentBackendRetryInterval = 5;
        this.app = express();
        if (!config_1.default.MEMPOOL.SPAWN_CLUSTER_PROCS) {
            this.startServer();
            return;
        }
        if (cluster.isMaster) {
            logger_1.default.notice(`Mempool Server (Master) is running on port ${config_1.default.MEMPOOL.HTTP_PORT} (${backend_info_1.default.getShortCommitHash()})`);
            const numCPUs = config_1.default.MEMPOOL.SPAWN_CLUSTER_PROCS;
            for (let i = 0; i < numCPUs; i++) {
                const env = { workerId: i };
                const worker = cluster.fork(env);
                worker.process['env'] = env;
            }
            cluster.on('exit', (worker, code, signal) => {
                const workerId = worker.process['env'].workerId;
                logger_1.default.warn(`Mempool Worker PID #${worker.process.pid} workerId: ${workerId} died. Restarting in 10 seconds... ${signal || code}`);
                setTimeout(() => {
                    const env = { workerId: workerId };
                    const newWorker = cluster.fork(env);
                    newWorker.process['env'] = env;
                }, 10000);
            });
        }
        else {
            this.startServer(true);
        }
    }
    startServer(worker = false) {
        logger_1.default.debug(`Starting Mempool Server${worker ? ' (worker)' : ''}... (${backend_info_1.default.getShortCommitHash()})`);
        this.app
            .use((req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            next();
        })
            .use(express.urlencoded({ extended: true }))
            .use(express.json());
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        disk_cache_1.default.loadMempoolCache();
        if (config_1.default.DATABASE.ENABLED) {
            database_1.checkDbConnection();
        }
        if (config_1.default.STATISTICS.ENABLED && config_1.default.DATABASE.ENABLED) {
            statistics_1.default.startStatistics();
        }
        this.setUpHttpApiRoutes();
        this.setUpWebsocketHandling();
        this.runMainUpdateLoop();
        fiat_conversion_1.default.startService();
        if (config_1.default.BISQ_BLOCKS.ENABLED) {
            bisq_1.default.startBisqService();
            bisq_1.default.setPriceCallbackFunction((price) => websocket_handler_1.default.setExtraInitProperties('bsq-price', price));
            blocks_1.default.setNewBlockCallback(bisq_1.default.handleNewBitcoinBlock.bind(bisq_1.default));
        }
        if (config_1.default.BISQ_MARKETS.ENABLED) {
            markets_1.default.startBisqService();
        }
        this.server.listen(config_1.default.MEMPOOL.HTTP_PORT, () => {
            if (worker) {
                logger_1.default.info(`Mempool Server worker #${process.pid} started`);
            }
            else {
                logger_1.default.notice(`Mempool Server is running on port ${config_1.default.MEMPOOL.HTTP_PORT}`);
            }
        });
    }
    async runMainUpdateLoop() {
        try {
            await mempool_1.default.$updateMemPoolInfo();
            await blocks_1.default.$updateBlocks();
            await mempool_1.default.$updateMempool();
            setTimeout(this.runMainUpdateLoop.bind(this), config_1.default.MEMPOOL.POLL_RATE_MS);
            this.currentBackendRetryInterval = 5;
        }
        catch (e) {
            const loggerMsg = `runMainLoop error: ${(e.message || e)}. Retrying in ${this.currentBackendRetryInterval} sec.`;
            if (this.currentBackendRetryInterval > 5) {
                logger_1.default.warn(loggerMsg);
                mempool_2.default.setOutOfSync();
            }
            else {
                logger_1.default.debug(loggerMsg);
            }
            logger_1.default.debug(JSON.stringify(e));
            setTimeout(this.runMainUpdateLoop.bind(this), 1000 * this.currentBackendRetryInterval);
            this.currentBackendRetryInterval *= 2;
            this.currentBackendRetryInterval = Math.min(this.currentBackendRetryInterval, 60);
        }
    }
    setUpWebsocketHandling() {
        if (this.wss) {
            websocket_handler_1.default.setWebsocketServer(this.wss);
        }
        websocket_handler_1.default.setupConnectionHandling();
        statistics_1.default.setNewStatisticsEntryCallback(websocket_handler_1.default.handleNewStatistic.bind(websocket_handler_1.default));
        blocks_1.default.setNewBlockCallback(websocket_handler_1.default.handleNewBlock.bind(websocket_handler_1.default));
        mempool_1.default.setMempoolChangedCallback(websocket_handler_1.default.handleMempoolChange.bind(websocket_handler_1.default));
        donations_1.default.setNotfyDonationStatusCallback(websocket_handler_1.default.handleNewDonation.bind(websocket_handler_1.default));
        fiat_conversion_1.default.setProgressChangedCallback(websocket_handler_1.default.handleNewConversionRates.bind(websocket_handler_1.default));
        loading_indicators_1.default.setProgressChangedCallback(websocket_handler_1.default.handleLoadingChanged.bind(websocket_handler_1.default));
    }
    setUpHttpApiRoutes() {
        this.app
            .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'transaction-times', routes_1.default.getTransactionTimes)
            .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'fees/recommended', routes_1.default.getRecommendedFees)
            .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'fees/mempool-blocks', routes_1.default.getMempoolBlocks)
            .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'backend-info', routes_1.default.getBackendInfo)
            .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'init-data', routes_1.default.getInitData);
        if (config_1.default.STATISTICS.ENABLED && config_1.default.DATABASE.ENABLED) {
            this.app
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'statistics/2h', routes_1.default.get2HStatistics)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'statistics/24h', routes_1.default.get24HStatistics.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'statistics/1w', routes_1.default.get1WHStatistics.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'statistics/1m', routes_1.default.get1MStatistics.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'statistics/3m', routes_1.default.get3MStatistics.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'statistics/6m', routes_1.default.get6MStatistics.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'statistics/1y', routes_1.default.get1YStatistics.bind(routes_1.default));
        }
        if (config_1.default.BISQ_BLOCKS.ENABLED) {
            this.app
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/stats', routes_1.default.getBisqStats)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/tx/:txId', routes_1.default.getBisqTransaction)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/block/:hash', routes_1.default.getBisqBlock)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/blocks/tip/height', routes_1.default.getBisqTip)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/blocks/:index/:length', routes_1.default.getBisqBlocks)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/address/:address', routes_1.default.getBisqAddress)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/txs/:index/:length', routes_1.default.getBisqTransactions);
        }
        if (config_1.default.BISQ_MARKETS.ENABLED) {
            this.app
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/currencies', routes_1.default.getBisqMarketCurrencies.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/depth', routes_1.default.getBisqMarketDepth.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/hloc', routes_1.default.getBisqMarketHloc.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/markets', routes_1.default.getBisqMarketMarkets.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/offers', routes_1.default.getBisqMarketOffers.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/ticker', routes_1.default.getBisqMarketTicker.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/trades', routes_1.default.getBisqMarketTrades.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'bisq/markets/volumes', routes_1.default.getBisqMarketVolumes.bind(routes_1.default));
        }
        if (config_1.default.SPONSORS.ENABLED) {
            this.app
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'donations', routes_1.default.getDonations.bind(routes_1.default))
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'donations/images/:id', routes_1.default.getSponsorImage.bind(routes_1.default))
                .post(config_1.default.MEMPOOL.API_URL_PREFIX + 'donations', routes_1.default.createDonationRequest.bind(routes_1.default))
                .post(config_1.default.MEMPOOL.API_URL_PREFIX + 'donations-webhook', routes_1.default.donationWebhook.bind(routes_1.default));
        }
        else {
            this.app
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'donations', async (req, res) => {
                try {
                    const response = await axios_1.default.get('https://mempool.space/api/v1/donations', { responseType: 'stream' });
                    response.data.pipe(res);
                }
                catch (e) {
                    res.status(500).end();
                }
            })
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'donations/images/:id', async (req, res) => {
                try {
                    const response = await axios_1.default.get('https://mempool.space/api/v1/donations/images/' + req.params.id, { responseType: 'stream' });
                    response.data.pipe(res);
                }
                catch (e) {
                    res.status(500).end();
                }
            });
        }
        if (config_1.default.MEMPOOL.BACKEND !== 'esplora') {
            this.app
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'mempool', routes_1.default.getMempool)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'mempool/txids', routes_1.default.getMempoolTxIds)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'mempool/recent', routes_1.default.getRecentMempoolTransactions)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'tx/:txId', routes_1.default.getTransaction)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'tx/:txId/status', routes_1.default.getTransactionStatus)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'tx/:txId/outspends', routes_1.default.getTransactionOutspends)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'block/:hash', routes_1.default.getBlock)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'blocks/:height', routes_1.default.getBlocks)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'blocks/:height', routes_1.default.getBlocks)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'blocks/tip/height', routes_1.default.getBlockTipHeight)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'block/:hash/txs', routes_1.default.getBlockTransactions)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'block/:hash/txs/:index', routes_1.default.getBlockTransactions)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'block/:hash/txids', routes_1.default.getTxIdsForBlock)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'block-height/:height', routes_1.default.getBlockHeight)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'address/:address', routes_1.default.getAddress)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'address/:address/txs', routes_1.default.getAddressTransactions)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'address/:address/txs/chain/:txId', routes_1.default.getAddressTransactions)
                .get(config_1.default.MEMPOOL.API_URL_PREFIX + 'address-prefix/:prefix', routes_1.default.getAddressPrefix);
        }
    }
}
const server = new Server();
