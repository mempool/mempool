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

  public async $saveSummary(height: number, summary: BlockSummary) {
    try {
      await DB.query(`INSERT INTO blocks_summaries VALUE (?, ?, ?)`, [height, summary.id, JSON.stringify(summary.transactions)]);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Cannot save block summary for ${summary.id} because it has already been indexed, ignoring`);
      } else {
        logger.debug(`Cannot save block summary for ${summary.id}. Reason: ${e instanceof Error ? e.message : e}`);
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
}

export default new BlocksSummariesRepository();

