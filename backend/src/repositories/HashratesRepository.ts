import { Common } from '../api/common';
import { DB } from '../database';
import logger from '../logger';

class HashratesRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveHashrates(hashrates: any) {
    let query = `INSERT INTO
      hashrates(hashrate_timestamp, avg_hashrate, pool_id) VALUES`;

    for (const hashrate of hashrates) {
      query += ` (FROM_UNIXTIME(${hashrate.hashrateTimestamp}), ${hashrate.avgHashrate}, ${hashrate.poolId}),`;
    }
    query = query.slice(0, -1);

    const connection = await DB.pool.getConnection();
    try {
      // logger.debug(query);
      await connection.query(query);
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

    query += ` ORDER by hashrate_timestamp DESC`;

    const [rows]: any[] = await connection.query(query);
    connection.release();

    return rows;
  }

  public async $setLatestRunTimestamp() {
    const connection = await DB.pool.getConnection();
    const query = `UPDATE state SET number = ? WHERE name = 'last_hashrates_indexing'`;
    await connection.query<any>(query, [Math.round(new Date().getTime() / 1000)]);
    connection.release();
  }

  public async $getLatestRunTimestamp(): Promise<number> {
    const connection = await DB.pool.getConnection();
    const query = `SELECT number FROM state WHERE name = 'last_hashrates_indexing'`;
    const [rows] = await connection.query<any>(query);
    connection.release();
    return rows[0]['number'];
  }
}

export default new HashratesRepository();
