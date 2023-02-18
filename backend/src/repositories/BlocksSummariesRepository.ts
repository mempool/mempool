import DB from '../database';
import logger from '../logger';
import { BlockSummary } from '../mempool.interfaces';

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

  public async $saveSummary(params: { height: number, mined?: BlockSummary}) {
    const blockId = params.mined?.id;
    try {
      const transactions = JSON.stringify(params.mined?.transactions || []);
      await DB.query(`
        INSERT INTO blocks_summaries (height, id, transactions, template)
        VALUE (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          transactions = ?
      `, [params.height, blockId, transactions, '[]', transactions]);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Cannot save block summary for ${blockId} because it has already been indexed, ignoring`);
      } else {
        logger.debug(`Cannot save block summary for ${blockId}. Reason: ${e instanceof Error ? e.message : e}`);
        throw e;
      }
    }
  }

  public async $saveTemplate(params: { height: number, template: BlockSummary}) {
    const blockId = params.template?.id;
    try {
      const transactions = JSON.stringify(params.template?.transactions || []);
      await DB.query(`
        INSERT INTO blocks_summaries (height, id, transactions, template)
        VALUE (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          template = ?
      `, [params.height, blockId, '[]', transactions, transactions]);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Cannot save block template for ${blockId} because it has already been indexed, ignoring`);
      } else {
        logger.debug(`Cannot save block template for ${blockId}. Reason: ${e instanceof Error ? e.message : e}`);
        throw e;
      }
    }
  }

  public async $getIndexedSummariesId(): Promise<string[]> {
    try {
      const [rows]: any[] = await DB.query(`SELECT id from blocks_summaries`);
      return rows.map(row => row.id);
    } catch (e) {
      logger.err(`Cannot get block summaries id list. Reason: ` + (e instanceof Error ? e.message : e));
    }

    return [];
  }

  /**
   * Delete blocks from the database from blockHeight
   */
  public async $deleteBlocksFrom(blockHeight: number) {
    logger.info(`Delete newer blocks summary from height ${blockHeight} from the database`);

    try {
      await DB.query(`DELETE FROM blocks_summaries where height >= ${blockHeight}`);
    } catch (e) {
      logger.err('Cannot delete indexed blocks summaries. Reason: ' + (e instanceof Error ? e.message : e));
    }
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
        fees[0], // min
        fees[Math.max(0, Math.floor(fees.length * 0.1) - 1)], // 10th
        fees[Math.max(0, Math.floor(fees.length * 0.25) - 1)], // 25th
        fees[Math.max(0, Math.floor(fees.length * 0.5) - 1)], // median
        fees[Math.max(0, Math.floor(fees.length * 0.75) - 1)], // 75th
        fees[Math.max(0, Math.floor(fees.length * 0.9) - 1)], // 90th
        fees[fees.length - 1], // max
      ];

    } catch (e) {
      logger.err(`Cannot get block summaries transactions. Reason: ` + (e instanceof Error ? e.message : e));
      return null;
    }
  }
}

export default new BlocksSummariesRepository();

