import { Common } from '../api/common';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import logger from '../logger';
import { PoolInfo, PoolTag } from '../mempool.interfaces';

class PoolsRepository {
  /**
   * Get all pools tagging info
   */
  public async $getPools(): Promise<PoolTag[]> {
    const [rows] = await DB.query('SELECT id, unique_id as uniqueId, name, addresses, regexes, slug FROM pools');
    return <PoolTag[]>rows;
  }

  /**
   * Get unknown pool tagging info
   */
  public async $getUnknownPool(): Promise<PoolTag> {
    let [rows]: any[] = await DB.query('SELECT id, unique_id as uniqueId, name, slug FROM pools where name = "Unknown"');
    if (rows && rows.length === 0 && config.DATABASE.ENABLED) {
      await poolsParser.$insertUnknownPool();
      [rows] = await DB.query('SELECT id, unique_id as uniqueId, name, slug FROM pools where name = "Unknown"');
    }
    return <PoolTag>rows[0];
  }

  /**
   * Get basic pool info and block count
   */
  public async $getPoolsInfo(interval: string | null = null): Promise<PoolInfo[]> {
    interval = Common.getSqlInterval(interval);

    let query = `
      SELECT
        COUNT(blocks.height) As blockCount,
          pool_id AS poolId,
          pools.name AS name,
          pools.link AS link,
          slug,
          AVG(blocks_audits.match_rate) AS avgMatchRate,
          AVG((CAST(blocks.fees as SIGNED) - CAST(blocks_audits.expected_fees as SIGNED)) / NULLIF(CAST(blocks_audits.expected_fees as SIGNED), 0)) AS avgFeeDelta,
          unique_id as poolUniqueId
      FROM blocks
      JOIN pools on pools.id = pool_id
      LEFT JOIN blocks_audits ON blocks_audits.height = blocks.height
    `;

    if (interval) {
      query += ` WHERE blocks.blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP BY pool_id
      ORDER BY COUNT(blocks.height) DESC`;

    try {
      const [rows] = await DB.query(query);
      return <PoolInfo[]>rows;
    } catch (e) {
      logger.err(`Cannot generate pools stats. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get basic pool info and block count between two timestamp
   */
  public async $getPoolsInfoBetween(from: number, to: number): Promise<PoolInfo[]> {
    const query = `SELECT COUNT(height) as blockCount, pools.id as poolId, pools.name as poolName
      FROM pools
      LEFT JOIN blocks on pools.id = blocks.pool_id AND blocks.blockTimestamp BETWEEN FROM_UNIXTIME(?) AND FROM_UNIXTIME(?)
      GROUP BY pools.id`;

    try {
      const [rows] = await DB.query(query, [from, to]);
      return <PoolInfo[]>rows;
    } catch (e) {
      logger.err('Cannot generate pools blocks count. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get a mining pool info
   */
  public async $getPool(slug: string, parse: boolean = true): Promise<PoolTag | null> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.slug = ?`;

    try {
      const [rows]: any[] = await DB.query(query, [slug]);

      if (rows.length < 1) {
        return null;
      }

      if (parse) {
        rows[0].regexes = JSON.parse(rows[0].regexes);
      }
      if (['testnet', 'signet'].includes(config.MEMPOOL.NETWORK)) {
        rows[0].addresses = []; // pools-v2.json only contains mainnet addresses
      } else if (parse) {
        rows[0].addresses = JSON.parse(rows[0].addresses);
      }

      return rows[0];
    } catch (e) {
      logger.err('Cannot get pool from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get a mining pool info by its unique id
   */
  public async $getPoolByUniqueId(id: number, parse: boolean = true): Promise<PoolTag | null> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.unique_id = ?`;

    try {
      const [rows]: any[] = await DB.query(query, [id]);

      if (rows.length < 1) {
        return null;
      }

      if (parse) {
        rows[0].regexes = JSON.parse(rows[0].regexes);
      }
      if (['testnet', 'signet'].includes(config.MEMPOOL.NETWORK)) {
        rows[0].addresses = []; // pools.json only contains mainnet addresses
      } else if (parse) {
        rows[0].addresses = JSON.parse(rows[0].addresses);
      }

      return rows[0];
    } catch (e) {
      logger.err('Cannot get pool from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Insert a new mining pool in the database
   * 
   * @param pool 
   */
  public async $insertNewMiningPool(pool: any, slug: string): Promise<void> {
    try {
      await DB.query(`
        INSERT INTO pools
        SET name = ?, link = ?, addresses = ?, regexes = ?, slug = ?, unique_id = ?`,
        [pool.name, pool.link, JSON.stringify(pool.addresses), JSON.stringify(pool.regexes), slug, pool.id]
      );
    } catch (e: any) {
      logger.err(`Cannot insert new mining pool into db. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Rename an existing mining pool
   * 
   * @param dbId
   * @param newSlug
   * @param newName 
   */
  public async $renameMiningPool(dbId: number, newSlug: string, newName: string): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET slug = ?, name = ?
        WHERE id = ?`,
        [newSlug, newName, dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot rename mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Update an exisiting mining pool link
   * 
   * @param dbId 
   * @param newLink 
   */
  public async $updateMiningPoolLink(dbId: number, newLink: string): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET link = ?
        WHERE id = ?`,
        [newLink, dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot update link for mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
    }

  }

  /**
   * Update an existing mining pool addresses or coinbase tags
   * 
   * @param dbId 
   * @param addresses 
   * @param regexes 
   */
  public async $updateMiningPoolTags(dbId: number, addresses: string, regexes: string): Promise<void> {
    try {
      await DB.query(`
        UPDATE pools
        SET addresses = ?, regexes = ?
        WHERE id = ?`,
        [JSON.stringify(addresses), JSON.stringify(regexes), dbId]
      );
    } catch (e: any) {
      logger.err(`Cannot update mining pool id ${dbId}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

}

export default new PoolsRepository();
