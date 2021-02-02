"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const bitcoin_api_1 = require("./bitcoin-api");
const logger_1 = require("../../logger");
const ElectrumClient = require("@mempool/electrum-client");
const sha256 = require("crypto-js/sha256");
const hexEnc = require("crypto-js/enc-hex");
const loading_indicators_1 = require("../loading-indicators");
const memory_cache_1 = require("../memory-cache");
class BitcoindElectrsApi extends bitcoin_api_1.default {
    constructor() {
        super();
        const electrumConfig = { client: 'mempool-v2', version: '1.4' };
        const electrumPersistencePolicy = { retryPeriod: 10000, maxRetry: 1000, callback: null };
        const electrumCallbacks = {
            onConnect: (client, versionInfo) => { logger_1.default.info(`Connected to Electrum Server at ${config_1.default.ELECTRUM.HOST}:${config_1.default.ELECTRUM.PORT} (${JSON.stringify(versionInfo)})`); },
            onClose: (client) => { logger_1.default.info(`Disconnected from Electrum Server at ${config_1.default.ELECTRUM.HOST}:${config_1.default.ELECTRUM.PORT}`); },
            onError: (err) => { logger_1.default.err(`Electrum error: ${JSON.stringify(err)}`); },
            onLog: (str) => { logger_1.default.debug(str); },
        };
        this.electrumClient = new ElectrumClient(config_1.default.ELECTRUM.PORT, config_1.default.ELECTRUM.HOST, config_1.default.ELECTRUM.TLS_ENABLED ? 'tls' : 'tcp', null, electrumCallbacks);
        this.electrumClient.initElectrum(electrumConfig, electrumPersistencePolicy)
            .then(() => { })
            .catch((err) => {
            logger_1.default.err(`Error connecting to Electrum Server at ${config_1.default.ELECTRUM.HOST}:${config_1.default.ELECTRUM.PORT}`);
        });
    }
    async $getAddress(address) {
        const addressInfo = await this.$validateAddress(address);
        if (!addressInfo || !addressInfo.isvalid) {
            return ({
                'address': address,
                'chain_stats': {
                    'funded_txo_count': 0,
                    'funded_txo_sum': 0,
                    'spent_txo_count': 0,
                    'spent_txo_sum': 0,
                    'tx_count': 0
                },
                'mempool_stats': {
                    'funded_txo_count': 0,
                    'funded_txo_sum': 0,
                    'spent_txo_count': 0,
                    'spent_txo_sum': 0,
                    'tx_count': 0
                }
            });
        }
        try {
            const balance = await this.$getScriptHashBalance(addressInfo.scriptPubKey);
            const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
            const unconfirmed = history.filter((h) => h.fee).length;
            return {
                'address': addressInfo.address,
                'chain_stats': {
                    'funded_txo_count': 0,
                    'funded_txo_sum': balance.confirmed ? balance.confirmed : 0,
                    'spent_txo_count': 0,
                    'spent_txo_sum': balance.confirmed < 0 ? balance.confirmed : 0,
                    'tx_count': history.length - unconfirmed,
                },
                'mempool_stats': {
                    'funded_txo_count': 0,
                    'funded_txo_sum': balance.unconfirmed > 0 ? balance.unconfirmed : 0,
                    'spent_txo_count': 0,
                    'spent_txo_sum': balance.unconfirmed < 0 ? -balance.unconfirmed : 0,
                    'tx_count': unconfirmed,
                }
            };
        }
        catch (e) {
            if (e === 'failed to get confirmed status') {
                e = 'The number of transactions on this address exceeds the Electrum server limit';
            }
            throw new Error(e);
        }
    }
    async $getAddressTransactions(address, lastSeenTxId) {
        const addressInfo = await this.$validateAddress(address);
        if (!addressInfo || !addressInfo.isvalid) {
            return [];
        }
        try {
            loading_indicators_1.default.setProgress('address-' + address, 0);
            const transactions = [];
            const history = await this.$getScriptHashHistory(addressInfo.scriptPubKey);
            history.sort((a, b) => (b.height || 9999999) - (a.height || 9999999));
            let startingIndex = 0;
            if (lastSeenTxId) {
                const pos = history.findIndex((historicalTx) => historicalTx.tx_hash === lastSeenTxId);
                if (pos) {
                    startingIndex = pos + 1;
                }
            }
            const endIndex = Math.min(startingIndex + 10, history.length);
            for (let i = startingIndex; i < endIndex; i++) {
                const tx = await this.$getRawTransaction(history[i].tx_hash, false, true);
                transactions.push(tx);
                loading_indicators_1.default.setProgress('address-' + address, (i + 1) / endIndex * 100);
            }
            return transactions;
        }
        catch (e) {
            loading_indicators_1.default.setProgress('address-' + address, 100);
            if (e === 'failed to get confirmed status') {
                e = 'The number of transactions on this address exceeds the Electrum server limit';
            }
            throw new Error(e);
        }
    }
    $getScriptHashBalance(scriptHash) {
        return this.electrumClient.blockchainScripthash_getBalance(this.encodeScriptHash(scriptHash));
    }
    $getScriptHashHistory(scriptHash) {
        const fromCache = memory_cache_1.default.get('Scripthash_getHistory', scriptHash);
        if (fromCache) {
            return Promise.resolve(fromCache);
        }
        return this.electrumClient.blockchainScripthash_getHistory(this.encodeScriptHash(scriptHash))
            .then((history) => {
            memory_cache_1.default.set('Scripthash_getHistory', scriptHash, history, 2);
            return history;
        });
    }
    encodeScriptHash(scriptPubKey) {
        const addrScripthash = hexEnc.stringify(sha256(hexEnc.parse(scriptPubKey)));
        return addrScripthash.match(/.{2}/g).reverse().join('');
    }
}
exports.default = BitcoindElectrsApi;
