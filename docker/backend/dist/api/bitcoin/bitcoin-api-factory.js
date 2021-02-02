"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const esplora_api_1 = require("./esplora-api");
const bitcoin_api_1 = require("./bitcoin-api");
const electrum_api_1 = require("./electrum-api");
function bitcoinApiFactory() {
    switch (config_1.default.MEMPOOL.BACKEND) {
        case 'esplora':
            return new esplora_api_1.default();
        case 'electrum':
            return new electrum_api_1.default();
        case 'none':
        default:
            return new bitcoin_api_1.default();
    }
}
exports.default = bitcoinApiFactory();
