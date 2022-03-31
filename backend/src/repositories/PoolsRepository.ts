import { Common } from '../api/common';
import { DB } from '../database';
import logger from '../logger';
import { PoolInfo, PoolTag } from '../mempool.interfaces';

class PoolsRepository {
  /**
   * Get all pools tagging info
   */
  public async $getPools(): Promise<PoolTag[]> {
    const connection = await DB.getConnection();
    const [rows] = await connection.query('SELECT id, name, addresses, regexes, slug FROM pools;');
    connection.release();
    return <PoolTag[]>rows;
  }

  /**
   * Get unknown pool tagging info
   */
  public async $getUnknownPool(): Promise<PoolTag> {
    const connection = await DB.getConnection();
    const [rows] = await connection.query('SELECT id, name, slug FROM pools where name = "Unknown"');
    connection.release();
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

    // logger.debug(query);
    const connection = await DB.getConnection();
    try {
      const [rows] = await connection.query(query);
      connection.release();

      return <PoolInfo[]>rows;
    } catch (e) {
      connection.release();
      logger.err('$getPoolsInfo() error' + (e instanceof Error ? e.message : e));
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

    const connection = await DB.getConnection();
    try {
      const [rows] = await connection.query(query, [from, to]);
      connection.release();

      return <PoolInfo[]>rows;
    } catch (e) {
      connection.release();
      logger.err('$getPoolsInfoBetween() error' + (e instanceof Error ? e.message : e));
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

    let connection;
    try {
      connection = await DB.getConnection();

      const [rows] = await connection.query(query, [slug]);
      connection.release();

      if (rows.length < 1) {
        logger.debug(`$getPool(): slug does not match any known pool`);
        return null;
      }

      rows[0].regexes = JSON.parse(rows[0].regexes);
      rows[0].addresses = JSON.parse(rows[0].addresses);

      return rows[0];
    } catch (e) {
      connection.release();
      logger.err('$getPool() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new PoolsRepository();
