import DB from '../database';
import logger from '../logger';

export const INDEXING_PRESETS = [
  {name: 'per block', bucketSize: 1,  retentionSpan: 144}, // block span of ~1 day
  {name: 'per week', bucketSize: 1008, retentionSpan: -1}, // all
  {name: 'per month', bucketSize: 4032, retentionSpan: -1}, // all
];

export const INTERVAL_PRESETS = {
  '24h': {retentionSpan: 144, bucketSizes: [1]},
  '6m': {retentionSpan: 24192, bucketSizes: [1008, 4032]},
  '1y': {retentionSpan: 48384, bucketSizes: [1008, 4032]},
  '2y': {retentionSpan: 96768, bucketSizes: [1008, 4032]},
  '3y': {retentionSpan: 145152, bucketSizes: [1008, 4032]},
  'all': {retentionSpan: -1, bucketSizes: [1008, 4032]},
};

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
  public async $getIndexedStartHeights(bucketSize: number, startHeight: number, latestHeight: number): Promise<number[]> {
    try {
      const [rows]: any[] = await DB.query(
        `SELECT DISTINCT start_height FROM flag_values WHERE bucket_size = ? AND start_height <= ? AND start_height >= ?`,
        [bucketSize.toString(), startHeight, latestHeight]
      );
      return rows.map(row => row.start_height);
    } catch (e) {
      logger.err(`Cannot get indexed start heights from flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return [];
  }

  public async $saveBatchFlagValues(bucketSize: number, startHeight: number, dataPerFlag: Record<string, Record<string, number>>, avgTimestamp: number): Promise<void> {
    const params: any[] = [];
    const distinctFlags = Object.keys(dataPerFlag);
    const avgDate = new Date(Math.round(avgTimestamp) * 1000);
    for (const flag of distinctFlags) {
      params.push([bucketSize.toString(), startHeight, avgDate, BigInt(flag), dataPerFlag[flag].txCount, dataPerFlag[flag].vSizeTotal]);
    }
    try {
      await DB.query(`
        INSERT INTO flag_values (bucket_size, start_height, avg_timestamp, flag_value, tx_count, vsize_total) VALUES ?
        ON DUPLICATE KEY UPDATE
        avg_timestamp = VALUES(avg_timestamp), tx_count = VALUES(tx_count), vsize_total = VALUES(vsize_total)
        `, [params]);
    } catch (e) {
      logger.debug(`Cannot save flag batched values. Reason: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
  }

  public async $queryTxCountBasedOnMask(mask: bigint, bucketSize: number, op: 'and' | 'or' | 'nor' | undefined, startHeight: number): Promise<{bucketSize: string, startHeight: number, avgTimestamp: number, txCount: number, vSizeTotal: number}[]> {
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
        SELECT bucket_size as bucketSize, start_height as startHeight, UNIX_TIMESTAMP(avg_timestamp) as avgTimestamp,
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

  /** @asyncSafe */
  public async $deleteFlagValuesBelowHeight(height: number, bucketSize: number):  Promise<void> {
    try {
      await DB.query(`DELETE FROM flag_values WHERE start_height < ? AND bucket_size = ?`, [height, bucketSize.toString()]);
    } catch(e) {
      logger.err(`Cannot delete flag values below block #${height}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  /** @asyncSafe */
  public async $deleteFlagValuesFromHeight(height: number): Promise<void> {
    try {
      for (const preset of INDEXING_PRESETS) {
        const startHeight = Math.floor(height / preset.bucketSize) * preset.bucketSize;
        await DB.query(`DELETE FROM flag_values WHERE start_height >= ? AND bucket_size = ?`, [startHeight, preset.bucketSize.toString()]);
      }
    } catch (e) {
      logger.err(`Cannot delete flag values above ${height}. Reason: ` + (e instanceof Error ? e.message : e));
    }
  }

  public async $getTotalBlocksIndexedByBucketSize(bucketSize: number): Promise<number | null> {
    try {
      const [rows]: any[] = await DB.query(`SELECT (count(distinct start_height) * ?) as total FROM flag_values WHERE bucket_size = ?`, [bucketSize, bucketSize.toString()]);
      if (rows !== null && rows.length > 0) {
        return rows[0].total;
      }
    } catch (e) {
      logger.err(`Cannot get total blocks indexed in flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return null;
  }
}

export default new FlagValuesRepository();
