import logger from '../../logger';
import DB from '../../database';

class ChannelsApi {
  public async $getAllChannels(): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels`;
      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('$getChannel error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsByStatus(status: number): Promise<any[]> {
    try {
      const query = `SELECT * FROM channels WHERE status = ?`;
      const [rows]: any = await DB.query(query, [status]);
      return rows;
    } catch (e) {
      logger.err('$getChannel error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannel(shortId: string): Promise<any> {
    try {
      const query = `SELECT n1.alias AS alias_left, n2.alias AS alias_right, channels.* FROM channels LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key WHERE channels.id = ?`;
      const [rows]: any = await DB.query(query, [shortId]);
      return rows[0];
    } catch (e) {
      logger.err('$getChannel error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getChannelsForNode(public_key: string): Promise<any> {
    try {
      const query = `SELECT n1.alias AS alias_left, n2.alias AS alias_right, channels.* FROM channels LEFT JOIN nodes AS n1 ON n1.public_key = channels.node1_public_key LEFT JOIN nodes AS n2 ON n2.public_key = channels.node2_public_key WHERE node1_public_key = ? OR node2_public_key = ?`;
      const [rows]: any = await DB.query(query, [public_key, public_key]);
      return rows;
    } catch (e) {
      logger.err('$getChannelsForNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new ChannelsApi();
