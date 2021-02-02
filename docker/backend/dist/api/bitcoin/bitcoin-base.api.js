"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const bitcoin = require("@mempool/bitcoin");
class BitcoinBaseApi {
    constructor() {
        this.bitcoindClient = new bitcoin.Client({
            host: config_1.default.CORE_RPC.HOST,
            port: config_1.default.CORE_RPC.PORT,
            user: config_1.default.CORE_RPC.USERNAME,
            pass: config_1.default.CORE_RPC.PASSWORD,
            timeout: 60000,
        });
        if (config_1.default.CORE_RPC_MINFEE.ENABLED) {
            this.bitcoindClientMempoolInfo = new bitcoin.Client({
                host: config_1.default.CORE_RPC_MINFEE.HOST,
                port: config_1.default.CORE_RPC_MINFEE.PORT,
                user: config_1.default.CORE_RPC_MINFEE.USERNAME,
                pass: config_1.default.CORE_RPC_MINFEE.PASSWORD,
                timeout: 60000,
            });
        }
    }
    $getMempoolInfo() {
        if (config_1.default.CORE_RPC_MINFEE.ENABLED) {
            return Promise.all([
                this.bitcoindClient.getMempoolInfo(),
                this.bitcoindClientMempoolInfo.getMempoolInfo()
            ]).then(([mempoolInfo, secondMempoolInfo]) => {
                mempoolInfo.maxmempool = secondMempoolInfo.maxmempool;
                mempoolInfo.mempoolminfee = secondMempoolInfo.mempoolminfee;
                mempoolInfo.minrelaytxfee = secondMempoolInfo.minrelaytxfee;
                return mempoolInfo;
            });
        }
        return this.bitcoindClient.getMempoolInfo();
    }
}
exports.default = new BitcoinBaseApi();
