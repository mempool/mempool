import DB from '../database';
import logger from '../logger';
import { BlockAudit } from '../mempool.interfaces';

class BlocksAuditRepositories {
  public async $saveAudit(audit: BlockAudit): Promise<void> {
    try {
      await DB.query(`INSERT INTO blocks_audits(time, height, hash, missing_txs, added_txs, match_rate)
        VALUE (FROM_UNIXTIME(?), ?, ?, ?, ?, ?)`, [audit.time, audit.height, audit.hash, JSON.stringify(audit.missingTxs),
          JSON.stringify(audit.addedTxs), audit.matchRate]);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Cannot save block audit for block ${audit.hash} because it has already been indexed, ignoring`);
      } else {
        logger.err(`Cannot save block audit into db. Reason: ` + (e instanceof Error ? e.message : e));
        throw e;
      }
    }
  }

  public async $getBlockPredictionsHistory(div: number, interval: string | null): Promise<any> {
    try {
      let query = `SELECT UNIX_TIMESTAMP(time) as time, height, match_rate FROM blocks_audits`;

      if (interval !== null) {
        query += ` WHERE time BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
      }

      query += ` GROUP BY UNIX_TIMESTAMP(time) DIV ${div} ORDER BY height`;

      const [rows] = await DB.query(query);
      return rows;
    } catch (e: any) {
      logger.err(`Cannot fetch block prediction history. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getPredictionsCount(): Promise<number> {
    try {
      const [rows] = await DB.query(`SELECT count(hash) as count FROM blocks_audits`);
      return rows[0].count;
    } catch (e: any) {
      logger.err(`Cannot fetch block prediction history. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new BlocksAuditRepositories();

