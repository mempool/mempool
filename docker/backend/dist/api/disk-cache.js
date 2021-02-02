"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const fsPromises = fs.promises;
const process = require("process");
const cluster = require("cluster");
const mempool_1 = require("./mempool");
const blocks_1 = require("./blocks");
const logger_1 = require("../logger");
const config_1 = require("../config");
class DiskCache {
    constructor() {
        if (!cluster.isMaster) {
            return;
        }
        process.on('SIGINT', () => {
            this.saveCacheToDiskSync();
            process.exit(2);
        });
        process.on('SIGTERM', () => {
            this.saveCacheToDiskSync();
            process.exit(2);
        });
    }
    async $saveCacheToDisk() {
        if (!cluster.isMaster) {
            return;
        }
        try {
            logger_1.default.debug('Writing mempool and blocks data to disk cache (async)...');
            const mempoolChunk_1 = Object.fromEntries(Object.entries(mempool_1.default.getMempool()).slice(0, DiskCache.CHUNK_SIZE));
            await fsPromises.writeFile(DiskCache.FILE_NAME, JSON.stringify({
                blocks: blocks_1.default.getBlocks(),
                mempool: mempoolChunk_1
            }), { flag: 'w' });
            for (let i = 1; i < 10; i++) {
                const mempoolChunk = Object.fromEntries(Object.entries(mempool_1.default.getMempool()).slice(DiskCache.CHUNK_SIZE * i, i === 9 ? undefined : DiskCache.CHUNK_SIZE * i + DiskCache.CHUNK_SIZE));
                await fsPromises.writeFile(DiskCache.FILE_NAMES.replace('{number}', i.toString()), JSON.stringify({
                    mempool: mempoolChunk
                }), { flag: 'w' });
            }
            logger_1.default.debug('Mempool and blocks data saved to disk cache');
        }
        catch (e) {
            logger_1.default.warn('Error writing to cache file: ' + e.message || e);
        }
    }
    saveCacheToDiskSync() {
        try {
            logger_1.default.debug('Writing mempool and blocks data to disk cache...');
            const mempoolChunk_1 = Object.fromEntries(Object.entries(mempool_1.default.getMempool()).slice(0, DiskCache.CHUNK_SIZE));
            fs.writeFileSync(DiskCache.FILE_NAME, JSON.stringify({
                blocks: blocks_1.default.getBlocks(),
                mempool: mempoolChunk_1
            }), { flag: 'w' });
            for (let i = 1; i < 10; i++) {
                const mempoolChunk = Object.fromEntries(Object.entries(mempool_1.default.getMempool()).slice(DiskCache.CHUNK_SIZE * i, i === 9 ? undefined : DiskCache.CHUNK_SIZE * i + DiskCache.CHUNK_SIZE));
                fs.writeFileSync(DiskCache.FILE_NAMES.replace('{number}', i.toString()), JSON.stringify({
                    mempool: mempoolChunk
                }), { flag: 'w' });
            }
            logger_1.default.debug('Mempool and blocks data saved to disk cache');
        }
        catch (e) {
            logger_1.default.warn('Error writing to cache file: ' + e.message || e);
        }
    }
    loadMempoolCache() {
        if (!fs.existsSync(DiskCache.FILE_NAME)) {
            return;
        }
        let data = {};
        const cacheData = fs.readFileSync(DiskCache.FILE_NAME, 'utf8');
        if (cacheData) {
            logger_1.default.info('Restoring mempool and blocks data from disk cache');
            data = JSON.parse(cacheData);
        }
        for (let i = 1; i < 10; i++) {
            const fileName = DiskCache.FILE_NAMES.replace('{number}', i.toString());
            if (fs.existsSync(fileName)) {
                const cacheData2 = JSON.parse(fs.readFileSync(fileName, 'utf8'));
                Object.assign(data.mempool, cacheData2.mempool);
            }
        }
        mempool_1.default.setMempool(data.mempool);
        blocks_1.default.setBlocks(data.blocks);
    }
}
DiskCache.FILE_NAME = config_1.default.MEMPOOL.CACHE_DIR + 'cache.json';
DiskCache.FILE_NAMES = config_1.default.MEMPOOL.CACHE_DIR + 'cache{number}.json';
DiskCache.CHUNK_SIZE = 10000;
exports.default = new DiskCache();
