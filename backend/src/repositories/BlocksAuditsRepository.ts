import DB from '../database';
import logger from '../logger';
import bitcoinApi from '../api/bitcoin/bitcoin-api-factory';
import { BlockAudit, AuditScore, TransactionAudit, TransactionStripped } from '../mempool.interfaces';

interface MigrationAudit {
  version: number,
  height: number,
  id: string,
  timestamp: number,
  prioritizedTxs: string[],
  acceleratedTxs: string[],
  template: TransactionStripped[],
  transactions: TransactionStripped[],
}

class BlocksAuditRepositories {
  public async $saveAudit(audit: BlockAudit): Promise<void> {
    try {
      await DB.query(`INSERT INTO blocks_audits(version, time, height, hash, unseen_txs, missing_txs, added_txs, prioritized_txs, fresh_txs, sigop_txs, fullrbf_txs, accelerated_txs, match_rate, expected_fees, expected_weight)
        VALUE (?, FROM_UNIXTIME(?), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [audit.version, audit.time, audit.height, audit.hash, JSON.stringify(audit.unseenTxs), JSON.stringify(audit.missingTxs),
          JSON.stringify(audit.addedTxs), JSON.stringify(audit.prioritizedTxs), JSON.stringify(audit.freshTxs), JSON.stringify(audit.sigopTxs), JSON.stringify(audit.fullrbfTxs), JSON.stringify(audit.acceleratedTxs), audit.matchRate, audit.expectedFees, audit.expectedWeight]);
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

  public async $getBlockAudit(hash: string): Promise<BlockAudit | null> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT
          blocks_audits.version,
          blocks_audits.height,
          blocks_audits.hash as id,
          UNIX_TIMESTAMP(blocks_audits.time) as timestamp,
          template,
          unseen_txs as unseenTxs,
          missing_txs as missingTxs,
          added_txs as addedTxs,
          prioritized_txs as prioritizedTxs,
          fresh_txs as freshTxs,
          sigop_txs as sigopTxs,
          fullrbf_txs as fullrbfTxs,
          accelerated_txs as acceleratedTxs,
          match_rate as matchRate,
          expected_fees as expectedFees,
          expected_weight as expectedWeight
        FROM blocks_audits
        JOIN blocks_templates ON blocks_templates.id = blocks_audits.hash
        WHERE blocks_audits.hash = ?
      `, [hash]);
      
      if (rows.length) {
        rows[0].unseenTxs = JSON.parse(rows[0].unseenTxs);
        rows[0].missingTxs = JSON.parse(rows[0].missingTxs);
        rows[0].addedTxs = JSON.parse(rows[0].addedTxs);
        rows[0].prioritizedTxs = JSON.parse(rows[0].prioritizedTxs);
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

  public async $getBlockTxAudit(hash: string, txid: string): Promise<TransactionAudit | null> {
    try {
      const blockAudit = await this.$getBlockAudit(hash);

      if (blockAudit) {
        const isAdded = blockAudit.addedTxs.includes(txid);
        const isPrioritized = blockAudit.prioritizedTxs.includes(txid);
        const isAccelerated = blockAudit.acceleratedTxs.includes(txid);
        const isConflict = blockAudit.fullrbfTxs.includes(txid);
        let isExpected = false;
        let firstSeen = undefined;
        blockAudit.template?.forEach(tx => {
          if (tx.txid === txid) {
            isExpected = true;
            firstSeen = tx.time;
          }
        });
        const wasSeen = blockAudit.version === 1 ? !blockAudit.unseenTxs.includes(txid) : (isExpected || isPrioritized || isAccelerated);

        return {
          seen: wasSeen,
          expected: isExpected,
          added: isAdded && (blockAudit.version === 0 || !wasSeen),
          prioritized: isPrioritized,
          conflict: isConflict,
          accelerated: isAccelerated,
          firstSeen,
        };
      }
      return null;
    } catch (e: any) {
      logger.err(`Cannot fetch block transaction audit from db. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getBlockAuditScore(hash: string): Promise<AuditScore> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT hash, match_rate as matchRate, expected_fees as expectedFees, expected_weight as expectedWeight
        FROM blocks_audits
        WHERE blocks_audits.hash = ?
      `, [hash]);
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

  /**
   * [INDEXING] Migrate audits from v0 to v1
   */
  public async $migrateAuditsV0toV1(): Promise<void> {
    try {
      let done = false;
      let processed = 0;
      let lastHeight;
      while (!done) {
        const [toMigrate]: MigrationAudit[][] = await DB.query(
          `SELECT
            blocks_audits.height as height,
            blocks_audits.hash as id,
            UNIX_TIMESTAMP(blocks_audits.time) as timestamp,
            blocks_summaries.transactions as transactions,
            blocks_templates.template as template,
            blocks_audits.prioritized_txs as prioritizedTxs,
            blocks_audits.accelerated_txs as acceleratedTxs
          FROM blocks_audits
          JOIN blocks_summaries ON blocks_summaries.id = blocks_audits.hash
          JOIN blocks_templates ON blocks_templates.id = blocks_audits.hash
          WHERE blocks_audits.version = 0
          AND blocks_summaries.version = 2
          ORDER BY blocks_audits.height DESC
          LIMIT 100
        `) as any[];

        if (toMigrate.length <= 0 || lastHeight === toMigrate[0].height) {
          done = true;
          break;
        }
        lastHeight = toMigrate[0].height;

        logger.info(`migrating ${toMigrate.length} audits to version 1`);

        for (const audit of toMigrate) {
          // unpack JSON-serialized transaction lists
          audit.transactions = JSON.parse((audit.transactions as any as string) || '[]');
          audit.template = JSON.parse((audit.template as any as string) || '[]');

          // we know transactions in the template, or marked "prioritized" or "accelerated"
          // were seen in our mempool before the block was mined.
          const isSeen = new Set<string>();
          for (const tx of audit.template) {
            isSeen.add(tx.txid);
          }
          for (const txid of audit.prioritizedTxs) {
            isSeen.add(txid);
          }
          for (const txid of audit.acceleratedTxs) {
            isSeen.add(txid);
          }
          const unseenTxs = audit.transactions.slice(0).map(tx => tx.txid).filter(txid => !isSeen.has(txid));

          // identify "prioritized" transactions
          const prioritizedTxs: string[] = [];
          let lastEffectiveRate = 0;
          // Iterate over the mined template from bottom to top (excluding the coinbase)
          // Transactions should appear in ascending order of mining priority.
          for (let i = audit.transactions.length - 1; i > 0; i--) {
            const blockTx = audit.transactions[i];
            // If a tx has a lower in-band effective fee rate than the previous tx,
            // it must have been prioritized out-of-band (in order to have a higher mining priority)
            // so exclude from the analysis.
            if ((blockTx.rate || 0) < lastEffectiveRate) {
              prioritizedTxs.push(blockTx.txid);
            } else {
              lastEffectiveRate = blockTx.rate || 0;
            }
          }

          // Update audit in the database
          await DB.query(`
            UPDATE blocks_audits SET
              version = ?,
              unseen_txs = ?,
              prioritized_txs = ?
            WHERE hash = ?
          `, [1, JSON.stringify(unseenTxs), JSON.stringify(prioritizedTxs), audit.id]);
        }

        processed += toMigrate.length;
      }

      logger.info(`migrated ${processed} audits to version 1`);
    } catch (e: any) {
      logger.err(`Error while migrating audits from v0 to v1. Will try again later. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }
}

export default new BlocksAuditRepositories();

