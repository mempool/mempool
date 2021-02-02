"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("../../config");
const bitcoin = require("@mempool/bitcoin");
const bitcoinjs = require("bitcoinjs-lib");
const blocks_1 = require("../blocks");
const mempool_1 = require("../mempool");
class BitcoinApi {
    constructor() {
        this.rawMempoolCache = null;
        this.bitcoindClient = new bitcoin.Client({
            host: config_1.default.CORE_RPC.HOST,
            port: config_1.default.CORE_RPC.PORT,
            user: config_1.default.CORE_RPC.USERNAME,
            pass: config_1.default.CORE_RPC.PASSWORD,
            timeout: 60000,
        });
    }
    $getRawTransactionBitcoind(txId, skipConversion = false, addPrevout = false) {
        return this.bitcoindClient.getRawTransaction(txId, true)
            .then((transaction) => {
            if (skipConversion) {
                return transaction;
            }
            return this.$convertTransaction(transaction, addPrevout);
        });
    }
    $getRawTransaction(txId, skipConversion = false, addPrevout = false) {
        // If the transaction is in the mempool we already converted and fetched the fee. Only prevouts are missing
        const txInMempool = mempool_1.default.getMempool()[txId];
        if (txInMempool && addPrevout) {
            return this.$addPrevouts(txInMempool);
        }
        // Special case to fetch the Coinbase transaction
        if (txId === '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b') {
            return this.$returnCoinbaseTransaction();
        }
        return this.bitcoindClient.getRawTransaction(txId, true)
            .then((transaction) => {
            if (skipConversion) {
                return transaction;
            }
            return this.$convertTransaction(transaction, addPrevout);
        });
    }
    $getBlockHeightTip() {
        return this.bitcoindClient.getChainTips()
            .then((result) => result[0].height);
    }
    $getTxIdsForBlock(hash) {
        return this.bitcoindClient.getBlock(hash, 1)
            .then((rpcBlock) => rpcBlock.tx);
    }
    $getBlockHash(height) {
        return this.bitcoindClient.getBlockHash(height);
    }
    async $getBlock(hash) {
        const foundBlock = blocks_1.default.getBlocks().find((block) => block.id === hash);
        if (foundBlock) {
            return foundBlock;
        }
        return this.bitcoindClient.getBlock(hash)
            .then((block) => this.convertBlock(block));
    }
    $getAddress(address) {
        throw new Error('Method getAddress not supported by the Bitcoin RPC API.');
    }
    $getAddressTransactions(address, lastSeenTxId) {
        throw new Error('Method getAddressTransactions not supported by the Bitcoin RPC API.');
    }
    $getRawMempool() {
        return this.bitcoindClient.getRawMemPool();
    }
    $getAddressPrefix(prefix) {
        const found = [];
        const mp = mempool_1.default.getMempool();
        for (const tx in mp) {
            for (const vout of mp[tx].vout) {
                if (vout.scriptpubkey_address.indexOf(prefix) === 0) {
                    found.push(vout.scriptpubkey_address);
                    if (found.length >= 10) {
                        return found;
                    }
                }
            }
        }
        return found;
    }
    async $convertTransaction(transaction, addPrevout) {
        let esploraTransaction = {
            txid: transaction.txid,
            version: transaction.version,
            locktime: transaction.locktime,
            size: transaction.size,
            weight: transaction.weight,
            fee: 0,
            vin: [],
            vout: [],
            status: { confirmed: false },
        };
        esploraTransaction.vout = transaction.vout.map((vout) => {
            return {
                value: vout.value * 100000000,
                scriptpubkey: vout.scriptPubKey.hex,
                scriptpubkey_address: vout.scriptPubKey && vout.scriptPubKey.addresses ? vout.scriptPubKey.addresses[0] : '',
                scriptpubkey_asm: vout.scriptPubKey.asm ? this.convertScriptSigAsm(vout.scriptPubKey.asm) : '',
                scriptpubkey_type: this.translateScriptPubKeyType(vout.scriptPubKey.type),
            };
        });
        esploraTransaction.vin = transaction.vin.map((vin) => {
            return {
                is_coinbase: !!vin.coinbase,
                prevout: null,
                scriptsig: vin.scriptSig && vin.scriptSig.hex || vin.coinbase || '',
                scriptsig_asm: vin.scriptSig && this.convertScriptSigAsm(vin.scriptSig.asm) || '',
                sequence: vin.sequence,
                txid: vin.txid || '',
                vout: vin.vout || 0,
                witness: vin.txinwitness,
            };
        });
        if (transaction.confirmations) {
            esploraTransaction.status = {
                confirmed: true,
                block_height: blocks_1.default.getCurrentBlockHeight() - transaction.confirmations + 1,
                block_hash: transaction.blockhash,
                block_time: transaction.blocktime,
            };
        }
        if (transaction.confirmations) {
            esploraTransaction = await this.$calculateFeeFromInputs(esploraTransaction, addPrevout);
        }
        else {
            esploraTransaction = await this.$appendMempoolFeeData(esploraTransaction);
        }
        return esploraTransaction;
    }
    convertBlock(block) {
        return {
            id: block.hash,
            height: block.height,
            version: block.version,
            timestamp: block.time,
            bits: parseInt(block.bits, 16),
            nonce: block.nonce,
            difficulty: block.difficulty,
            merkle_root: block.merkleroot,
            tx_count: block.nTx,
            size: block.size,
            weight: block.weight,
            previousblockhash: block.previousblockhash,
        };
    }
    translateScriptPubKeyType(outputType) {
        const map = {
            'pubkey': 'p2pk',
            'pubkeyhash': 'p2pkh',
            'scripthash': 'p2sh',
            'witness_v0_keyhash': 'v0_p2wpkh',
            'witness_v0_scripthash': 'v0_p2wsh',
            'witness_v1_taproot': 'v1_p2tr',
            'nonstandard': 'nonstandard',
            'nulldata': 'op_return'
        };
        if (map[outputType]) {
            return map[outputType];
        }
        else {
            return '';
        }
    }
    async $appendMempoolFeeData(transaction) {
        if (transaction.fee) {
            return transaction;
        }
        let mempoolEntry;
        if (!mempool_1.default.isInSync() && !this.rawMempoolCache) {
            this.rawMempoolCache = await this.$getRawMempoolVerbose();
        }
        if (this.rawMempoolCache && this.rawMempoolCache[transaction.txid]) {
            mempoolEntry = this.rawMempoolCache[transaction.txid];
        }
        else {
            mempoolEntry = await this.$getMempoolEntry(transaction.txid);
        }
        transaction.fee = mempoolEntry.fees.base * 100000000;
        return transaction;
    }
    async $addPrevouts(transaction) {
        for (const vin of transaction.vin) {
            if (vin.prevout) {
                continue;
            }
            const innerTx = await this.$getRawTransaction(vin.txid, false);
            vin.prevout = innerTx.vout[vin.vout];
            this.addInnerScriptsToVin(vin);
        }
        return transaction;
    }
    $returnCoinbaseTransaction() {
        return this.bitcoindClient.getBlock('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f', 2)
            .then((block) => {
            return this.$convertTransaction(Object.assign(block.tx[0], {
                confirmations: blocks_1.default.getCurrentBlockHeight() + 1,
                blocktime: 1231006505
            }), false);
        });
    }
    $validateAddress(address) {
        return this.bitcoindClient.validateAddress(address);
    }
    $getMempoolEntry(txid) {
        return this.bitcoindClient.getMempoolEntry(txid);
    }
    $getRawMempoolVerbose() {
        return this.bitcoindClient.getRawMemPool(true);
    }
    async $calculateFeeFromInputs(transaction, addPrevout) {
        if (transaction.vin[0].is_coinbase) {
            transaction.fee = 0;
            return transaction;
        }
        let totalIn = 0;
        for (const vin of transaction.vin) {
            const innerTx = await this.$getRawTransaction(vin.txid, !addPrevout);
            if (addPrevout) {
                vin.prevout = innerTx.vout[vin.vout];
                this.addInnerScriptsToVin(vin);
            }
            totalIn += innerTx.vout[vin.vout].value;
        }
        const totalOut = transaction.vout.reduce((p, output) => p + output.value, 0);
        transaction.fee = parseFloat((totalIn - totalOut).toFixed(8));
        return transaction;
    }
    convertScriptSigAsm(str) {
        const a = str.split(' ');
        const b = [];
        a.forEach((chunk) => {
            if (chunk.substr(0, 3) === 'OP_') {
                chunk = chunk.replace(/^OP_(\d+)/, 'OP_PUSHNUM_$1');
                chunk = chunk.replace('OP_CHECKSEQUENCEVERIFY', 'OP_CSV');
                b.push(chunk);
            }
            else {
                chunk = chunk.replace('[ALL]', '01');
                if (chunk === '0') {
                    b.push('OP_0');
                }
                else {
                    b.push('OP_PUSHBYTES_' + Math.round(chunk.length / 2) + ' ' + chunk);
                }
            }
        });
        return b.join(' ');
    }
    addInnerScriptsToVin(vin) {
        if (!vin.prevout) {
            return;
        }
        if (vin.prevout.scriptpubkey_type === 'p2sh') {
            const redeemScript = vin.scriptsig_asm.split(' ').reverse()[0];
            vin.inner_redeemscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(redeemScript, 'hex')));
        }
        if (vin.prevout.scriptpubkey_type === 'v0_p2wsh' && vin.witness) {
            const witnessScript = vin.witness[vin.witness.length - 1];
            vin.inner_witnessscript_asm = this.convertScriptSigAsm(bitcoinjs.script.toASM(Buffer.from(witnessScript, 'hex')));
        }
    }
}
exports.default = BitcoinApi;
