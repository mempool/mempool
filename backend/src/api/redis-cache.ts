import { createClient } from 'redis';
import memPool from './mempool';
import blocks from './blocks';
import logger from '../logger';
import config from '../config';
import { BlockExtended, BlockSummary, TransactionExtended } from '../mempool.interfaces';
import rbfCache from './rbf-cache';

class RedisCache {
  private client;
  private connected = false;

  constructor() {
    if (config.REDIS.ENABLED) {
      const redisConfig = {
        socket: {
          path: config.REDIS.UNIX_SOCKET_PATH
        }
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
      return this.client.connect().then(() => {
        this.connected = true;
        logger.info(`Redis client connected`);
      });
    }
  }

  async $updateBlocks(blocks: BlockExtended[]) {
    try {
      await this.$ensureConnected();
      await this.client.json.set('blocks', '$', blocks);
    } catch (e) {
      logger.warn(`Failed to update blocks in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $updateBlockSummaries(summaries: BlockSummary[]) {
    try {
      await this.$ensureConnected();
      await this.client.json.set('block-summaries', '$', summaries);
    } catch (e) {
      logger.warn(`Failed to update blocks in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $addTransactions(newTransactions: TransactionExtended[]) {
    try {
      await this.$ensureConnected();
      await Promise.all(newTransactions.map(tx => {
        return this.client.json.set('tx:' + tx.txid, '$', tx);
      }));
    } catch (e) {
      logger.warn(`Failed to add ${newTransactions.length} transactions to Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $removeTransactions(transactions: string[]) {
    try {
      await this.$ensureConnected();
      await Promise.all(transactions.map(txid => {
        return this.client.del('tx:' + txid);
      }));
    } catch (e) {
      logger.warn(`Failed to remove ${transactions.length} transactions from Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $setRbfEntry(type: string, txid: string, value: any): Promise<void> {
    try {
      await this.$ensureConnected();
      await this.client.json.set(`rbf:${type}:${txid}`, '$', value);
    } catch (e) {
      logger.warn(`Failed to set RBF ${type} in Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $removeRbfEntry(type: string, txid: string): Promise<void> {
    try {
      await this.$ensureConnected();
      await this.client.del(`rbf:${type}:${txid}`);
    } catch (e) {
      logger.warn(`Failed to remove RBF ${type} from Redis cache: ${e instanceof Error ? e.message : e}`);
    }
  }

  async $getBlocks(): Promise<BlockExtended[]> {
    try {
      await this.$ensureConnected();
      return this.client.json.get('blocks');
    } catch (e) {
      logger.warn(`Failed to retrieve blocks from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $getBlockSummaries(): Promise<BlockSummary[]> {
    try {
      await this.$ensureConnected();
      return this.client.json.get('block-summaries');
    } catch (e) {
      logger.warn(`Failed to retrieve blocks from Redis cache: ${e instanceof Error ? e.message : e}`);
      return [];
    }
  }

  async $getMempool(): Promise<{ [txid: string]: TransactionExtended }> {
    const mempool = {};
    try {
      await this.$ensureConnected();
      const keys = await this.client.keys('tx:*');
      const promises: Promise<TransactionExtended[]>[] = [];
      for (let i = 0; i < keys.length; i += 10000) {
        const keySlice = keys.slice(i, i + 10000);
        if (!keySlice.length) {
          continue;
        }
        promises.push(this.client.json.mGet(keySlice, '$').then(chunk => {
          for (const txs of chunk) {
            for (const tx of txs) {
              if (tx) {
                mempool[tx.txid] = tx;
              }
            }
          }
        }));
      }
      await Promise.all(promises);
    } catch (e) {
      logger.warn(`Failed to retrieve mempool from Redis cache: ${e instanceof Error ? e.message : e}`);
    }
    return mempool;
  }

  async $getRbfEntries(type: string): Promise<any[]> {
    try {
      await this.$ensureConnected();
      const keys = await this.client.keys(`rbf:${type}:*`);
      const promises: Promise<TransactionExtended[]>[] = [];
      for (let i = 0; i < keys.length; i += 10000) {
        const keySlice = keys.slice(i, i + 10000);
        if (!keySlice.length) {
          continue;
        }
        promises.push(this.client.json.mGet(keySlice, '$').then(chunk => chunk?.length ? chunk.flat().map((v, i) => [keySlice[i].slice(`rbf:${type}:`.length), v]) : [] ));
      }
      const entries = await Promise.all(promises);
      return entries.flat();
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
      trees: rbfTrees.map(loadedTree => loadedTree[1]),
      expiring: rbfExpirations,
    });
  }

}

export default new RedisCache();
