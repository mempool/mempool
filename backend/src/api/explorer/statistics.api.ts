import logger from '../../logger';
import DB from '../../database';
import { Common } from '../common';

class StatisticsApi {
  public async $getStatistics(interval: string | null = null): Promise<any> {
    interval = Common.getSqlInterval(interval);

    let query = `SELECT UNIX_TIMESTAMP(added) AS added, channel_count, total_capacity,
      tor_nodes, clearnet_nodes, unannounced_nodes, clearnet_tor_nodes
      FROM lightning_stats`;

    if (interval) {
      query += ` WHERE added BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` ORDER BY added DESC`;

    try {
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getStatistics error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getLatestStatistics(): Promise<any> {
    try {
      const [rows]: any = await DB.query(`SELECT * FROM lightning_stats ORDER BY added DESC LIMIT 1`);
      const [rows2]: any = await DB.query(`SELECT * FROM lightning_stats WHERE DATE(added) = DATE(NOW() - INTERVAL 7 DAY)`);
      return {
        latest: rows[0],
        previous: rows2[0],
      };
    } catch (e) {
      logger.err('$getLatestStatistics error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getStatisticsCount(): Promise<number> {
    try {
      const [rows]: any = await DB.query(`SELECT count(*) as count FROM lightning_stats`);
      return rows[0].count;
    } catch (e) {
      logger.err('$getLatestStatistics error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new StatisticsApi();
