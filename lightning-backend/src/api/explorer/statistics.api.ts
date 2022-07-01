import logger from '../../logger';
import DB from '../../database';

class StatisticsApi {
  public async $getStatistics(): Promise<any> {
    try {
      const query = `SELECT UNIX_TIMESTAMP(added) AS added, channel_count, node_count, total_capacity FROM statistics ORDER BY id DESC`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getStatistics error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new StatisticsApi();
