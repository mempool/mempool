import { ResultSetHeader, RowDataPacket } from 'mysql2';
import DB from '../database';
import logger from '../logger';

export interface NodeRecord {
  publicKey: string; // node public key
  type: number; // TLV extension record type
  payload: string; // base64 record payload
}

class NodesRecordsRepository {
  public async $saveRecord(record: NodeRecord): Promise<void> {
    try {
      const payloadBytes = Buffer.from(record.payload, 'base64');
      await DB.query(`
        INSERT INTO nodes_records(public_key, type, payload)
        VALUE (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          payload = ?
      `, [record.publicKey, record.type, payloadBytes, payloadBytes]);
    } catch (e: any) {
      if (e.errno !== 1062) { // ER_DUP_ENTRY - Not an issue, just ignore this
        logger.err(`Cannot save node record (${[record.publicKey, record.type, record.payload]}) into db. Reason: ` + (e instanceof Error ? e.message : e));
        // We don't throw, not a critical issue if we miss some nodes records
      }
    }
   }

  public async $getRecordTypes(publicKey: string): Promise<any> {
    try {
      const query = `
        SELECT type FROM nodes_records
        WHERE public_key = ?
      `;
      const [rows] = await DB.query<RowDataPacket[][]>(query, [publicKey]);
      return rows.map(row => row['type']);
    } catch (e) {
      logger.err(`Cannot retrieve custom records for ${publicKey} from db. Reason: ` + (e instanceof Error ? e.message : e));
      return [];
    }
  }

  public async $deleteUnusedRecords(publicKey: string, recordTypes: number[]): Promise<number> {
    try {
      let query;
      if (recordTypes.length) {
        query = `
          DELETE FROM nodes_records
          WHERE public_key = ?
          AND type NOT IN (${recordTypes.map(type => `${type}`).join(',')})
        `;
      } else {
        query = `
          DELETE FROM nodes_records
          WHERE public_key = ?
        `;
      }
      const [result] = await DB.query<ResultSetHeader>(query, [publicKey]);
      return result.affectedRows;
    } catch (e) {
      logger.err(`Cannot delete unused custom records for ${publicKey} from db. Reason: ` + (e instanceof Error ? e.message : e));
      return 0;
    }
  }
}

export default new NodesRecordsRepository();
