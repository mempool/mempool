import { ResultSetHeader } from 'mysql2';
import DB from '../database';
import logger from '../logger';

export interface NodeSocket {
  publicKey: string;
  network: string | null;
  addr: string;
}

class NodesSocketsRepository {
  public async $saveSocket(socket: NodeSocket): Promise<void> {
    try {
      await DB.query(`
        INSERT INTO nodes_sockets(public_key, socket, type)
        VALUE (?, ?, ?)
      `, [socket.publicKey, socket.addr, socket.network], 'silent');
    } catch (e: any) {
      if (e.errno !== 1062) { // ER_DUP_ENTRY - Not an issue, just ignore this
        logger.err(`Cannot save node socket (${[socket.publicKey, socket.addr, socket.network]}) into db. Reason: ` + (e instanceof Error ? e.message : e));
        // We don't throw, not a critical issue if we miss some nodes sockets
      }
    }
   }

   public async $deleteUnusedSockets(publicKey: string, addresses: string[]): Promise<number> {
    if (addresses.length === 0) {
      return 0;
    }
    try {
      const query = `
        DELETE FROM nodes_sockets
        WHERE public_key = ?
        AND socket NOT IN (${addresses.map(id => `"${id}"`).join(',')})
      `;
      const [result] = await DB.query<ResultSetHeader>(query, [publicKey]);
      return result.affectedRows;
    } catch (e) {
      logger.err(`Cannot delete unused sockets for ${publicKey} from db. Reason: ` + (e instanceof Error ? e.message : e));
      return 0;
    }
   }
}

export default new NodesSocketsRepository();
