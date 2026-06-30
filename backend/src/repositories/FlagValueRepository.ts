import { Common } from '../api/common';
import DB from '../database';
import logger from '../logger';

class FlagValuesRepository {
  /**
   * Get the latest indexed day from the database
   *
   * @asyncSafe */
  public async $getTipAndTailIndexedByBlocksCount(blocksCount: string): Promise<{tip: number, tail: number} | null> {
    try {
      const [rows]: any[] = await DB.query(`SELECT (MAX(start_height) + ?) as tip, MIN(start_height) as tail FROM flag_values WHERE blocks_count = ?`, [parseInt(blocksCount, 10), blocksCount]);
      if (rows !== null && rows.length > 0 && rows[0].tip !== null && rows[0].tail !== null) {
        return rows[0];
      }
    } catch (e) {
      logger.err(`Cannot get tip and tail indexed from flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return null;
  }

  public async $saveBatchFlagValues(blocksCount: string, startHeight: number, txCount: Record<string, number>): Promise<void> {
    const params: any[] = [];
    const flags = Object.keys(txCount);
    for (const flag of flags) {
      params.push([blocksCount, startHeight, BigInt(flag), txCount[flag]]);
    }
    try {
      await DB.query(`
        INSERT INTO flag_values (blocks_count, start_height, flag_value, tx_count) VALUES ?
        ON DUPLICATE KEY UPDATE
        tx_count = VALUES(tx_count)
        `, [params]);
    } catch (e) {
      logger.debug(`Cannot save flag batched values. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $saveFlagValue(blocksCount: string, startHeight: number, flags: bigint, txCount: number): Promise<void> {
    try {
      await DB.query(`
        INSERT INTO flag_values 
        SET blocks_count = ?, start_height = ?, flag_value = ?, tx_count = ?
        ON DUPLICATE KEY UPDATE
        tx_count = ?
        `, [blocksCount, startHeight, flags, txCount, txCount]);
    } catch (e) {
      logger.debug(`Cannot save flag values. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $queryTxCountBasedOnMask(mask: bigint, blocksCount: string, op: string, startHeight: number): Promise<{blocksCount: string, startHeight: number, txCount: number}[]> {
    let booleanClause = '';
    let params: any[]= [];
    switch (op) {
      case 'and': {
        booleanClause = ' (flag_value & ?) = ? AND ';
        params = [mask, mask];
      } break;
      case 'or': {
        booleanClause = ' (flag_value & ?) > 0 AND ';
        params = [mask];
      } break;
      case 'nor': {
        booleanClause = ' (flag_value & ?) = 0 AND ';
        params = [mask];
      } break;
      case undefined: { // op not passed, no boolean operations
        break;
      }
      default: throw new Error(`Invalid op '${op}', expected 'and' | 'or' | 'nor'`);
    }
    params.push(blocksCount);
    params.push(startHeight);
    try {
      const [rows]: any[] = await DB.query(`
        SELECT blocks_count, start_height, SUM(tx_count) AS tx_count FROM flag_values
        WHERE ${booleanClause} blocks_count = ? AND start_height > ?
        GROUP BY start_height ORDER BY start_height DESC
        `, params);
      if (rows !== null && rows.length > 0) {
        return rows;
      }
    } catch (e) {
      logger.debug(`Cannot get tx counts. Reason: ${e instanceof Error ? e.message : e}`);
    }
    return [];
  }

  public async $deleteFlagValuesBelowHeight(height: number, blocksCount: string):  Promise<void> {
    try {
      await DB.query(`DELETE FROM flag_values WHERE start_height < ? AND blocks_count = ?`, [height, blocksCount]);
    } catch(e) {
      logger.err(`Cannot delete flag values below block #${height}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }
}

export default new FlagValuesRepository();