import { Common } from '../api/common';
import { DB } from '../database';
import logger from '../logger';

class HashratesRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveDailyStat(dailyStat: any) {
    const connection = await DB.pool.getConnection();

    try {
      const query = `INSERT INTO
      hashrates(hashrate_timestamp, avg_hashrate, pool_id)
      VALUE (FROM_UNIXTIME(?), ?, ?)`;

      const params: any[] = [
        dailyStat.hashrateTimestamp, dailyStat.avgHashrate,
        dailyStat.poolId
      ];

      // logger.debug(query);
      await connection.query(query, params);
    } catch (e: any) {
      logger.err('$saveHashrateInDatabase() error' + (e instanceof Error ? e.message : e));
    }

    connection.release();
  }

  /**
   * Returns an array of all timestamp we've already indexed
   */
  public async $get(interval: string | null): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    const connection = await DB.pool.getConnection();

    let query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp, avg_hashrate as avgHashrate
      FROM hashrates`;

    if (interval) {
      query += ` WHERE hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    const [rows]: any[] = await connection.query(query);
    connection.release();

    return rows;
  }
}

export default new HashratesRepository();
