import DB from '../database';
import logger from '../logger';
import config from '../config';
import PoolsRepository from '../repositories/PoolsRepository';
import { PoolTag } from '../mempool.interfaces';
import diskCache from './disk-cache';

class PoolsParser {
  miningPools: any[] = [];
  unknownPool: any = {
    'id': 0,
    'name': 'Unknown',
    'link': 'https://learnmeabitcoin.com/technical/coinbase-transaction',
    'regexes': '[]',
    'addresses': '[]',
    'slug': 'unknown'
  };
  private uniqueLogs: string[] = [];

  private uniqueLog(loggerFunction: any, msg: string): void {
    if (this.uniqueLogs.includes(msg)) {
      return;
    }
    this.uniqueLogs.push(msg);
    loggerFunction(msg);
  }

  public setMiningPools(pools): void {
    for (const pool of pools) {
      pool.regexes = pool.tags;
      pool.slug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
      delete(pool.tags);
    }
    this.miningPools = pools;
  }

  /**
   * Populate our db with updated mining pool definition
   * @param pools 
   */
  public async migratePoolsJson(): Promise<void> {
    // We also need to wipe the backend cache to make sure we don't serve blocks with
    // the wrong mining pool (usually happen with unknown blocks)
    diskCache.setIgnoreBlocksCache();

    await this.$insertUnknownPool();

    for (const pool of this.miningPools) {
      if (!pool.id) {
        logger.info(`Mining pool ${pool.name} has no unique 'id' defined. Skipping.`);
        continue;
      }

      const poolDB = await PoolsRepository.$getPoolByUniqueId(pool.id, false);
      if (!poolDB) {
        // New mining pool
        const slug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
        logger.debug(`Inserting new mining pool ${pool.name}`);
        await PoolsRepository.$insertNewMiningPool(pool, slug);
        await this.$deleteUnknownBlocks();
      } else {
        if (poolDB.name !== pool.name) {
          // Pool has been renamed
          const newSlug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
          logger.warn(`Renaming ${poolDB.name} mining pool to ${pool.name}. Slug has been updated. Maybe you want to make a redirection from 'https://mempool.space/mining/pool/${poolDB.slug}' to 'https://mempool.space/mining/pool/${newSlug}`);
          await PoolsRepository.$renameMiningPool(poolDB.id, newSlug, pool.name);
        }
        if (poolDB.link !== pool.link) {
          // Pool link has changed
          logger.debug(`Updating link for ${pool.name} mining pool`);
          await PoolsRepository.$updateMiningPoolLink(poolDB.id, pool.link);
        }
        if (JSON.stringify(pool.addresses) !== poolDB.addresses ||
          JSON.stringify(pool.regexes) !== poolDB.regexes) {
          // Pool addresses changed or coinbase tags changed
          logger.notice(`Updating addresses and/or coinbase tags for ${pool.name} mining pool. If 'AUTOMATIC_BLOCK_REINDEXING' is enabled, we will re-index its blocks and 'unknown' blocks`);
          await PoolsRepository.$updateMiningPoolTags(poolDB.id, pool.addresses, pool.regexes);
          await this.$deleteBlocksForPool(poolDB);
        }
      }
    }

    logger.info('Mining pools-v2.json import completed');
  }

  /**
   * Manually add the 'unknown pool'
   */
  public async $insertUnknownPool(): Promise<void> {
    if (!config.DATABASE.ENABLED) {
      return;
    }

    try {
      const [rows]: any[] = await DB.query({ sql: 'SELECT name from pools where name="Unknown"', timeout: 120000 });
      if (rows.length === 0) {
        await DB.query({
          sql: `INSERT INTO pools(name, link, regexes, addresses, slug, unique_id)
          VALUES("${this.unknownPool.name}", "${this.unknownPool.link}", "[]", "[]", "${this.unknownPool.slug}", 0);
        `});
      } else {
        await DB.query(`UPDATE pools
          SET name='${this.unknownPool.name}', link='${this.unknownPool.link}',
          regexes='[]', addresses='[]',
          slug='${this.unknownPool.slug}',
          unique_id=0
          WHERE slug='${this.unknownPool.slug}'
        `);
      }
    } catch (e) {
      logger.err(`Unable to insert or update "Unknown" mining pool. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  /**
   * Delete indexed blocks for an updated mining pool
   * 
   * @param pool 
   */
  private async $deleteBlocksForPool(pool: PoolTag): Promise<void> {
    // Get oldest blocks mined by the pool and assume pools-v2.json updates only concern most recent years
    // Ignore early days of Bitcoin as there were no mining pool yet
    const [oldestPoolBlock]: any[] = await DB.query(`
      SELECT height
      FROM blocks
      WHERE pool_id = ?
      ORDER BY height
      LIMIT 1`,
      [pool.id]
    );
    const oldestBlockHeight = oldestPoolBlock.length ?? 0 > 0 ? oldestPoolBlock[0].height : 130635;
    const [unknownPool] = await DB.query(`SELECT id from pools where slug = "unknown"`);
    this.uniqueLog(logger.notice, `Deleting blocks with unknown mining pool from height ${oldestBlockHeight} for re-indexing`);
    await DB.query(`
      DELETE FROM blocks
      WHERE pool_id = ? AND height >= ${oldestBlockHeight}`,
      [unknownPool[0].id]
    );
    logger.notice(`Deleting blocks from ${pool.name} mining pool for re-indexing`);
    await DB.query(`
      DELETE FROM blocks
      WHERE pool_id = ?`,
      [pool.id]
    );
  }

  private async $deleteUnknownBlocks(): Promise<void> {
    const [unknownPool] = await DB.query(`SELECT id from pools where slug = "unknown"`);
    this.uniqueLog(logger.notice, `Deleting blocks with unknown mining pool from height 130635 for re-indexing`);
    await DB.query(`
      DELETE FROM blocks
      WHERE pool_id = ? AND height >= 130635`,
      [unknownPool[0].id]
    );
  }
}

export default new PoolsParser();
