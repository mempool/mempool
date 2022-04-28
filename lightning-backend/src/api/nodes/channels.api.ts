import logger from '../../logger';
import DB from '../../database';

class ChannelsApi {
  public async $getChannelsForNode(public_key: string): Promise<any> {
    try {
      const query = `SELECT * FROM channels WHERE node1_public_key = ? OR node2_public_key = ?`;
      const [rows]: any = await DB.query(query, [public_key, public_key]);
      return rows;
    } catch (e) {
      logger.err('$getChannelsForNode error: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new ChannelsApi();
