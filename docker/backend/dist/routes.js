"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const statistics_1 = require("./api/statistics");
const fee_api_1 = require("./api/fee-api");
const backend_info_1 = require("./api/backend-info");
const mempool_blocks_1 = require("./api/mempool-blocks");
const mempool_1 = require("./api/mempool");
const bisq_1 = require("./api/bisq/bisq");
const websocket_handler_1 = require("./api/websocket-handler");
const markets_api_1 = require("./api/bisq/markets-api");
const donations_1 = require("./api/donations");
const logger_1 = require("./logger");
const bitcoin_api_factory_1 = require("./api/bitcoin/bitcoin-api-factory");
const transaction_utils_1 = require("./api/transaction-utils");
const blocks_1 = require("./api/blocks");
const loading_indicators_1 = require("./api/loading-indicators");
const common_1 = require("./api/common");
class Routes {
    constructor() {
        this.cache = {
            '24h': [], '1w': [], '1m': [], '3m': [], '6m': [], '1y': [],
        };
        if (config_1.default.DATABASE.ENABLED && config_1.default.STATISTICS.ENABLED) {
            this.createCache();
            setInterval(this.createCache.bind(this), 600000);
        }
    }
    async createCache() {
        this.cache['24h'] = await statistics_1.default.$list24H();
        this.cache['1w'] = await statistics_1.default.$list1W();
        this.cache['1m'] = await statistics_1.default.$list1M();
        this.cache['3m'] = await statistics_1.default.$list3M();
        this.cache['6m'] = await statistics_1.default.$list6M();
        this.cache['1y'] = await statistics_1.default.$list1Y();
        logger_1.default.debug('Statistics cache created');
    }
    async get2HStatistics(req, res) {
        const result = await statistics_1.default.$list2H();
        res.json(result);
    }
    get24HStatistics(req, res) {
        res.json(this.cache['24h']);
    }
    get1WHStatistics(req, res) {
        res.json(this.cache['1w']);
    }
    get1MStatistics(req, res) {
        res.json(this.cache['1m']);
    }
    get3MStatistics(req, res) {
        res.json(this.cache['3m']);
    }
    get6MStatistics(req, res) {
        res.json(this.cache['6m']);
    }
    get1YStatistics(req, res) {
        res.json(this.cache['1y']);
    }
    getInitData(req, res) {
        try {
            const result = websocket_handler_1.default.getInitData();
            res.json(result);
        }
        catch (e) {
            res.status(500).send(e.message);
        }
    }
    async getRecommendedFees(req, res) {
        if (!mempool_1.default.isInSync()) {
            res.statusCode = 503;
            res.send('Service Unavailable');
            return;
        }
        const result = fee_api_1.default.getRecommendedFee();
        res.json(result);
    }
    getMempoolBlocks(req, res) {
        try {
            const result = mempool_blocks_1.default.getMempoolBlocks();
            res.json(result);
        }
        catch (e) {
            res.status(500).send(e.message);
        }
    }
    getTransactionTimes(req, res) {
        if (!Array.isArray(req.query.txId)) {
            res.status(500).send('Not an array');
            return;
        }
        const txIds = [];
        for (const _txId in req.query.txId) {
            if (typeof req.query.txId[_txId] === 'string') {
                txIds.push(req.query.txId[_txId].toString());
            }
        }
        const times = mempool_1.default.getFirstSeenForTransactions(txIds);
        res.json(times);
    }
    getBackendInfo(req, res) {
        res.json(backend_info_1.default.getBackendInfo());
    }
    async createDonationRequest(req, res) {
        const constraints = {
            'amount': {
                required: true,
                types: ['@float']
            },
            'orderId': {
                required: true,
                types: ['@string']
            }
        };
        const p = this.parseRequestParameters(req.body, constraints);
        if (p.error) {
            res.status(400).send(p.error);
            return;
        }
        if (p.orderId !== '' && !/^(@|)[a-zA-Z0-9_]{1,15}$/.test(p.orderId)) {
            res.status(400).send('Invalid Twitter handle');
            return;
        }
        if (p.amount < 0.001) {
            res.status(400).send('Amount needs to be at least 0.001');
            return;
        }
        if (p.amount > 1000) {
            res.status(400).send('Amount too large');
            return;
        }
        try {
            const result = await donations_1.default.$createRequest(p.amount, p.orderId);
            res.json(result);
        }
        catch (e) {
            res.status(500).send(e.message);
        }
    }
    async getDonations(req, res) {
        try {
            const result = await donations_1.default.$getDonationsFromDatabase('handle, imageUrl');
            res.json(result);
        }
        catch (e) {
            res.status(500).send(e.message);
        }
    }
    async getSponsorImage(req, res) {
        try {
            const result = await donations_1.default.getSponsorImage(req.params.id);
            if (result) {
                res.set('Content-Type', 'image/jpeg');
                res.send(result);
            }
            else {
                res.status(404).end();
            }
        }
        catch (e) {
            res.status(500).send(e.message);
        }
    }
    async donationWebhook(req, res) {
        try {
            donations_1.default.$handleWebhookRequest(req.body);
            res.end();
        }
        catch (e) {
            res.status(500).send(e);
        }
    }
    getBisqStats(req, res) {
        const result = bisq_1.default.getStats();
        res.json(result);
    }
    getBisqTip(req, res) {
        const result = bisq_1.default.getLatestBlockHeight();
        res.type('text/plain');
        res.send(result.toString());
    }
    getBisqTransaction(req, res) {
        const result = bisq_1.default.getTransaction(req.params.txId);
        if (result) {
            res.json(result);
        }
        else {
            res.status(404).send('Bisq transaction not found');
        }
    }
    getBisqTransactions(req, res) {
        const types = [];
        req.query.types = req.query.types || [];
        if (!Array.isArray(req.query.types)) {
            res.status(500).send('Types is not an array');
            return;
        }
        for (const _type in req.query.types) {
            if (typeof req.query.types[_type] === 'string') {
                types.push(req.query.types[_type].toString());
            }
        }
        const index = parseInt(req.params.index, 10) || 0;
        const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
        const [transactions, count] = bisq_1.default.getTransactions(index, length, types);
        res.header('X-Total-Count', count.toString());
        res.json(transactions);
    }
    getBisqBlock(req, res) {
        const result = bisq_1.default.getBlock(req.params.hash);
        if (result) {
            res.json(result);
        }
        else {
            res.status(404).send('Bisq block not found');
        }
    }
    getBisqBlocks(req, res) {
        const index = parseInt(req.params.index, 10) || 0;
        const length = parseInt(req.params.length, 10) > 100 ? 100 : parseInt(req.params.length, 10) || 25;
        const [transactions, count] = bisq_1.default.getBlocks(index, length);
        res.header('X-Total-Count', count.toString());
        res.json(transactions);
    }
    getBisqAddress(req, res) {
        const result = bisq_1.default.getAddress(req.params.address.substr(1));
        if (result) {
            res.json(result);
        }
        else {
            res.status(404).send('Bisq address not found');
        }
    }
    getBisqMarketCurrencies(req, res) {
        const constraints = {
            'type': {
                required: false,
                types: ['crypto', 'fiat', 'all']
            },
        };
        const p = this.parseRequestParameters(req.query, constraints);
        if (p.error) {
            res.status(400).json(this.getBisqMarketErrorResponse(p.error));
            return;
        }
        const result = markets_api_1.default.getCurrencies(p.type);
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketCurrencies error'));
        }
    }
    getBisqMarketDepth(req, res) {
        const constraints = {
            'market': {
                required: true,
                types: ['@string']
            },
        };
        const p = this.parseRequestParameters(req.query, constraints);
        if (p.error) {
            res.status(400).json(this.getBisqMarketErrorResponse(p.error));
            return;
        }
        const result = markets_api_1.default.getDepth(p.market);
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketDepth error'));
        }
    }
    getBisqMarketMarkets(req, res) {
        const result = markets_api_1.default.getMarkets();
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketMarkets error'));
        }
    }
    getBisqMarketTrades(req, res) {
        const constraints = {
            'market': {
                required: true,
                types: ['@string']
            },
            'timestamp_from': {
                required: false,
                types: ['@number']
            },
            'timestamp_to': {
                required: false,
                types: ['@number']
            },
            'trade_id_to': {
                required: false,
                types: ['@string']
            },
            'trade_id_from': {
                required: false,
                types: ['@string']
            },
            'direction': {
                required: false,
                types: ['buy', 'sell']
            },
            'limit': {
                required: false,
                types: ['@number']
            },
            'sort': {
                required: false,
                types: ['asc', 'desc']
            }
        };
        const p = this.parseRequestParameters(req.query, constraints);
        if (p.error) {
            res.status(400).json(this.getBisqMarketErrorResponse(p.error));
            return;
        }
        const result = markets_api_1.default.getTrades(p.market, p.timestamp_from, p.timestamp_to, p.trade_id_from, p.trade_id_to, p.direction, p.limit, p.sort);
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTrades error'));
        }
    }
    getBisqMarketOffers(req, res) {
        const constraints = {
            'market': {
                required: true,
                types: ['@string']
            },
            'direction': {
                required: false,
                types: ['buy', 'sell']
            },
        };
        const p = this.parseRequestParameters(req.query, constraints);
        if (p.error) {
            res.status(400).json(this.getBisqMarketErrorResponse(p.error));
            return;
        }
        const result = markets_api_1.default.getOffers(p.market, p.direction);
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketOffers error'));
        }
    }
    getBisqMarketVolumes(req, res) {
        const constraints = {
            'market': {
                required: false,
                types: ['@string']
            },
            'interval': {
                required: false,
                types: ['minute', 'half_hour', 'hour', 'half_day', 'day', 'week', 'month', 'year', 'auto']
            },
            'timestamp_from': {
                required: false,
                types: ['@number']
            },
            'timestamp_to': {
                required: false,
                types: ['@number']
            },
            'milliseconds': {
                required: false,
                types: ['@boolean']
            },
            'timestamp': {
                required: false,
                types: ['no', 'yes']
            },
        };
        const p = this.parseRequestParameters(req.query, constraints);
        if (p.error) {
            res.status(400).json(this.getBisqMarketErrorResponse(p.error));
            return;
        }
        const result = markets_api_1.default.getVolumes(p.market, p.timestamp_from, p.timestamp_to, p.interval, p.milliseconds, p.timestamp);
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketVolumes error'));
        }
    }
    getBisqMarketHloc(req, res) {
        const constraints = {
            'market': {
                required: true,
                types: ['@string']
            },
            'interval': {
                required: false,
                types: ['minute', 'half_hour', 'hour', 'half_day', 'day', 'week', 'month', 'year', 'auto']
            },
            'timestamp_from': {
                required: false,
                types: ['@number']
            },
            'timestamp_to': {
                required: false,
                types: ['@number']
            },
            'milliseconds': {
                required: false,
                types: ['@boolean']
            },
            'timestamp': {
                required: false,
                types: ['no', 'yes']
            },
        };
        const p = this.parseRequestParameters(req.query, constraints);
        if (p.error) {
            res.status(400).json(this.getBisqMarketErrorResponse(p.error));
            return;
        }
        const result = markets_api_1.default.getHloc(p.market, p.interval, p.timestamp_from, p.timestamp_to, p.milliseconds, p.timestamp);
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketHloc error'));
        }
    }
    getBisqMarketTicker(req, res) {
        const constraints = {
            'market': {
                required: false,
                types: ['@string']
            },
        };
        const p = this.parseRequestParameters(req.query, constraints);
        if (p.error) {
            res.status(400).json(this.getBisqMarketErrorResponse(p.error));
            return;
        }
        const result = markets_api_1.default.getTicker(p.market);
        if (result) {
            res.json(result);
        }
        else {
            res.status(500).json(this.getBisqMarketErrorResponse('getBisqMarketTicker error'));
        }
    }
    parseRequestParameters(requestParams, params) {
        const final = {};
        for (const i in params) {
            if (params.hasOwnProperty(i)) {
                if (params[i].required && requestParams[i] === undefined) {
                    return { error: i + ' parameter missing' };
                }
                if (typeof requestParams[i] === 'string') {
                    const str = (requestParams[i] || '').toString().toLowerCase();
                    if (params[i].types.indexOf('@number') > -1) {
                        const number = parseInt((str).toString(), 10);
                        final[i] = number;
                    }
                    else if (params[i].types.indexOf('@string') > -1) {
                        final[i] = str;
                    }
                    else if (params[i].types.indexOf('@boolean') > -1) {
                        final[i] = str === 'true' || str === 'yes';
                    }
                    else if (params[i].types.indexOf(str) > -1) {
                        final[i] = str;
                    }
                    else {
                        return { error: i + ' parameter invalid' };
                    }
                }
                else if (typeof requestParams[i] === 'number') {
                    final[i] = requestParams[i];
                }
            }
        }
        return final;
    }
    getBisqMarketErrorResponse(message) {
        return {
            'success': 0,
            'error': message
        };
    }
    async getTransaction(req, res) {
        try {
            const transaction = await transaction_utils_1.default.$getTransactionExtended(req.params.txId, true);
            res.json(transaction);
        }
        catch (e) {
            let statusCode = 500;
            if (e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
                statusCode = 404;
            }
            res.status(statusCode).send(e.message || e);
        }
    }
    async getTransactionStatus(req, res) {
        try {
            const transaction = await transaction_utils_1.default.$getTransactionExtended(req.params.txId, true);
            res.json(transaction.status);
        }
        catch (e) {
            let statusCode = 500;
            if (e.message && e.message.indexOf('No such mempool or blockchain transaction') > -1) {
                statusCode = 404;
            }
            res.status(statusCode).send(e.message || e);
        }
    }
    async getBlock(req, res) {
        try {
            const result = await bitcoin_api_factory_1.default.$getBlock(req.params.hash);
            res.json(result);
        }
        catch (e) {
            res.status(500).send(e.message || e);
        }
    }
    async getBlocks(req, res) {
        try {
            loading_indicators_1.default.setProgress('blocks', 0);
            const returnBlocks = [];
            const fromHeight = parseInt(req.params.height, 10) || blocks_1.default.getCurrentBlockHeight();
            // Check if block height exist in local cache to skip the hash lookup
            const blockByHeight = blocks_1.default.getBlocks().find((b) => b.height === fromHeight);
            let startFromHash = null;
            if (blockByHeight) {
                startFromHash = blockByHeight.id;
            }
            else {
                startFromHash = await bitcoin_api_factory_1.default.$getBlockHash(fromHeight);
            }
            let nextHash = startFromHash;
            for (let i = 0; i < 10; i++) {
                const localBlock = blocks_1.default.getBlocks().find((b) => b.id === nextHash);
                if (localBlock) {
                    returnBlocks.push(localBlock);
                    nextHash = localBlock.previousblockhash;
                }
                else {
                    const block = await bitcoin_api_factory_1.default.$getBlock(nextHash);
                    returnBlocks.push(block);
                    nextHash = block.previousblockhash;
                }
                loading_indicators_1.default.setProgress('blocks', i / 10 * 100);
            }
            res.json(returnBlocks);
        }
        catch (e) {
            loading_indicators_1.default.setProgress('blocks', 100);
            res.status(500).send(e.message || e);
        }
    }
    async getBlockTransactions(req, res) {
        try {
            loading_indicators_1.default.setProgress('blocktxs-' + req.params.hash, 0);
            const txIds = await bitcoin_api_factory_1.default.$getTxIdsForBlock(req.params.hash);
            const transactions = [];
            const startingIndex = Math.max(0, parseInt(req.params.index || '0', 10));
            const endIndex = Math.min(startingIndex + 10, txIds.length);
            for (let i = startingIndex; i < endIndex; i++) {
                try {
                    const transaction = await transaction_utils_1.default.$getTransactionExtended(txIds[i], true);
                    transactions.push(transaction);
                    loading_indicators_1.default.setProgress('blocktxs-' + req.params.hash, (i + 1) / endIndex * 100);
                }
                catch (e) {
                    logger_1.default.debug('getBlockTransactions error: ' + e.message || e);
                }
            }
            res.json(transactions);
        }
        catch (e) {
            loading_indicators_1.default.setProgress('blocktxs-' + req.params.hash, 100);
            res.status(500).send(e.message || e);
        }
    }
    async getBlockHeight(req, res) {
        try {
            const blockHash = await bitcoin_api_factory_1.default.$getBlockHash(parseInt(req.params.height, 10));
            res.send(blockHash);
        }
        catch (e) {
            res.status(500).send(e.message || e);
        }
    }
    async getAddress(req, res) {
        if (config_1.default.MEMPOOL.BACKEND === 'none') {
            res.status(405).send('Address lookups cannot be used with bitcoind as backend.');
            return;
        }
        try {
            const addressData = await bitcoin_api_factory_1.default.$getAddress(req.params.address);
            res.json(addressData);
        }
        catch (e) {
            if (e.message && e.message.indexOf('exceeds') > 0) {
                return res.status(413).send(e.message);
            }
            res.status(500).send(e.message || e);
        }
    }
    async getAddressTransactions(req, res) {
        if (config_1.default.MEMPOOL.BACKEND === 'none') {
            res.status(405).send('Address lookups cannot be used with bitcoind as backend.');
            return;
        }
        try {
            const transactions = await bitcoin_api_factory_1.default.$getAddressTransactions(req.params.address, req.params.txId);
            res.json(transactions);
        }
        catch (e) {
            if (e.message && e.message.indexOf('exceeds') > 0) {
                return res.status(413).send(e.message);
            }
            res.status(500).send(e.message || e);
        }
    }
    async getAdressTxChain(req, res) {
        res.status(501).send('Not implemented');
    }
    async getAddressPrefix(req, res) {
        try {
            const blockHash = await bitcoin_api_factory_1.default.$getAddressPrefix(req.params.prefix);
            res.send(blockHash);
        }
        catch (e) {
            res.status(500).send(e.message || e);
        }
    }
    async getRecentMempoolTransactions(req, res) {
        const latestTransactions = Object.entries(mempool_1.default.getMempool())
            .sort((a, b) => (b[1].firstSeen || 0) - (a[1].firstSeen || 0))
            .slice(0, 10).map((tx) => common_1.Common.stripTransaction(tx[1]));
        res.json(latestTransactions);
    }
    async getMempool(req, res) {
        res.status(501).send('Not implemented');
    }
    async getMempoolTxIds(req, res) {
        try {
            const rawMempool = await bitcoin_api_factory_1.default.$getRawMempool();
            res.send(rawMempool);
        }
        catch (e) {
            res.status(500).send(e.message || e);
        }
    }
    async getBlockTipHeight(req, res) {
        try {
            const result = await bitcoin_api_factory_1.default.$getBlockHeightTip();
            res.json(result);
        }
        catch (e) {
            res.status(500).send(e.message || e);
        }
    }
    async getTxIdsForBlock(req, res) {
        try {
            const result = await bitcoin_api_factory_1.default.$getTxIdsForBlock(req.params.hash);
            res.json(result);
        }
        catch (e) {
            res.status(500).send(e.message || e);
        }
    }
    getTransactionOutspends(req, res) {
        res.status(501).send('Not implemented');
    }
}
exports.default = new Routes();
