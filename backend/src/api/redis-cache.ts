import { createClient } from 'redis';
import memPool from './mempool';
import blocks from './blocks';
import logger from '../logger';
import config from '../config';
import { BlockExtended, BlockSummary, MempoolTransactionExtended } from '../mempool.interfaces';
import rbfCache from './rbf-cache';
import transactionUtils from './transaction-utils';

enum NetworkDB {
  mainnet = 0,
  testnet,
  signet,
  liquid,
  liquidtestnet,
}

class RedisCache {
  private client;
  private connected = false;
  private schemaVersion = 1;
  private redisConfig: any;

  private pauseFlush: boolean = false;
  private cacheQueue: MempoolTransactionExtended[] = [];
  private removeQueue: string[] = [];
  private rbfCacheQueue: { type: string, txid: string, value: any }[] = [];
  private rbfRemoveQueue: { type: string, txid: string }[] = [];
  private txFlushLimit: number = 10000;
  private ignoreBlocksCache = false;

  constructor() {
    if (config.REDIS.ENABLED) {
      this.redisConfig = {
        socket: {
          path: config.REDIS.UNIX_SOCKET_PATH
        },
        database: NetworkDB[config.MEMPOOL.NETWORK],
      };
      this.$ensureConnected();
      setInterval(() => { this.$ensureConnected(); }, 10000);
    }
  }

  private async $ensureConnected(): Promise<boolean> {
    if (!this.connected && config.REDIS.ENABLED) {
      try {
        this.client = createClient(this.redisConfig);
        this.client.on('error', async (e) => {
          logger.err(`Error in Redis client: ${e instanceof Error ? e.message : e}`);
          this.connected = false;
          await this.client.disconnect();
        });
        await this.client.connect().then(async () => {
          try {
            const version = await this.client.get('schema_version');
            this.connected = true;
            if (version !== this.schemaVersion) {
              // schema changed
              // perform migrations or flush DB if necessary
              logger.info(`Redis schema version changed from ${version} to ${this.schemaVersion}`);
              await this.client.set('schema_version', this.schemaVersion);
            }
            logger.info(`Redis client connected`);
            return true;
          } catch (e) {
            this.connected = false;
            logger.warn('Failed to connect to Redis');
            return false;
          }
        });
        await this.$onConnected();
        return true;
      } catch (e) {
        logger.warn('Error connecting to Redis: ' + (e instanceof Error ? e.message : e));
        return false;
      }
    } else {
      try {
        // test connection
        await this.client.get('schema_version');
        return true;
      } catch (e) {
        logger.warn('Lost connection to Redis: ' + (e instanceof Error ? e.message : e));
        logger.warn('Attempting to reconnect in 10 seconds');
        this.connected = false;
        return false;
      }
    }
  }

  private async $onConnected(): Promise<void> {
    await this.$flushTransactions();
    await this.$removeTransactions([]);
    await this.$flushRbfQueues();
  }

  async $updateBlocks(blocks: BlockExtended[]): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    if (!this.connected) {
      logger.warn(`Failed to update blocks in Redis cache: Redis is not connected`);
      return;
    }
    try {
      await this.client.set('blocks', JSON.stringify(blocks));
      logger.debug(`Saved latest blocks to Redis cache`);
    } catch (e) {
      logger.warn(`Failed to update blocks in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $updateBlockSummaries(summaries: BlockSummary[]): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    if (!this.connected) {
      logger.warn(`Failed to update block summaries in Redis cache: Redis is not connected`);
      return;
    }
    try {
      await this.client.set('block-summaries', JSON.stringify(summaries));
      logger.debug(`Saved latest block summaries to Redis cache`);
    } catch (e) {
      logger.warn(`Failed to update block summaries in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $addTransaction(tx: MempoolTransactionExtended): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    this.cacheQueue.push(tx);
    if (this.cacheQueue.length >= this.txFlushLimit) {
      if (!this.pauseFlush) {
        await this.$flushTransactions();
      }
    }
  }

  async $flushTransactions(): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    if (!this.cacheQueue.length) {
      return;
    }
    if (!this.connected) {
      logger.warn(`Failed to add ${this.cacheQueue.length} transactions to Redis cache: Redis not connected`);
      return;
    }

    this.pauseFlush = false;

    const toAdd = this.cacheQueue.slice(0, this.txFlushLimit);
    try {
      const msetData = toAdd.map(tx => {
        const minified: any = structuredClone(tx);
        delete minified.hex;
        for (const vin of minified.vin) {
          delete vin.inner_redeemscript_asm;
          delete vin.inner_witnessscript_asm;
          delete vin.scriptsig_asm;
        }
        for (const vout of minified.vout) {
          delete vout.scriptpubkey_asm;
        }
        return [`mempool:tx:${tx.txid}`, JSON.stringify(minified)];
      });
      await this.client.MSET(msetData);
      // successful, remove transactions from cache queue
      this.cacheQueue = this.cacheQueue.slice(toAdd.length);
      logger.debug(`Saved ${toAdd.length} transactions to Redis cache, ${this.cacheQueue.length} left in queue`);
    } catch (e) {
      logger.warn(`Failed to add ${toAdd.length} transactions to Redis cache: ${e instanceof Error ? e.message : e}`);
      this.pauseFlush = true;
    }
  }

  async $removeTransactions(transactions: string[]): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    const toRemove = this.removeQueue.concat(transactions);
    this.removeQueue = [];
    let failed: string[] = [];
    let numRemoved = 0;
    if (this.connected) {
      const sliceLength = config.REDIS.BATCH_QUERY_BASE_SIZE;
      for (let i = 0; i < Math.ceil(toRemove.length / sliceLength); i++) {
        const slice = toRemove.slice(i * sliceLength, (i + 1) * sliceLength);
        try {
          await this.client.unlink(slice.map(txid => `mempool:tx:${txid}`));
          numRemoved+= sliceLength;
          logger.debug(`Deleted ${slice.length} transactions from the Redis cache`);
        } catch (e) {
          logger.warn(`Failed to remove ${slice.length} transactions from Redis cache: ${e instanceof Error ? e.message : e}`);
          failed = failed.concat(slice);
        }
      }
      // concat instead of replace, in case more txs have been added in the meantime
      this.removeQueue = this.removeQueue.concat(failed);
    } else {
      this.removeQueue = this.removeQueue.concat(toRemove);
    }
  }

  async $setRbfEntry(type: string, txid: string, value: any): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    if (!this.connected) {
      this.rbfCacheQueue.push({ type, txid, value });
      logger.warn(`Failed to set RBF ${type} in Redis cache: Redis is not connected`);
      return;
    }
    try {
      await this.client.set(`rbf:${type}:${txid}`, JSON.stringify(value));
    } catch (e) {
      logger.warn(`Failed to set RBF ${type} in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $removeRbfEntry(type: string, txid: string): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    if (!this.connected) {
      this.rbfRemoveQueue.push({ type, txid });
      logger.warn(`Failed to remove RBF ${type} from Redis cache: Redis is not connected`);
      return;
    }
    try {
      await this.client.unlink(`rbf:${type}:${txid}`);
    } catch (e) {
      logger.warn(`Failed to remove RBF ${type} from Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  private async $flushRbfQueues(): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    if (!this.connected) {
      return;
    }
    try {
      const toAdd = this.rbfCacheQueue;
      this.rbfCacheQueue = [];
      for (const { type, txid, value } of toAdd) {
        await this.$setRbfEntry(type, txid, value);
      }
      logger.debug(`Saved ${toAdd.length} queued RBF entries to the Redis cache`);
      const toRemove = this.rbfRemoveQueue;
      this.rbfRemoveQueue = [];
      for (const { type, txid } of toRemove) {
        await this.$removeRbfEntry(type, txid);
      }
      logger.debug(`Removed ${toRemove.length} queued RBF entries from the Redis cache`);
    } catch (e) {
      logger.warn(`Failed to flush RBF cache event queues after reconnecting to Redis: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $getBlocks(): Promise<BlockExtended[]> {
    if (!config.REDIS.ENABLED) {
      return [];
    }
    if (!this.connected) {
      logger.warn(`Failed to retrieve blocks from Redis cache: Redis is not connected`);
      return [];
    }
    try {
      const json = await this.client.get('blocks');
      return JSON.parse(json);
    } catch (e) {
      logger.warn(`Failed to retrieve blocks from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $getBlockSummaries(): Promise<BlockSummary[]> {
    if (!config.REDIS.ENABLED) {
      return [];
    }
    if (!this.connected) {
      logger.warn(`Failed to retrieve blocks from Redis cache: Redis is not connected`);
      return [];
    }
    try {
      const json = await this.client.get('block-summaries');
      return JSON.parse(json);
    } catch (e) {
      logger.warn(`Failed to retrieve blocks from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $getMempool(): Promise<{ [txid: string]: MempoolTransactionExtended }> {
    if (!config.REDIS.ENABLED) {
      return {};
    }
    if (!this.connected) {
      logger.warn(`Failed to retrieve mempool from Redis cache: Redis is not connected`);
      return {};
    }
    const start = Date.now();
    const mempool = {};
    try {
      const mempoolList = await this.scanKeys<MempoolTransactionExtended>('mempool:tx:*');
      for (const tx of mempoolList) {
        mempool[tx.key] = tx.value;
      }
      logger.info(`Loaded mempool from Redis cache in ${Date.now() - start} ms`);
      return mempool || {};
    } catch (e) {
      logger.warn(`Failed to retrieve mempool from Redis cache: ${e instanceof Error ? e.message : e}`);
    }
    return {};
  }

  async $getRbfEntries(type: string): Promise<any[]> {
    if (!config.REDIS.ENABLED) {
      return [];
    }
    if (!this.connected) {
      logger.warn(`Failed to retrieve Rbf ${type}s from Redis cache: Redis is not connected`);
      return [];
    }
    try {
      const rbfEntries = await this.scanKeys<MempoolTransactionExtended[]>(`rbf:${type}:*`);
      return rbfEntries;
    } catch (e) {
      logger.warn(`Failed to retrieve Rbf ${type}s from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $loadCache(): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    logger.info('Restoring mempool and blocks data from Redis cache');

    // Load mempool
    const loadedMempool = await this.$getMempool();
    this.inflateLoadedTxs(loadedMempool);
    // Load rbf data
    const rbfTxs = await this.$getRbfEntries('tx');
    const rbfTrees = await this.$getRbfEntries('tree');
    const rbfExpirations = await this.$getRbfEntries('exp');

    // Load & set block data
    if (!this.ignoreBlocksCache) {
      const loadedBlocks = await this.$getBlocks();
      const loadedBlockSummaries = await this.$getBlockSummaries();
      blocks.setBlocks(loadedBlocks || []);
      blocks.setBlockSummaries(loadedBlockSummaries || []);
    }
    // Set other data
    await memPool.$setMempool(loadedMempool);
    await rbfCache.load({
      txs: rbfTxs,
      trees: rbfTrees.map(loadedTree => { loadedTree.value.key = loadedTree.key; return loadedTree.value; }),
      expiring: rbfExpirations,
      mempool: memPool.getMempool(),
      spendMap: memPool.getSpendMap(),
    });
  }

  private inflateLoadedTxs(mempool: { [txid: string]: MempoolTransactionExtended }): void {
    for (const tx of Object.values(mempool)) {
      for (const vin of tx.vin) {
        if (vin.scriptsig) {
          vin.scriptsig_asm = transactionUtils.convertScriptSigAsm(vin.scriptsig);
          transactionUtils.addInnerScriptsToVin(vin);
        }
      }
      for (const vout of tx.vout) {
        if (vout.scriptpubkey) {
          vout.scriptpubkey_asm = transactionUtils.convertScriptSigAsm(vout.scriptpubkey);
        }
      }
    }
  }

  private async scanKeys<T>(pattern): Promise<{ key: string, value: T }[]> {
    logger.info(`loading Redis entries for ${pattern}`);
    let keys: string[] = [];
    const result: { key: string, value: T }[] = [];
    const patternLength = pattern.length - 1;
    let count = 0;
    const processValues = async (keys): Promise<void> => {
      const values = await this.client.MGET(keys);
      for (let i = 0; i < values.length; i++) {
        if (values[i]) {
          result.push({ key: keys[i].slice(patternLength), value: JSON.parse(values[i]) });
          count++;
        }
      }
      logger.info(`loaded ${count} entries from Redis cache`);
    };
    for await (const key of this.client.scanIterator({
      MATCH: pattern,
      COUNT: 100
    })) {
      keys.push(key);
      if (keys.length >= 10000) {
        await processValues(keys);
        keys = [];
      }
    }
    if (keys.length) {
      await processValues(keys);
    }
    return result;
  }

  public setIgnoreBlocksCache(): void {
    this.ignoreBlocksCache = true;
  }
}

export default new RedisCache();
