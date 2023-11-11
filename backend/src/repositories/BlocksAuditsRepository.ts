import blocks from '../api/blocks';
import DB from '../database';
import logger from '../logger';
import { BlockAudit, AuditScore } from '../mempool.interfaces';

class BlocksAuditRepositories {
  public async $saveAudit(audit: BlockAudit): Promise<void> {
    try {
      await DB.query(`INSERT INTO blocks_audits(time, height, hash, missing_txs, added_txs, fresh_txs, sigop_txs, fullrbf_txs, accelerated_txs, match_rate, expected_fees, expected_weight)
        VALUE (FROM_UNIXTIME(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [audit.time, audit.height, audit.hash, JSON.stringify(audit.missingTxs),
          JSON.stringify(audit.addedTxs), JSON.stringify(audit.freshTxs), JSON.stringify(audit.sigopTxs), JSON.stringify(audit.fullrbfTxs), JSON.stringify(audit.acceleratedTxs), audit.matchRate, audit.expectedFees, audit.expectedWeight]);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Cannot save block audit for block ${audit.hash} because it has already been indexed, ignoring`);
      } else {
        logger.err(`Cannot save block audit into db. Reason: ` + (e instanceof Error ? e.message : e));
      }
    }
  }

  public async $setSummary(hash: string, expectedFees: number, expectedWeight: number) {
    try {
      await DB.query(`
        UPDATE blocks_audits SET
        expected_fees = ?,
        expected_weight = ?
        WHERE hash = ?
      `, [expectedFees, expectedWeight, hash]);
    } catch (e: any) {
      logger.err(`Cannot update block audit in db. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  public async $getBlocksHealthHistory(div: number, interval: string | null): Promise<any> {
    try {
      let query = `SELECT UNIX_TIMESTAMP(time) as time, height, match_rate FROM blocks_audits`;

      if (interval !== null) {
        query += ` WHERE time BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
      }

      query += ` GROUP BY UNIX_TIMESTAMP(time) DIV ${div} ORDER BY height`;

      const [rows] = await DB.query(query);
      return rows;
    } catch (e: any) {
      logger.err(`Cannot fetch blocks health history. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getBlocksHealthCount(): Promise<number> {
    try {
      const [rows] = await DB.query(`SELECT count(hash) as count FROM blocks_audits`);
      return rows[0].count;
    } catch (e: any) {
      logger.err(`Cannot fetch blocks health count. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getBlockAudit(hash: string): Promise<any> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT blocks_audits.height, blocks_audits.hash as id, UNIX_TIMESTAMP(blocks_audits.time) as timestamp,
        template,
        missing_txs as missingTxs,
        added_txs as addedTxs,
        fresh_txs as freshTxs,
        sigop_txs as sigopTxs,
        fullrbf_txs as fullrbfTxs,
        accelerated_txs as acceleratedTxs,
        match_rate as matchRate,
        expected_fees as expectedFees,
        expected_weight as expectedWeight
        FROM blocks_audits
        JOIN blocks_templates ON blocks_templates.id = blocks_audits.hash
        WHERE blocks_audits.hash = "${hash}"
      `);
      
      if (rows.length) {
        rows[0].missingTxs = JSON.parse(rows[0].missingTxs);
        rows[0].addedTxs = JSON.parse(rows[0].addedTxs);
        rows[0].freshTxs = JSON.parse(rows[0].freshTxs);
        rows[0].sigopTxs = JSON.parse(rows[0].sigopTxs);
        rows[0].fullrbfTxs = JSON.parse(rows[0].fullrbfTxs);
        rows[0].acceleratedTxs = JSON.parse(rows[0].acceleratedTxs);
        rows[0].template = JSON.parse(rows[0].template);

        return rows[0];
      }
      return null;
    } catch (e: any) {
      logger.err(`Cannot fetch block audit from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getBlockAuditScore(hash: string): Promise<AuditScore> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT hash, match_rate as matchRate, expected_fees as expectedFees, expected_weight as expectedWeight
        FROM blocks_audits
        WHERE blocks_audits.hash = "${hash}"
      `);
      return rows[0];
    } catch (e: any) {
      logger.err(`Cannot fetch block audit from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getBlockAuditScores(maxHeight: number, minHeight: number): Promise<AuditScore[]> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT hash, match_rate as matchRate, expected_fees as expectedFees, expected_weight as expectedWeight
        FROM blocks_audits
        WHERE blocks_audits.height BETWEEN ? AND ?
      `, [minHeight, maxHeight]);
      return rows;
    } catch (e: any) {
      logger.err(`Cannot fetch block audit from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getBlocksWithoutSummaries(): Promise<string[]> {
    try {
      const [fromRows]: any[] = await DB.query(`
        SELECT height
        FROM blocks_audits
        WHERE expected_fees IS NULL
        ORDER BY height DESC
        LIMIT 1
      `);
      if (!fromRows?.length) {
        return [];
      }
      const fromHeight = fromRows[0].height;
      const [idRows]: any[] = await DB.query(`
        SELECT hash
        FROM blocks_audits
        WHERE height <= ?
        ORDER BY height DESC
      `, [fromHeight]);
      return idRows.map(row => row.hash);
    } catch (e: any) {
      logger.err(`Cannot fetch block audit from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new BlocksAuditRepositories();

