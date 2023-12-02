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

  private cacheQueue: MempoolTransactionExtended[] = [];
  private txFlushLimit: number = 10000;

  constructor() {
    if (config.REDIS.ENABLED) {
      const redisConfig = {
        socket: {
          path: config.REDIS.UNIX_SOCKET_PATH
        },
        database: NetworkDB[config.MEMPOOL.NETWORK],
      };
      this.client = createClient(redisConfig);
      this.client.on('error', (e) => {
        logger.err(`Error in Redis client: ${e instanceof Error ? e.message : e}`);
      });
      this.$ensureConnected();
    }
  }

  private async $ensureConnected(): Promise<void> {
    if (!this.connected && config.REDIS.ENABLED) {
      return this.client.connect().then(async () => {
        this.connected = true;
        logger.info(`Redis client connected`);
        const version = await this.client.get('schema_version');
        if (version !== this.schemaVersion) {
          // schema changed
          // perform migrations or flush DB if necessary
          logger.info(`Redis schema version changed from ${version} to ${this.schemaVersion}`);
          await this.client.set('schema_version', this.schemaVersion);
        }
      });
    }
  }

  async $updateBlocks(blocks: BlockExtended[]) {
    try {
      await this.$ensureConnected();
      await this.client.set('blocks', JSON.stringify(blocks));
      logger.debug(`Saved latest blocks to Redis cache`);
    } catch (e) {
      logger.warn(`Failed to update blocks in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $updateBlockSummaries(summaries: BlockSummary[]) {
    try {
      await this.$ensureConnected();
      await this.client.set('block-summaries', JSON.stringify(summaries));
      logger.debug(`Saved latest block summaries to Redis cache`);
    } catch (e) {
      logger.warn(`Failed to update block summaries in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $addTransaction(tx: MempoolTransactionExtended) {
    this.cacheQueue.push(tx);
    if (this.cacheQueue.length >= this.txFlushLimit) {
      await this.$flushTransactions();
    }
  }

  async $flushTransactions() {
    const success = await this.$addTransactions(this.cacheQueue);
    if (success) {
      logger.debug(`Saved ${this.cacheQueue.length} transactions to Redis cache`);
      this.cacheQueue = [];
    } else {
      logger.err(`Failed to save ${this.cacheQueue.length} transactions to Redis cache`);
    }
  }

  private async $addTransactions(newTransactions: MempoolTransactionExtended[]): Promise<boolean> {
    if (!newTransactions.length) {
      return true;
    }
    try {
      await this.$ensureConnected();
      const msetData = newTransactions.map(tx => {
        const minified: any = { ...tx };
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
      return true;
    } catch (e) {
      logger.warn(`Failed to add ${newTransactions.length} transactions to Redis cache: ${e instanceof Error ? e.message : e}`);
      return false;
    }
  }

  async $removeTransactions(transactions: string[]) {
    try {
      await this.$ensureConnected();
      const sliceLength = config.REDIS.BATCH_QUERY_BASE_SIZE;
      for (let i = 0; i < Math.ceil(transactions.length / sliceLength); i++) {
        const slice = transactions.slice(i * sliceLength, (i + 1) * sliceLength);
        await this.client.unlink(slice.map(txid => `mempool:tx:${txid}`));
        logger.debug(`Deleted ${slice.length} transactions from the Redis cache`);
      }
    } catch (e) {
      logger.warn(`Failed to remove ${transactions.length} transactions from Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $setRbfEntry(type: string, txid: string, value: any): Promise<void> {
    try {
      await this.$ensureConnected();
      await this.client.set(`rbf:${type}:${txid}`, JSON.stringify(value));
    } catch (e) {
      logger.warn(`Failed to set RBF ${type} in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $removeRbfEntry(type: string, txid: string): Promise<void> {
    try {
      await this.$ensureConnected();
      await this.client.unlink(`rbf:${type}:${txid}`);
    } catch (e) {
      logger.warn(`Failed to remove RBF ${type} from Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $getBlocks(): Promise<BlockExtended[]> {
    try {
      await this.$ensureConnected();
      const json = await this.client.get('blocks');
      return JSON.parse(json);
    } catch (e) {
      logger.warn(`Failed to retrieve blocks from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $getBlockSummaries(): Promise<BlockSummary[]> {
    try {
      await this.$ensureConnected();
      const json = await this.client.get('block-summaries');
      return JSON.parse(json);
    } catch (e) {
      logger.warn(`Failed to retrieve blocks from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $getMempool(): Promise<{ [txid: string]: MempoolTransactionExtended }> {
    const start = Date.now();
    const mempool = {};
    try {
      await this.$ensureConnected();
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
    try {
      await this.$ensureConnected();
      const rbfEntries = await this.scanKeys<MempoolTransactionExtended[]>(`rbf:${type}:*`);
      return rbfEntries;
    } catch (e) {
      logger.warn(`Failed to retrieve Rbf ${type}s from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $loadCache() {
    logger.info('Restoring mempool and blocks data from Redis cache');
    // Load block data
    const loadedBlocks = await this.$getBlocks();
    const loadedBlockSummaries = await this.$getBlockSummaries();
    // Load mempool
    const loadedMempool = await this.$getMempool();
    this.inflateLoadedTxs(loadedMempool);
    // Load rbf data
    const rbfTxs = await this.$getRbfEntries('tx');
    const rbfTrees = await this.$getRbfEntries('tree');
    const rbfExpirations = await this.$getRbfEntries('exp');

    // Set loaded data
    blocks.setBlocks(loadedBlocks || []);
    blocks.setBlockSummaries(loadedBlockSummaries || []);
    await memPool.$setMempool(loadedMempool);
    await rbfCache.load({
      txs: rbfTxs,
      trees: rbfTrees.map(loadedTree => { loadedTree.value.key = loadedTree.key; return loadedTree.value; }),
      expiring: rbfExpirations,
    });
  }

  private inflateLoadedTxs(mempool: { [txid: string]: MempoolTransactionExtended }) {
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
}

export default new RedisCache();
