"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bitcoin_api_factory_1 = require("./bitcoin/bitcoin-api-factory");
class TransactionUtils {
    constructor() { }
    stripCoinbaseTransaction(tx) {
        return {
            vin: [{
                    scriptsig: tx.vin[0].scriptsig || tx.vin[0]['coinbase']
                }],
            vout: tx.vout
                .map((vout) => ({
                scriptpubkey_address: vout.scriptpubkey_address,
                value: vout.value
            }))
                .filter((vout) => vout.value)
        };
    }
    async $getTransactionExtended(txId, addPrevouts = false) {
        const transaction = await bitcoin_api_factory_1.default.$getRawTransaction(txId, false, addPrevouts);
        return this.extendTransaction(transaction);
    }
    extendTransaction(transaction) {
        const transactionExtended = Object.assign({
            vsize: Math.round(transaction.weight / 4),
            feePerVsize: Math.max(1, (transaction.fee || 0) / (transaction.weight / 4)),
        }, transaction);
        if (!transaction.status.confirmed) {
            transactionExtended.firstSeen = Math.round((new Date().getTime() / 1000));
        }
        return transactionExtended;
    }
}
exports.default = new TransactionUtils();
