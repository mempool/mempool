import logger from '../../logger';
import DB from '../../database';

class NodesApi {
  public async $getNode(public_key: string): Promise<any> {
    try {
      const query = `SELECT * FROM nodes WHERE public_key = ?`;
      const [rows]: any = await DB.query(query, [public_key]);
      return rows[0];
    } catch (e) {
      logger.err('$getNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopCapacityNodes(): Promise<any> {
    try {
      const query = `SELECT nodes.*, nodes_stats.capacity_left, nodes_stats.capacity_right, nodes_stats.channels_left, nodes_stats.channels_right FROM nodes LEFT JOIN nodes_stats ON nodes_stats.public_key = nodes.public_key ORDER BY nodes_stats.added DESC, nodes_stats.capacity_left + nodes_stats.capacity_right DESC LIMIT 10`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getTopCapacityNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopChannelsNodes(): Promise<any> {
    try {
      const query = `SELECT nodes.*, nodes_stats.capacity_left, nodes_stats.capacity_right, nodes_stats.channels_left, nodes_stats.channels_right FROM nodes LEFT JOIN nodes_stats ON nodes_stats.public_key = nodes.public_key ORDER BY nodes_stats.added DESC, nodes_stats.channels_left + nodes_stats.channels_right DESC LIMIT 10`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getTopChannelsNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getLatestStatistics(): Promise<any> {
    try {
      const [rows]: any = await DB.query(`SELECT * FROM statistics ORDER BY id DESC LIMIT 1`);
      const [rows2]: any = await DB.query(`SELECT * FROM statistics ORDER BY id DESC LIMIT 1 OFFSET 72`);
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

export default new NodesApi();
