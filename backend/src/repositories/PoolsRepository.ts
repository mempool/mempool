import { Common } from '../api/common';
import { DB } from '../database';
import logger from '../logger';
import { PoolInfo, PoolTag } from '../mempool.interfaces';

class PoolsRepository {
  /**
   * Get all pools tagging info
   */
  public async $getPools(): Promise<PoolTag[]> {
    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query('SELECT id, name, addresses, regexes FROM pools;');
    connection.release();
    return <PoolTag[]>rows;
  }

  /**
   * Get unknown pool tagging info
   */
  public async $getUnknownPool(): Promise<PoolTag> {
    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query('SELECT id, name FROM pools where name = "Unknown"');
    connection.release();
    return <PoolTag>rows[0];
  }

  /**
   * Get basic pool info and block count
   */
  public async $getPoolsInfo(interval: string | null = null): Promise<PoolInfo[]> {
    interval = Common.getSqlInterval(interval);

    let query = `SELECT COUNT(height) as blockCount, pool_id as poolId, pools.name as name, pools.link as link
      FROM blocks
      JOIN pools on pools.id = pool_id`;

    if (interval) {
      query += ` WHERE blocks.blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP BY pool_id
      ORDER BY COUNT(height) DESC`;

    // logger.debug(query);
    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query(query);
    connection.release();

    return <PoolInfo[]>rows;
  }

  /**
   * Get mining pool statistics for one pool
   */
   public async $getPool(poolId: any): Promise<object> {
    const query = `
      SELECT *
      FROM pools
      WHERE pools.id = ?`;

    // logger.debug(query);
    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query(query, [poolId]);
    connection.release();

    rows[0].regexes = JSON.parse(rows[0].regexes);
    rows[0].addresses = JSON.parse(rows[0].addresses);

    return rows[0];
  }
}

export default new PoolsRepository();
