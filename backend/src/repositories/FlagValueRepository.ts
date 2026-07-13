import { Common } from '../api/common';
import DB from '../database';
import logger from '../logger';

class FlagValuesRepository {
  /**
   * Get the latest indexed day from the database
   *
   * @asyncSafe */
  public async $getTipAndTailIndexedByBucketSize(bucketSize: number): Promise<{tip: number, tail: number} | null> {
    try {
      const [rows]: any[] = await DB.query(`SELECT (MAX(start_height) + ?) as tip, MIN(start_height) as tail FROM flag_values WHERE bucket_size = ?`, [bucketSize, bucketSize.toString()]);
      if (rows !== null && rows.length > 0 && rows[0].tip !== null && rows[0].tail !== null) {
        return rows[0];
      }
    } catch (e) {
      logger.err(`Cannot get tip and tail indexed from flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return null;
  }

  /**
   * Get the set of bucket that area already indexed between heights by bucketSize
   *
   * @asyncSafe */
  public async $getIndexedStartHeights(bucketSize: number, fromHeight: number, toHeight: number): Promise<number[]> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT DISTINCT start_height FROM flag_values WHERE bucket_size = ? AND start_height >= ? AND start_height <= ?`,
        [bucketSize.toString(), fromHeight, toHeight]
      );
      return rows.map(row => row.start_height);
    } catch (e) {
      logger.err(`Cannot get indexed start heights from flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return [];
  }

  public async $saveBatchFlagValues(bucketSize: number, startHeight: number, dataPerFlag: Record<string, Record<string, number>>): Promise<void> {
    const params: any[] = [];
    const distinctFlags = Object.keys(dataPerFlag);
    for (const flag of distinctFlags) {
      params.push([bucketSize.toString(), startHeight, BigInt(flag), dataPerFlag[flag].txCount, dataPerFlag[flag].vSizeTotal]);
    }
    try {
      await DB.query(`
        INSERT INTO flag_values (bucket_size, start_height, flag_value, tx_count, vsize_total) VALUES ?
        ON DUPLICATE KEY UPDATE
        tx_count = VALUES(tx_count), vsize_total = VALUES(vsize_total)
        `, [params]);
    } catch (e) {
      logger.debug(`Cannot save flag batched values. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $queryTxCountBasedOnMask(mask: bigint, bucketSize: number, op: 'and' | 'or' | 'nor' | undefined, startHeight: number): Promise<{bucketSize: string, startHeight: number, txCount: number, vSizeTotal: number}[]> {
    let flagPredicate = '';
    let params: any[]= [];
    switch (op) {
      case 'and': {
        flagPredicate = 'AND (flag_value & ?) = ?';
        params = [bucketSize.toString(), startHeight, mask, mask];
      } break;
      case 'or': {
        flagPredicate = 'AND (flag_value & ?) > 0';
        params = [bucketSize.toString(), startHeight, mask];
      } break;
      case 'nor': {
        flagPredicate = 'AND (flag_value & ?) = 0';
        params = [bucketSize.toString(), startHeight, mask];
      } break;
      case undefined: { // op not passed, no boolean operations
        params = [bucketSize.toString(), startHeight];
        break;
      }
      default: throw new Error(`Invalid op '${op}', expected 'and' | 'or' | 'nor' | undefined`);
    }
    try {
      const [rows]: any[] = await DB.query(`
        SELECT bucket_size as bucketSize, start_height as startHeight,
          SUM(tx_count) as txCount, SUM(vsize_total) as vSizeTotal
        FROM flag_values
        WHERE bucket_size = ? AND start_height >= ? ${flagPredicate}
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

  public async $deleteFlagValuesBelowHeight(height: number, bucketSize: number):  Promise<void> {
    try {
      await DB.query(`DELETE FROM flag_values WHERE start_height < ? AND bucket_size = ?`, [height, bucketSize.toString()]);
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
        await DB.query(`DELETE FROM flag_values WHERE start_height >= ? AND bucket_size = ?`, [startHeights[bucketSize], bucketSize]);
      }
    } catch (e) {
      logger.err(`Cannot delete flag values above ${height}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }
}

export default new FlagValuesRepository();
