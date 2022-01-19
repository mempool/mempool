import { BlockExtended, PoolTag } from '../mempool.interfaces';
import { DB } from '../database';
import logger from '../logger';

export interface EmptyBlocks {
  emptyBlocks: number;
  poolId: number;
}

class BlocksRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveBlockInDatabase(
    block: BlockExtended,
    blockHash: string,
    coinbaseHex: string | undefined,
    poolTag: PoolTag
  ) {
    const connection = await DB.pool.getConnection();

    try {
      const query = `INSERT INTO blocks(
        height,  hash,     blockTimestamp, size,
        weight,  tx_count, coinbase_raw,   difficulty,
        pool_id, fees,     fee_span,       median_fee
      ) VALUE (
        ?, ?, FROM_UNIXTIME(?), ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )`;

      const params: any[] = [
        block.height, blockHash, block.timestamp, block.size,
        block.weight, block.tx_count, coinbaseHex ? coinbaseHex : '', block.difficulty,
        poolTag.id, 0, '[]', block.medianFee,
      ];

      await connection.query(query, params);
    } catch (e) {
      logger.err('$updateBlocksDatabase() error' + (e instanceof Error ? e.message : e));
    }

    connection.release();
  }

  /**
   * Get all block height that have not been indexed between [startHeight, endHeight]
   */
  public async $getMissingBlocksBetweenHeights(startHeight: number, endHeight: number): Promise<number[]> {
    const connection = await DB.pool.getConnection();
    const [rows] : any[] = await connection.query(`
      SELECT height
      FROM blocks
      WHERE height <= ${startHeight} AND height >= ${endHeight}
      ORDER BY height DESC;
    `);
    connection.release();

    const indexedBlockHeights: number[] = [];
    rows.forEach((row: any) => { indexedBlockHeights.push(row.height); });
    const seekedBlocks: number[] = Array.from(Array(startHeight - endHeight + 1).keys(), n => n + endHeight).reverse();
    const missingBlocksHeights =  seekedBlocks.filter(x => indexedBlockHeights.indexOf(x) === -1);

    return missingBlocksHeights;
  }

  /**
   * Count empty blocks for all pools
   */
  public async $countEmptyBlocks(interval: string = '100 YEAR'): Promise<EmptyBlocks[]> {
    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query(`
      SELECT pool_id as poolId
      FROM blocks
      WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()
      AND tx_count = 1;
    `);
    connection.release();

    return <EmptyBlocks[]>rows;
  }

  /**
   * Get blocks count for a period
   */
   public async $blockCount(interval: string = '100 YEAR'): Promise<number> {
    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query(`
      SELECT count(height) as blockCount
      FROM blocks
      WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW();
    `);
    connection.release();

    return <number>rows[0].blockCount;
  }
}

export default new BlocksRepository();