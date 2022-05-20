import { Common } from '../api/common';
import config from '../config';
import DB from '../database';
import logger from '../logger';
import { PoolInfo, PoolTag } from '../mempool.interfaces';

class PoolsRepository {
  /**
   * Get all pools tagging info
   */
  public async $getPools(): Promise<PoolTag[]> {
    const [rows] = await DB.query('SELECT id, name, addresses, regexes, slug FROM pools;');
    return <PoolTag[]>rows;
  }

  /**
   * Get unknown pool tagging info
   */
  public async $getUnknownPool(): Promise<PoolTag> {
    const [rows] = await DB.query('SELECT id, name, slug FROM pools where name = "Unknown"');
    return <PoolTag>rows[0];
  }

  /**
   * Get basic pool info and block count
   */
  public async $getPoolsInfo(interval: string | null = null): Promise<PoolInfo[]> {
    interval = Common.getSqlInterval(interval);

    let query = `SELECT COUNT(height) as blockCount, pool_id as poolId, pools.name as name, pools.link as link, slug
      FROM blocks
      JOIN pools on pools.id = pool_id`;

    if (interval) {
      query += ` WHERE blocks.blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP BY pool_id
      ORDER BY COUNT(height) DESC`;

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
   * Get mining pool statistics for one pool
   */
   public async $getPool(slug: string): Promise<PoolTag | null> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.slug = ?`;

    try {
      const [rows]: any[] = await DB.query(query, [slug]);

      if (rows.length < 1) {
        return null;
      }

      rows[0].regexes = JSON.parse(rows[0].regexes);
      if (['testnet', 'signet'].includes(config.MEMPOOL.NETWORK)) {
        rows[0].addresses = []; // pools.json only contains mainnet addresses
      } else {
        rows[0].addresses = JSON.parse(rows[0].addresses);
      }

      return rows[0];
    } catch (e) {
      logger.err('Cannot get pool from db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new PoolsRepository();
