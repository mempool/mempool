"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const axios_1 = require("axios");
class ElectrsApi {
    constructor() { }
    $getRawMempool() {
        return axios_1.default.get(config_1.default.ESPLORA.REST_API_URL + '/mempool/txids')
            .then((response) => response.data);
    }
    $getRawTransaction(txId) {
        return axios_1.default.get(config_1.default.ESPLORA.REST_API_URL + '/tx/' + txId)
            .then((response) => response.data);
    }
    $getBlockHeightTip() {
        return axios_1.default.get(config_1.default.ESPLORA.REST_API_URL + '/blocks/tip/height')
            .then((response) => response.data);
    }
    $getTxIdsForBlock(hash) {
        return axios_1.default.get(config_1.default.ESPLORA.REST_API_URL + '/block/' + hash + '/txids')
            .then((response) => response.data);
    }
    $getBlockHash(height) {
        return axios_1.default.get(config_1.default.ESPLORA.REST_API_URL + '/block-height/' + height)
            .then((response) => response.data);
    }
    $getBlock(hash) {
        return axios_1.default.get(config_1.default.ESPLORA.REST_API_URL + '/block/' + hash)
            .then((response) => response.data);
    }
    $getAddress(address) {
        throw new Error('Method getAddress not implemented.');
    }
    $getAddressTransactions(address, txId) {
        throw new Error('Method getAddressTransactions not implemented.');
    }
    $getRawTransactionBitcoind(txId) {
        return axios_1.default.get(config_1.default.ESPLORA.REST_API_URL + '/tx/' + txId)
            .then((response) => response.data);
    }
    $getAddressPrefix(prefix) {
        throw new Error('Method not implemented.');
    }
}
exports.default = ElectrsApi;
