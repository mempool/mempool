import { Common } from '../api/common';
import { DB } from '../database';
import logger from '../logger';
import PoolsRepository from './PoolsRepository';

class HashratesRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveHashrates(hashrates: any) {
    let query = `INSERT INTO
      hashrates(hashrate_timestamp, avg_hashrate, pool_id, share, type) VALUES`;

    for (const hashrate of hashrates) {
      query += ` (FROM_UNIXTIME(${hashrate.hashrateTimestamp}), ${hashrate.avgHashrate}, ${hashrate.poolId}, ${hashrate.share}, "${hashrate.type}"),`;
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

  public async $getNetworkDailyHashrate(interval: string | null): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    const connection = await DB.pool.getConnection();

    let query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp, avg_hashrate as avgHashrate
      FROM hashrates`;

    if (interval) {
      query += ` WHERE hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()
        AND hashrates.type = 'daily'
        AND pool_id IS NULL`;
    } else {
      query += ` WHERE hashrates.type = 'daily'
        AND pool_id IS NULL`;
    }

    query += ` ORDER by hashrate_timestamp`;

    const [rows]: any[] = await connection.query(query);
    connection.release();

    return rows;
  }

  /**
   * Returns the current biggest pool hashrate history
   */
  public async $getPoolsWeeklyHashrate(interval: string | null): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    const connection = await DB.pool.getConnection();
    const topPoolsId = (await PoolsRepository.$getPoolsInfo('1w')).map((pool) => pool.poolId);

    let query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp, avg_hashrate as avgHashrate, share, pools.name as poolName
      FROM hashrates
      JOIN pools on pools.id = pool_id`;

    if (interval) {
      query += ` WHERE hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()
        AND hashrates.type = 'weekly'
        AND pool_id IN (${topPoolsId})`;
    } else {
      query += ` WHERE hashrates.type = 'weekly'
        AND pool_id IN (${topPoolsId})`;
    }

    query += ` ORDER by hashrate_timestamp, FIELD(pool_id, ${topPoolsId})`;

    console.log(query);

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
