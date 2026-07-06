import { Common } from '../api/common';
import DB from '../database';
import logger from '../logger';

class FlagValuesRepository {
  /**
   * Get the latest indexed day from the database
   *
   * @asyncSafe */
  public async $getTipAndTailIndexedByBlocksCount(blocksCount: number): Promise<{tip: number, tail: number} | null> {
    try {
      const [rows]: any[] = await DB.query(`SELECT (MAX(start_height) + ?) as tip, MIN(start_height) as tail FROM flag_values WHERE blocks_count = ?`, [blocksCount, blocksCount.toString()]);
      if (rows !== null && rows.length > 0 && rows[0].tip !== null && rows[0].tail !== null) {
        return rows[0];
      }
    } catch (e) {
      logger.err(`Cannot get tip and tail indexed from flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return null;
  }

  /**
   * Get the set of bucket that area already indexed between heights by blocksCount
   *
   * @asyncSafe */
  public async $getIndexedStartHeights(blocksCount: number, fromHeight: number, toHeight: number): Promise<number[]> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT DISTINCT start_height FROM flag_values WHERE blocks_count = ? AND start_height >= ? AND start_height <= ?`,
        [blocksCount.toString(), fromHeight, toHeight]
      );
      return rows.map(row => row.start_height);
    } catch (e) {
      logger.err(`Cannot get indexed start heights from flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return [];
  }

  public async $saveBatchFlagValues(blocksCount: number, startHeight: number, txCount: Record<string, number>): Promise<void> {
    const params: any[] = [];
    const flags = Object.keys(txCount);
    for (const flag of flags) {
      params.push([blocksCount.toString(), startHeight, BigInt(flag), txCount[flag]]);
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

  public async $queryTxCountBasedOnMask(mask: bigint, blocksCount: number, op: 'and' | 'or' | 'nor' | undefined, startHeight: number): Promise<{blocksCount: string, startHeight: number, txCount: number}[]> {
    let sumField = '';
    let params: any[]= [];
    switch (op) {
      case 'and': {
        sumField = 'CASE WHEN (flag_value & ?) = ? THEN tx_count ELSE 0 END';
        params = [mask, mask];
      } break;
      case 'or': {
        sumField = 'CASE WHEN (flag_value & ?) > 0 THEN tx_count ELSE 0 END';
        params = [mask];
      } break;
      case 'nor': {
        sumField = 'CASE WHEN (flag_value & ?) = 0 THEN tx_count ELSE 0 END';
        params = [mask];
      } break;
      case undefined: { // op not passed, no boolean operations
        sumField = 'tx_count';
        break;
      }
      default: throw new Error(`Invalid op '${op}', expected 'and' | 'or' | 'nor' | undefined`);
    }
    params.push(blocksCount.toString());
    params.push(startHeight);
    try {
      const [rows]: any[] = await DB.query(`
        SELECT blocks_count as blocksCount, start_height as startHeight, SUM(${sumField}) AS txCount FROM flag_values
        WHERE blocks_count = ? AND start_height >= ?
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

  public async $deleteFlagValuesBelowHeight(height: number, blocksCount: number):  Promise<void> {
    try {
      await DB.query(`DELETE FROM flag_values WHERE start_height < ? AND blocks_count = ?`, [height, blocksCount.toString()]);
    } catch(e) {
      logger.err(`Cannot delete flag values below block #${height}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  public async $deleteFlagValuesFromHeight(height: number): Promise<void> {
    const startHeights = {
      '1': height,
      '36': Math.floor(height / 36) * 36,
      '144': Math.floor(height / 144) * 144,
      '720': Math.floor(height / 720) * 720
    };
    const bucketSizes = Object.keys(startHeights);

    try {
      for (const bucketSize of bucketSizes) {
        await DB.query(`DELETE FROM flag_values WHERE start_height >= ? AND blocks_count = ?`, [startHeights[bucketSize], bucketSize]);
      }
    } catch (e) {
      logger.err(`Cannot delete flag values above ${height}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }
}

export default new FlagValuesRepository();