import logger from '../../logger';
import DB from '../../database';

class StatisticsApi {
  public async $getStatistics(): Promise<any> {
    try {
      const query = `SELECT UNIX_TIMESTAMP(added) AS added, channel_count, node_count, total_capacity, tor_nodes, clearnet_nodes, unannounced_nodes FROM lightning_stats ORDER BY id DESC`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getStatistics error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getLatestStatistics(): Promise<any> {
    try {
      const [rows]: any = await DB.query(`SELECT * FROM lightning_stats ORDER BY id DESC LIMIT 1`);
      const [rows2]: any = await DB.query(`SELECT * FROM lightning_stats ORDER BY id DESC LIMIT 1 OFFSET 72`);
      return {
        latest: rows[0],
        previous: rows2[0],
      };
    } catch (e) {
      logger.err('$getLatestStatistics error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

}

export default new StatisticsApi();
