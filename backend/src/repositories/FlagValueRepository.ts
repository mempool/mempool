import { Common } from '../api/common';
import DB from '../database';
import logger from '../logger';

class FlagValuesRepository {
  /**
   * Get the latest indexed day from the database
   *
   * @asyncSafe */
  public async $getMaxIndexedDayBucket(): Promise<number | undefined> {
    if (!Common.blocksSummariesIndexingEnabled()) {
      return undefined;
    }

    try {
      const [rows]: any[] = await DB.query(`SELECT max(day_bucket) AS top_day FROM flag_values WHERE grouped_time = 1`);
      if (rows.length > 0) {
        return rows[0].top_day;
      }
    } catch (e) {
      logger.err(`Cannot get maximum indexed day bucket from flag_values. Reason: ` + (e instanceof Error ? e.message : e));
    }
    return undefined;
  }
}

export default new FlagValuesRepository();