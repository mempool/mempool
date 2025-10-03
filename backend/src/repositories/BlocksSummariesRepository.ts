import { RowDataPacket } from 'mysql2';
import { Common } from '../api/common';
import DB from '../database';
import logger from '../logger';
import { BlockSummary, TransactionClassified } from '../mempool.interfaces';

class BlocksSummariesRepository {
  public async $getByBlockId(id: string): Promise<BlockSummary | undefined> {
    try {
      const [summary]: any[] = await DB.query(`SELECT * from blocks_summaries WHERE id = ?`, [id]);
      if (summary.length > 0) {
        summary[0].transactions = JSON.parse(summary[0].transactions);
        return summary[0];
      }
    } catch (e) {
      logger.err(`Cannot get block summary for block id ${id}. Reason: ` + (e instanceof Error ? e.message : e));
    }

    return undefined;
  }

  public async $saveTransactions(blockHeight: number, blockId: string, transactions: TransactionClassified[], version: number): Promise<void> {
    try {
      const transactionsStr = JSON.stringify(transactions);
      await DB.query(`
        INSERT INTO blocks_summaries
        SET height = ?, transactions = ?, id = ?, version = ?
        ON DUPLICATE KEY UPDATE transactions = ?, version = ?`,
        [blockHeight, transactionsStr, blockId, version, transactionsStr, version]);
    } catch (e: any) {
      logger.debug(`Cannot save block summary transactions for ${blockId}. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $saveTemplate(params: { height: number, template: BlockSummary, version: number}): Promise<void> {
    const blockId = params.template?.id;
    try {
      const transactions = JSON.stringify(params.template?.transactions || []);
      await DB.query(`
        INSERT INTO blocks_templates (id, template, version)
        VALUE (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          template = ?,
          version = ?
      `, [blockId, transactions, params.version, transactions, params.version]);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Cannot save block template for ${blockId} because it has already been indexed, ignoring`);
      } else {
        logger.warn(`Cannot save block template for ${blockId}. Reason: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  public async $getTemplate(id: string): Promise<BlockSummary | undefined> {
    try {
      const [templates]: any[] = await DB.query(`SELECT * from blocks_templates WHERE id = ?`, [id]);
      if (templates.length > 0) {
        return {
          id: templates[0].id,
          transactions: JSON.parse(templates[0].template),
          version: templates[0].version,
        };
      }
    } catch (e) {
      logger.err(`Cannot get block template for block id ${id}. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return undefined;
  }

  public async $getIndexedSummariesId(): Promise<string[]> {
    try {
      const [rows] = await DB.query(`SELECT id from blocks_summaries`) as RowDataPacket[][];
      return rows.map(row => row.id);
    } catch (e) {
      logger.err(`Cannot get block summaries id list. Reason: ` + (e instanceof Error ? e.message : e));
    }

    return [];
  }

  public async $getSummariesWithVersion(version: number): Promise<{ height: number, id: string }[]> {
    try {
      const [rows]: any[] = await DB.query(`
        SELECT
          height,
          id
        FROM blocks_summaries
        WHERE version = ?
        ORDER BY height DESC;`, [version]);
      return rows;
    } catch (e) {
      logger.err(`Cannot get block summaries with version. Reason: ` + (e instanceof Error ? e.message : e));
    }

    return [];
  }

  public async $getTemplatesWithVersion(version: number): Promise<{ height: number, id: string }[]> {
    try {
      const [rows]: any[] = await DB.query(`
        SELECT
          blocks_summaries.height as height,
          blocks_templates.id as id
        FROM blocks_templates
        JOIN blocks_summaries ON blocks_templates.id = blocks_summaries.id
        WHERE blocks_templates.version = ?
        ORDER BY height DESC;`, [version]);
      return rows;
    } catch (e) {
      logger.err(`Cannot get block summaries with version. Reason: ` + (e instanceof Error ? e.message : e));
    }

    return [];
  }

  public async $getSummariesBelowVersion(version: number): Promise<{ height: number, id: string, version: number }[]> {
    try {
      const [rows]: any[] = await DB.query(`
        SELECT
          height,
          id,
          version
        FROM blocks_summaries
        WHERE version < ?
        ORDER BY height DESC;`, [version]);
      return rows;
    } catch (e) {
      logger.err(`Cannot get block summaries below version. Reason: ` + (e instanceof Error ? e.message : e));
    }

    return [];
  }

  public async $getTemplatesBelowVersion(version: number): Promise<{ height: number, id: string, version: number }[]> {
    try {
      const [rows]: any[] = await DB.query(`
        SELECT
          blocks_summaries.height as height,
          blocks_templates.id as id,
          blocks_templates.version as version
        FROM blocks_templates
        JOIN blocks_summaries ON blocks_templates.id = blocks_summaries.id
        WHERE blocks_templates.version < ?
        ORDER BY height DESC;`, [version]);
      return rows;
    } catch (e) {
      logger.err(`Cannot get block summaries below version. Reason: ` + (e instanceof Error ? e.message : e));
    }

    return [];
  }

  /**
   * Get the fee percentiles if the block has already been indexed, [] otherwise
   * 
   * @param id 
   */
  public async $getFeePercentilesByBlockId(id: string): Promise<number[] | null> {
    try {
      const [rows]: any[] = await DB.query(`
        SELECT transactions
        FROM blocks_summaries
        WHERE id = ?`,
        [id]
      );
      if (rows === null || rows.length === 0) {
        return null;
      }

      const transactions = JSON.parse(rows[0].transactions);
      if (transactions === null) {
        return null;
      }

      transactions.shift(); // Ignore coinbase
      transactions.sort((a: any, b: any) => a.fee - b.fee);
      const fees = transactions.map((t: any) => t.fee);

      return [
        fees[0] ?? 0, // min
        fees[Math.max(0, Math.floor(fees.length * 0.1) - 1)] ?? 0, // 10th
        fees[Math.max(0, Math.floor(fees.length * 0.25) - 1)] ?? 0, // 25th
        fees[Math.max(0, Math.floor(fees.length * 0.5) - 1)] ?? 0, // median
        fees[Math.max(0, Math.floor(fees.length * 0.75) - 1)] ?? 0, // 75th
        fees[Math.max(0, Math.floor(fees.length * 0.9) - 1)] ?? 0, // 90th
        fees[fees.length - 1] ?? 0, // max
      ];

    } catch (e) {
      logger.err(`Cannot get block summaries transactions. Reason: ` + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  public async $isSummaryIndexed(id: string): Promise<boolean> {
    if (!Common.blocksSummariesIndexingEnabled()) {
      return false;
    }
    try {
      const [rows]: any[] = await DB.query(`SELECT id from blocks_summaries WHERE id = ?`, [id]);
      return rows.length > 0;
    } catch (e) {
      logger.err(`Cannot check if block summary is indexed. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return false;
  }
}

export default new BlocksSummariesRepository();

