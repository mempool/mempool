import { Common } from '../api/common';
import { DB } from '../database';
import logger from '../logger';
import PoolsRepository from './PoolsRepository';

class HashratesRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveHashrates(hashrates: any) {
    if (hashrates.length === 0) {
      return;
    }

    let query = `INSERT INTO
      hashrates(hashrate_timestamp, avg_hashrate, pool_id, share, type) VALUES`;

    for (const hashrate of hashrates) {
      query += ` (FROM_UNIXTIME(${hashrate.hashrateTimestamp}), ${hashrate.avgHashrate}, ${hashrate.poolId}, ${hashrate.share}, "${hashrate.type}"),`;
    }
    query = query.slice(0, -1);

    let connection;
    try {
      connection = await DB.getConnection();
      await connection.query(query);
      connection.release();
    } catch (e: any) {
      connection.release();
      logger.err('Cannot save indexed hashrate into db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getNetworkDailyHashrate(interval: string | null): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    const connection = await DB.getConnection();

    let query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp, avg_hashrate as avgHashrate
      FROM hashrates`;

    if (interval) {
      query += ` WHERE hashrate_timestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()
        AND hashrates.type = 'daily'`;
    } else {
      query += ` WHERE hashrates.type = 'daily'`;
    }

    query += ` ORDER by hashrate_timestamp`;

    try {
      const [rows]: any[] = await connection.query(query);
      connection.release();

      return rows;
    } catch (e) {
      connection.release();
      logger.err('Cannot fetch network hashrate history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getWeeklyHashrateTimestamps(): Promise<number[]> {
    const connection = await DB.getConnection();

    const query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp
      FROM hashrates
      WHERE type = 'weekly'
      GROUP BY hashrate_timestamp`;

    try {
      const [rows]: any[] = await connection.query(query);
      connection.release();

      return rows.map(row => row.timestamp);
    } catch (e) {
      connection.release();
      logger.err('Cannot retreive indexed weekly hashrate timestamps. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Returns the current biggest pool hashrate history
   */
  public async $getPoolsWeeklyHashrate(interval: string | null): Promise<any[]> {
    interval = Common.getSqlInterval(interval);

    const connection = await DB.getConnection();
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

    try {
      const [rows]: any[] = await connection.query(query);
      connection.release();

      return rows;
    } catch (e) {
      connection.release();
      logger.err('Cannot fetch weekly pools hashrate history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Returns a pool hashrate history
   */
   public async $getPoolWeeklyHashrate(slug: string): Promise<any[]> {
    const pool = await PoolsRepository.$getPool(slug);
    if (!pool) {
      throw new Error(`This mining pool does not exist`);
    }

    // Find hashrate boundaries
    let query = `SELECT MIN(hashrate_timestamp) as firstTimestamp, MAX(hashrate_timestamp) as lastTimestamp
      FROM hashrates 
      JOIN pools on pools.id = pool_id 
      WHERE hashrates.type = 'weekly' AND pool_id = ? AND avg_hashrate != 0
      ORDER by hashrate_timestamp LIMIT 1`;

    let boundaries = {
      firstTimestamp: '1970-01-01',
      lastTimestamp: '9999-01-01'
    };

    let connection;
    try {
      connection = await DB.getConnection();
      const [rows]: any[] = await connection.query(query, [pool.id]);
      boundaries = rows[0];
      connection.release();
    } catch (e) {
      connection.release();
      logger.err('Cannot fetch hashrate start/end timestamps for this pool. Reason: ' + (e instanceof Error ? e.message : e));
    }

    // Get hashrates entries between boundaries
    query = `SELECT UNIX_TIMESTAMP(hashrate_timestamp) as timestamp, avg_hashrate as avgHashrate, share, pools.name as poolName
      FROM hashrates
      JOIN pools on pools.id = pool_id
      WHERE hashrates.type = 'weekly' AND hashrate_timestamp BETWEEN ? AND ?
      AND pool_id = ?
      ORDER by hashrate_timestamp`;

    try {
      const [rows]: any[] = await connection.query(query, [boundaries.firstTimestamp, boundaries.lastTimestamp, pool.id]);
      connection.release();

      return rows;
    } catch (e) {
      connection.release();
      logger.err('Cannot fetch pool hashrate history for this pool. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Set latest run timestamp
   */
  public async $setLatestRunTimestamp(key: string, val: any = null) {
    const connection = await DB.getConnection();
    const query = `UPDATE state SET number = ? WHERE name = ?`;

    try {
      await connection.query<any>(query, (val === null) ? [Math.round(new Date().getTime() / 1000), key] : [val, key]);
      connection.release();
    } catch (e) {
      connection.release();
      logger.err(`Cannot set last indexing timestamp for ${key}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get latest run timestamp
   */
  public async $getLatestRunTimestamp(key: string): Promise<number> {
    const connection = await DB.getConnection();
    const query = `SELECT number FROM state WHERE name = ?`;

    try {
      const [rows] = await connection.query<any>(query, [key]);
      connection.release();

      if (rows.length === 0) {
        return 0;
      }
      return rows[0]['number'];
    } catch (e) {
      connection.release();
      logger.err(`Cannot retreive last indexing timestamp for ${key}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Delete most recent data points for re-indexing
   */
  public async $deleteLastEntries() {
    logger.info(`Delete latest hashrates data points from the database`);

    let connection;
    try {
      connection = await DB.getConnection();
      const [rows] = await connection.query(`SELECT MAX(hashrate_timestamp) as timestamp FROM hashrates GROUP BY type`);
      for (const row of rows) {
        await connection.query(`DELETE FROM hashrates WHERE hashrate_timestamp = ?`, [row.timestamp]);
      }
      // Re-run the hashrate indexing to fill up missing data
      await this.$setLatestRunTimestamp('last_hashrates_indexing', 0);
      await this.$setLatestRunTimestamp('last_weekly_hashrates_indexing', 0);
    } catch (e) {
      logger.err('Cannot delete latest hashrates data points. Reason: ' + (e instanceof Error ? e.message : e));
    }

    connection.release();
  }
}

export default new HashratesRepository();
