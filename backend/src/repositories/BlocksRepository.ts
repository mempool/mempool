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
        block.height,
        blockHash,
        block.timestamp,
        block.size,
        block.weight,
        block.tx_count,
        coinbaseHex ? coinbaseHex : '',
        block.difficulty,
        poolTag.id,
        0,
        '[]',
        block.extra ? block.extra.medianFee : 0,
      ];

      await connection.query(query, params);
    } catch (e) {
      logger.err('$saveBlockInDatabase() error' + (e instanceof Error ? e.message : e));
    }

    connection.release();
  }

  /**
   * Get all block height that have not been indexed between [startHeight, endHeight]
   */
  public async $getMissingBlocksBetweenHeights(startHeight: number, endHeight: number): Promise<number[]> {
    if (startHeight < endHeight) {
      return [];
    }

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
  public async $countEmptyBlocks(interval: string | null): Promise<EmptyBlocks[]> {
    const query = `
      SELECT pool_id as poolId
      FROM blocks
      WHERE tx_count = 1` +
      (interval != null ? ` AND blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()` : ``)
    ;

    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query(query);
    connection.release();

    return <EmptyBlocks[]>rows;
  }

  /**
   * Get blocks count for a period
   */
   public async $blockCount(interval: string | null): Promise<number> {
    const query = `
      SELECT count(height) as blockCount
      FROM blocks` +
      (interval != null ? ` WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()` : ``)
    ;

    const connection = await DB.pool.getConnection();
    const [rows] = await connection.query(query);
    connection.release();

    return <number>rows[0].blockCount;
  }

  /**
   * Get the oldest indexed block
   */
  public async $oldestBlockTimestamp(): Promise<number> {
    const connection = await DB.pool.getConnection();
    const [rows]: any[] = await connection.query(`
      SELECT blockTimestamp
      FROM blocks
      ORDER BY height
      LIMIT 1;
    `);
    connection.release();

    if (rows.length <= 0) {
      return -1;
    }

    return <number>rows[0].blockTimestamp;
  }
}

export default new BlocksRepository();