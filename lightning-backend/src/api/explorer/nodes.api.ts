import logger from '../../logger';
import DB from '../../database';

class NodesApi {
  public async $getNode(public_key: string): Promise<any> {
    try {
      const query = `SELECT nodes.*, (SELECT COUNT(*) FROM channels WHERE channels.status < 2 AND (channels.node1_public_key = ? OR channels.node2_public_key = ?)) AS channel_count, (SELECT SUM(capacity) FROM channels WHERE channels.status < 2 AND (channels.node1_public_key = ? OR channels.node2_public_key = ?)) AS capacity FROM nodes WHERE public_key = ?`;
      const [rows]: any = await DB.query(query, [public_key, public_key, public_key, public_key, public_key]);
      return rows[0];
    } catch (e) {
      logger.err('$getNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getNodeStats(public_key: string): Promise<any> {
    try {
      const query = `SELECT * FROM node_stats WHERE public_key = ? ORDER BY added DESC`;
      const [rows]: any = await DB.query(query, [public_key]);
      return rows;
    } catch (e) {
      logger.err('$getNodeStats error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopCapacityNodes(): Promise<any> {
    try {
      const query = `SELECT nodes.*, node_stats.capacity, node_stats.channels FROM nodes LEFT JOIN node_stats ON node_stats.public_key = nodes.public_key ORDER BY node_stats.added DESC, node_stats.capacity DESC LIMIT 10`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getTopCapacityNodes error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getTopChannelsNodes(): Promise<any> {
    try {
      const query = `SELECT nodes.*, node_stats.capacity, node_stats.channels FROM nodes LEFT JOIN node_stats ON node_stats.public_key = nodes.public_key ORDER BY node_stats.added DESC, node_stats.channels DESC LIMIT 10`;
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
