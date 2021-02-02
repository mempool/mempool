"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const WebSocket = require("ws");
const blocks_1 = require("./blocks");
const mempool_1 = require("./mempool");
const backend_info_1 = require("./backend-info");
const mempool_blocks_1 = require("./mempool-blocks");
const fiat_conversion_1 = require("./fiat-conversion");
const common_1 = require("./common");
const loading_indicators_1 = require("./loading-indicators");
const config_1 = require("../config");
const transaction_utils_1 = require("./transaction-utils");
class WebsocketHandler {
    constructor() {
        this.nativeAssetId = '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d';
        this.extraInitProperties = {};
    }
    setWebsocketServer(wss) {
        this.wss = wss;
    }
    setExtraInitProperties(property, value) {
        this.extraInitProperties[property] = value;
    }
    setupConnectionHandling() {
        if (!this.wss) {
            throw new Error('WebSocket.Server is not set');
        }
        this.wss.on('connection', (client) => {
            client.on('error', logger_1.default.info);
            client.on('message', (message) => {
                try {
                    const parsedMessage = JSON.parse(message);
                    const response = {};
                    if (parsedMessage.action === 'want') {
                        client['want-blocks'] = parsedMessage.data.indexOf('blocks') > -1;
                        client['want-mempool-blocks'] = parsedMessage.data.indexOf('mempool-blocks') > -1;
                        client['want-live-2h-chart'] = parsedMessage.data.indexOf('live-2h-chart') > -1;
                        client['want-stats'] = parsedMessage.data.indexOf('stats') > -1;
                    }
                    if (parsedMessage && parsedMessage['track-tx']) {
                        if (/^[a-fA-F0-9]{64}$/.test(parsedMessage['track-tx'])) {
                            client['track-tx'] = parsedMessage['track-tx'];
                            // Client is telling the transaction wasn't found but it might have appeared before we had the time to start watching for it
                            if (parsedMessage['watch-mempool']) {
                                const tx = mempool_1.default.getMempool()[client['track-tx']];
                                if (tx) {
                                    response['tx'] = tx;
                                }
                                else {
                                    client['track-mempool-tx'] = parsedMessage['track-tx'];
                                }
                            }
                        }
                        else {
                            client['track-tx'] = null;
                        }
                    }
                    if (parsedMessage && parsedMessage['track-address']) {
                        if (/^([a-km-zA-HJ-NP-Z1-9]{26,35}|[a-km-zA-HJ-NP-Z1-9]{80}|[a-z]{2,5}1[ac-hj-np-z02-9]{8,87})$/
                            .test(parsedMessage['track-address'])) {
                            client['track-address'] = parsedMessage['track-address'];
                        }
                        else {
                            client['track-address'] = null;
                        }
                    }
                    if (parsedMessage && parsedMessage['track-asset']) {
                        if (/^[a-fA-F0-9]{64}$/.test(parsedMessage['track-asset'])) {
                            client['track-asset'] = parsedMessage['track-asset'];
                        }
                        else {
                            client['track-asset'] = null;
                        }
                    }
                    if (parsedMessage.action === 'init') {
                        const _blocks = blocks_1.default.getBlocks().slice(-8);
                        if (!_blocks) {
                            return;
                        }
                        client.send(JSON.stringify(this.getInitData(_blocks)));
                    }
                    if (parsedMessage.action === 'ping') {
                        response['pong'] = true;
                    }
                    if (parsedMessage['track-donation'] && parsedMessage['track-donation'].length === 22) {
                        client['track-donation'] = parsedMessage['track-donation'];
                    }
                    if (Object.keys(response).length) {
                        client.send(JSON.stringify(response));
                    }
                }
                catch (e) {
                    logger_1.default.debug('Error parsing websocket message: ' + e.message || e);
                }
            });
        });
    }
    handleNewDonation(id) {
        if (!this.wss) {
            throw new Error('WebSocket.Server is not set');
        }
        this.wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.OPEN) {
                return;
            }
            if (client['track-donation'] === id) {
                client.send(JSON.stringify({ donationConfirmed: true }));
            }
        });
    }
    handleLoadingChanged(indicators) {
        if (!this.wss) {
            throw new Error('WebSocket.Server is not set');
        }
        this.wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.OPEN) {
                return;
            }
            client.send(JSON.stringify({ loadingIndicators: indicators }));
        });
    }
    handleNewConversionRates(conversionRates) {
        if (!this.wss) {
            throw new Error('WebSocket.Server is not set');
        }
        this.wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.OPEN) {
                return;
            }
            client.send(JSON.stringify({ conversions: conversionRates }));
        });
    }
    getInitData(_blocks) {
        if (!_blocks) {
            _blocks = blocks_1.default.getBlocks().slice(-8);
        }
        return {
            'mempoolInfo': mempool_1.default.getMempoolInfo(),
            'vBytesPerSecond': mempool_1.default.getVBytesPerSecond(),
            'lastDifficultyAdjustment': blocks_1.default.getLastDifficultyAdjustmentTime(),
            'blocks': _blocks,
            'conversions': fiat_conversion_1.default.getConversionRates(),
            'mempool-blocks': mempool_blocks_1.default.getMempoolBlocks(),
            'transactions': mempool_1.default.getLatestTransactions(),
            'git-commit': backend_info_1.default.gitCommitHash,
            'hostname': backend_info_1.default.hostname,
            'loadingIndicators': loading_indicators_1.default.getLoadingIndicators(),
            ...this.extraInitProperties
        };
    }
    handleNewStatistic(stats) {
        if (!this.wss) {
            throw new Error('WebSocket.Server is not set');
        }
        this.wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.OPEN) {
                return;
            }
            if (!client['want-live-2h-chart']) {
                return;
            }
            client.send(JSON.stringify({
                'live-2h-chart': stats
            }));
        });
    }
    handleMempoolChange(newMempool, newTransactions, deletedTransactions) {
        if (!this.wss) {
            throw new Error('WebSocket.Server is not set');
        }
        mempool_blocks_1.default.updateMempoolBlocks(newMempool);
        const mBlocks = mempool_blocks_1.default.getMempoolBlocks();
        const mempoolInfo = mempool_1.default.getMempoolInfo();
        const vBytesPerSecond = mempool_1.default.getVBytesPerSecond();
        const rbfTransactions = common_1.Common.findRbfTransactions(newTransactions, deletedTransactions);
        this.wss.clients.forEach(async (client) => {
            if (client.readyState !== WebSocket.OPEN) {
                return;
            }
            const response = {};
            if (client['want-stats']) {
                response['mempoolInfo'] = mempoolInfo;
                response['vBytesPerSecond'] = vBytesPerSecond;
                response['transactions'] = newTransactions.slice(0, 6).map((tx) => common_1.Common.stripTransaction(tx));
            }
            if (client['want-mempool-blocks']) {
                response['mempool-blocks'] = mBlocks;
            }
            if (client['track-mempool-tx']) {
                const tx = newTransactions.find((t) => t.txid === client['track-mempool-tx']);
                if (tx) {
                    if (config_1.default.MEMPOOL.BACKEND !== 'esplora') {
                        try {
                            const fullTx = await transaction_utils_1.default.$getTransactionExtended(tx.txid, true);
                            response['tx'] = fullTx;
                        }
                        catch (e) {
                            logger_1.default.debug('Error finding transaction in mempool: ' + e.message || e);
                        }
                    }
                    else {
                        response['tx'] = tx;
                    }
                    client['track-mempool-tx'] = null;
                }
            }
            if (client['track-address']) {
                const foundTransactions = [];
                for (const tx of newTransactions) {
                    const someVin = tx.vin.some((vin) => !!vin.prevout && vin.prevout.scriptpubkey_address === client['track-address']);
                    if (someVin) {
                        if (config_1.default.MEMPOOL.BACKEND !== 'esplora') {
                            try {
                                const fullTx = await transaction_utils_1.default.$getTransactionExtended(tx.txid, true);
                                foundTransactions.push(fullTx);
                            }
                            catch (e) {
                                logger_1.default.debug('Error finding transaction in mempool: ' + e.message || e);
                            }
                        }
                        else {
                            foundTransactions.push(tx);
                        }
                        return;
                    }
                    const someVout = tx.vout.some((vout) => vout.scriptpubkey_address === client['track-address']);
                    if (someVout) {
                        if (config_1.default.MEMPOOL.BACKEND !== 'esplora') {
                            try {
                                const fullTx = await transaction_utils_1.default.$getTransactionExtended(tx.txid, true);
                                foundTransactions.push(fullTx);
                            }
                            catch (e) {
                                logger_1.default.debug('Error finding transaction in mempool: ' + e.message || e);
                            }
                        }
                        else {
                            foundTransactions.push(tx);
                        }
                    }
                }
                if (foundTransactions.length) {
                    response['address-transactions'] = foundTransactions;
                }
            }
            if (client['track-asset']) {
                const foundTransactions = [];
                newTransactions.forEach((tx) => {
                    if (client['track-asset'] === this.nativeAssetId) {
                        if (tx.vin.some((vin) => !!vin.is_pegin)) {
                            foundTransactions.push(tx);
                            return;
                        }
                        if (tx.vout.some((vout) => !!vout.pegout)) {
                            foundTransactions.push(tx);
                        }
                    }
                    else {
                        if (tx.vin.some((vin) => !!vin.issuance && vin.issuance.asset_id === client['track-asset'])) {
                            foundTransactions.push(tx);
                            return;
                        }
                        if (tx.vout.some((vout) => !!vout.asset && vout.asset === client['track-asset'])) {
                            foundTransactions.push(tx);
                        }
                    }
                });
                if (foundTransactions.length) {
                    response['address-transactions'] = foundTransactions;
                }
            }
            if (client['track-tx'] && rbfTransactions[client['track-tx']]) {
                for (const rbfTransaction in rbfTransactions) {
                    if (client['track-tx'] === rbfTransaction) {
                        const rbfTx = rbfTransactions[rbfTransaction];
                        if (config_1.default.MEMPOOL.BACKEND !== 'esplora') {
                            try {
                                const fullTx = await transaction_utils_1.default.$getTransactionExtended(rbfTransaction, true);
                                response['rbfTransaction'] = fullTx;
                            }
                            catch (e) {
                                logger_1.default.debug('Error finding transaction in mempool: ' + e.message || e);
                            }
                        }
                        else {
                            response['rbfTransaction'] = rbfTx;
                        }
                        break;
                    }
                }
            }
            if (Object.keys(response).length) {
                client.send(JSON.stringify(response));
            }
        });
    }
    handleNewBlock(block, txIds, transactions) {
        if (!this.wss) {
            throw new Error('WebSocket.Server is not set');
        }
        // Check how many transactions in the new block matches the latest projected mempool block
        // If it's more than 0, recalculate the mempool blocks and send to client in the same update
        let mBlocks;
        let matchRate = 0;
        const _mempoolBlocks = mempool_blocks_1.default.getMempoolBlocksWithTransactions();
        if (_mempoolBlocks[0]) {
            const matches = [];
            for (const txId of txIds) {
                if (_mempoolBlocks[0].transactionIds.indexOf(txId) > -1) {
                    matches.push(txId);
                }
            }
            matchRate = Math.round((matches.length / (txIds.length - 1)) * 100);
            if (matchRate > 0) {
                const currentMemPool = mempool_1.default.getMempool();
                for (const txId of matches) {
                    delete currentMemPool[txId];
                }
                mempool_blocks_1.default.updateMempoolBlocks(currentMemPool);
                mBlocks = mempool_blocks_1.default.getMempoolBlocks();
            }
        }
        block.matchRate = matchRate;
        this.wss.clients.forEach((client) => {
            if (client.readyState !== WebSocket.OPEN) {
                return;
            }
            if (!client['want-blocks']) {
                return;
            }
            const response = {
                'block': block,
                'mempoolInfo': mempool_1.default.getMempoolInfo(),
                'lastDifficultyAdjustment': blocks_1.default.getLastDifficultyAdjustmentTime(),
            };
            if (mBlocks && client['want-mempool-blocks']) {
                response['mempool-blocks'] = mBlocks;
            }
            if (client['track-tx'] && txIds.indexOf(client['track-tx']) > -1) {
                client['track-tx'] = null;
                response['txConfirmed'] = true;
            }
            if (client['track-address']) {
                const foundTransactions = [];
                transactions.forEach((tx) => {
                    if (tx.vin && tx.vin.some((vin) => !!vin.prevout && vin.prevout.scriptpubkey_address === client['track-address'])) {
                        foundTransactions.push(tx);
                        return;
                    }
                    if (tx.vout && tx.vout.some((vout) => vout.scriptpubkey_address === client['track-address'])) {
                        foundTransactions.push(tx);
                    }
                });
                if (foundTransactions.length) {
                    foundTransactions.forEach((tx) => {
                        tx.status = {
                            confirmed: true,
                            block_height: block.height,
                            block_hash: block.id,
                            block_time: block.timestamp,
                        };
                    });
                    response['block-transactions'] = foundTransactions;
                }
            }
            if (client['track-asset']) {
                const foundTransactions = [];
                transactions.forEach((tx) => {
                    if (client['track-asset'] === this.nativeAssetId) {
                        if (tx.vin && tx.vin.some((vin) => !!vin.is_pegin)) {
                            foundTransactions.push(tx);
                            return;
                        }
                        if (tx.vout && tx.vout.some((vout) => !!vout.pegout)) {
                            foundTransactions.push(tx);
                        }
                    }
                    else {
                        if (tx.vin && tx.vin.some((vin) => !!vin.issuance && vin.issuance.asset_id === client['track-asset'])) {
                            foundTransactions.push(tx);
                            return;
                        }
                        if (tx.vout && tx.vout.some((vout) => !!vout.asset && vout.asset === client['track-asset'])) {
                            foundTransactions.push(tx);
                        }
                    }
                });
                if (foundTransactions.length) {
                    foundTransactions.forEach((tx) => {
                        tx.status = {
                            confirmed: true,
                            block_height: block.height,
                            block_hash: block.id,
                            block_time: block.timestamp,
                        };
                    });
                    response['block-transactions'] = foundTransactions;
                }
            }
            client.send(JSON.stringify(response));
        });
    }
}
exports.default = new WebsocketHandler();
