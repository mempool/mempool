import { DB } from '../database';
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
  public async $getPoolsInfo(interval: string | null): Promise<PoolInfo[]> {
    const query = `
      SELECT COUNT(height) as blockCount, pool_id as poolId, pools.name as name, pools.link as link
      FROM blocks
      JOIN pools on pools.id = pool_id` +
      (interval != null ? ` WHERE blocks.blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()` : ``) +
      ` GROUP BY pool_id
      ORDER BY COUNT(height) DESC
    `;

    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query(query);
    connection.release();

    return <PoolInfo[]>rows;
  }
}

export default new PoolsRepository();
