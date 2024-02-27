import { AccelerationInfo } from '../api/acceleration';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import DB from '../database';
import logger from '../logger';
import { IEsploraApi } from '../api/bitcoin/esplora-api.interface';

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
}

export default new AccelerationRepository();
