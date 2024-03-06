import { AccelerationInfo } from '../api/acceleration';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import DB from '../database';
import logger from '../logger';
import { IEsploraApi } from '../api/bitcoin/esplora-api.interface';
import { Common } from '../api/common';
import config from '../config';

export interface PublicAcceleration {
  txid: string,
  height: number,
  pool: {
    id: number,
    slug: string,
    name: string,
  },
  effective_vsize: number,
  effective_fee: number,
  boost_rate: number,
  boost_cost: number,
}

class AccelerationRepository {
  public async $saveAcceleration(acceleration: AccelerationInfo, block: IEsploraApi.Block, pool_id: number): Promise<void> {
    try {
      await DB.query(`
        INSERT INTO accelerations(txid, added, height, pool, effective_vsize, effective_fee, boost_rate, boost_cost)
        VALUE (?, FROM_UNIXTIME(?), ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          added = FROM_UNIXTIME(?),
          height = ?,
          pool = ?,
          effective_vsize = ?,
          effective_fee = ?,
          boost_rate = ?,
          boost_cost = ?
      `, [
        acceleration.txSummary.txid,
        block.timestamp,
        block.height,
        pool_id,
        acceleration.txSummary.effectiveVsize,
        acceleration.txSummary.effectiveFee,
        acceleration.targetFeeRate, acceleration.cost,
        block.timestamp,
        block.height,
        pool_id,
        acceleration.txSummary.effectiveVsize,
        acceleration.txSummary.effectiveFee,
        acceleration.targetFeeRate, acceleration.cost,
      ]);
    } catch (e: any) {
      logger.err(`Cannot save acceleration (${acceleration.txSummary.txid}) into db. Reason: ` + (e instanceof Error ? e.message : e));
      // We don't throw, not a critical issue if we miss some accelerations
    }
  }

  public async $getAccelerationInfo(poolSlug: string | null = null, height: number | null = null, interval: string | null = null): Promise<PublicAcceleration[]> {
    interval = Common.getSqlInterval(interval);

    if (!config.MEMPOOL_SERVICES.ACCELERATIONS || (interval == null && poolSlug == null && height == null)) {
      return [];
    }

    let query = `
      SELECT * FROM accelerations
      JOIN pools on pools.unique_id = accelerations.pool
    `;
    let params: any[] = [];

    if (interval) {
      query += ` WHERE accelerations.added BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW() `;
    } else if (height != null) {
      query += ` WHERE accelerations.height = ? `;
      params.push(height);
    } else if (poolSlug != null) {
      query += ` WHERE pools.slug = ? `;
      params.push(poolSlug);
    }

    query += ` ORDER BY accelerations.added DESC `;

    try {
      const [rows] = await DB.query(query, params) as RowDataPacket[][];
      if (rows?.length) {
        return rows.map(row => ({
          txid: row.txid,
          height: row.height,
          pool: {
            id: row.id,
            slug: row.slug,
            name: row.name,
          },
          effective_vsize: row.effective_vsize,
          effective_fee: row.effective_fee,
          boost_rate: row.boost_rate,
          boost_cost: row.boost_cost,
        }));
      } else {
        return [];
      }
    } catch (e) {
      logger.err(`Cannot query acceleration info. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new AccelerationRepository();
