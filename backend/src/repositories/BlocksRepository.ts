import { BlockExtended, PoolTag } from '../mempool.interfaces';
import { DB } from '../database';
import logger from '../logger';
import { Common } from '../api/common';
import { prepareBlock } from '../utils/blocks-utils';

class BlocksRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveBlockInDatabase(block: BlockExtended) {
    const connection = await DB.getConnection();

    try {
      const query = `INSERT INTO blocks(
        height,           hash,                blockTimestamp, size,
        weight,           tx_count,            coinbase_raw,   difficulty,
        pool_id,          fees,                fee_span,       median_fee,
        reward,           version,             bits,           nonce,
        merkle_root,      previous_block_hash, avg_fee,        avg_fee_rate
      ) VALUE (
        ?, ?, FROM_UNIXTIME(?), ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )`;

      const params: any[] = [
        block.height,
        block.id,
        block.timestamp,
        block.size,
        block.weight,
        block.tx_count,
        block.extras.coinbaseRaw,
        block.difficulty,
        block.extras.pool?.id, // Should always be set to something
        block.extras.totalFees,
        JSON.stringify(block.extras.feeRange),
        block.extras.medianFee,
        block.extras.reward,
        block.version,
        block.bits,
        block.nonce,
        block.merkle_root,
        block.previousblockhash,
        block.extras.avgFee,
        block.extras.avgFeeRate,
      ];

      await connection.query(query, params);
      connection.release();
    } catch (e: any) {
      connection.release();
      if (e.errno === 1062) { // ER_DUP_ENTRY
        logger.debug(`$saveBlockInDatabase() - Block ${block.height} has already been indexed, ignoring`);
      } else {
        connection.release();
        logger.err('$saveBlockInDatabase() error: ' + (e instanceof Error ? e.message : e));
        throw e;
      }
    }
  }

  /**
   * Get all block height that have not been indexed between [startHeight, endHeight]
   */
  public async $getMissingBlocksBetweenHeights(startHeight: number, endHeight: number): Promise<number[]> {
    if (startHeight < endHeight) {
      return [];
    }

    const connection = await DB.getConnection();
    try {
      const [rows]: any[] = await connection.query(`
        SELECT height
        FROM blocks
        WHERE height <= ? AND height >= ?
        ORDER BY height DESC;
      `, [startHeight, endHeight]);
      connection.release();

      const indexedBlockHeights: number[] = [];
      rows.forEach((row: any) => { indexedBlockHeights.push(row.height); });
      const seekedBlocks: number[] = Array.from(Array(startHeight - endHeight + 1).keys(), n => n + endHeight).reverse();
      const missingBlocksHeights = seekedBlocks.filter(x => indexedBlockHeights.indexOf(x) === -1);

      return missingBlocksHeights;
    } catch (e) {
      connection.release();
      logger.err('$getMissingBlocksBetweenHeights() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get empty blocks for one or all pools
   */
  public async $countEmptyBlocks(poolId: number | null, interval: string | null = null): Promise<any> {
    interval = Common.getSqlInterval(interval);

    const params: any[] = [];
    let query = `SELECT count(height) as count, pools.id as poolId
      FROM blocks
      JOIN pools on pools.id = blocks.pool_id
      WHERE tx_count = 1`;

    if (poolId) {
      query += ` AND pool_id = ?`;
      params.push(poolId);
    }

    if (interval) {
      query += ` AND blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += ` GROUP by pools.id`;

    const connection = await DB.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      connection.release();

      return rows;
    } catch (e) {
      connection.release();
      logger.err('$getEmptyBlocks() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get blocks count for a period
   */
  public async $blockCount(poolId: number | null, interval: string | null = null): Promise<number> {
    interval = Common.getSqlInterval(interval);

    const params: any[] = [];
    let query = `SELECT count(height) as blockCount
      FROM blocks`;

    if (poolId) {
      query += ` WHERE pool_id = ?`;
      params.push(poolId);
    }

    if (interval) {
      if (poolId) {
        query += ` AND`;
      } else {
        query += ` WHERE`;
      }
      query += ` blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    const connection = await DB.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      connection.release();

      return <number>rows[0].blockCount;
    } catch (e) {
      connection.release();
      logger.err('$blockCount() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get blocks count between two dates
   * @param poolId
   * @param from - The oldest timestamp
   * @param to - The newest timestamp
   * @returns
   */
  public async $blockCountBetweenTimestamp(poolId: number | null, from: number, to: number): Promise<number> {
    const params: any[] = [];
    let query = `SELECT
      count(height) as blockCount,
      max(height) as lastBlockHeight
      FROM blocks`;

    if (poolId) {
      query += ` WHERE pool_id = ?`;
      params.push(poolId);
    }

    if (poolId) {
      query += ` AND`;
    } else {
      query += ` WHERE`;
    }
    query += ` blockTimestamp BETWEEN FROM_UNIXTIME('${from}') AND FROM_UNIXTIME('${to}')`;

    const connection = await DB.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      connection.release();

      return <number>rows[0];
    } catch (e) {
      connection.release();
      logger.err('$blockCountBetweenTimestamp() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get the oldest indexed block
   */
  public async $oldestBlockTimestamp(): Promise<number> {
    const query = `SELECT UNIX_TIMESTAMP(blockTimestamp) as blockTimestamp
      FROM blocks
      ORDER BY height
      LIMIT 1;`;

    const connection = await DB.getConnection();
    try {
      const [rows]: any[] = await connection.query(query);
      connection.release();

      if (rows.length <= 0) {
        return -1;
      }

      return <number>rows[0].blockTimestamp;
    } catch (e) {
      connection.release();
      logger.err('$oldestBlockTimestamp() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get blocks mined by a specific mining pool
   */
  public async $getBlocksByPool(poolId: number, startHeight: number | undefined = undefined): Promise<object[]> {
    const params: any[] = [];
    let query = ` SELECT *, UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp,
      previous_block_hash as previousblockhash
      FROM blocks
      WHERE pool_id = ?`;
    params.push(poolId);

    if (startHeight !== undefined) {
      query += ` AND height < ?`;
      params.push(startHeight);
    }

    query += ` ORDER BY height DESC
      LIMIT 10`;

    const connection = await DB.getConnection();
    try {
      const [rows] = await connection.query(query, params);
      connection.release();

      const blocks: BlockExtended[] = [];
      for (let block of <object[]>rows) {
        blocks.push(prepareBlock(block));
      }

      return blocks;
    } catch (e) {
      connection.release();
      logger.err('$getBlocksByPool() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get one block by height
   */
  public async $getBlockByHeight(height: number): Promise<object | null> {
    const connection = await DB.getConnection();
    try {
      const [rows]: any[] = await connection.query(`
        SELECT *, UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp,
        pools.id as pool_id, pools.name as pool_name, pools.link as pool_link,
        pools.addresses as pool_addresses, pools.regexes as pool_regexes,
        previous_block_hash as previousblockhash
        FROM blocks
        JOIN pools ON blocks.pool_id = pools.id
        WHERE height = ${height};
      `);
      connection.release();

      if (rows.length <= 0) {
        return null;
      }

      return rows[0];
    } catch (e) {
      connection.release();
      logger.err('$getBlockByHeight() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Return blocks difficulty
   */
  public async $getBlocksDifficulty(interval: string | null): Promise<object[]> {
    interval = Common.getSqlInterval(interval);

    const connection = await DB.getConnection();

    // :D ... Yeah don't ask me about this one https://stackoverflow.com/a/40303162
    // Basically, using temporary user defined fields, we are able to extract all
    // difficulty adjustments from the blocks tables.
    // This allow use to avoid indexing it in another table.
    let query = `
      SELECT
      *
      FROM
      (
        SELECT
        UNIX_TIMESTAMP(blockTimestamp) as timestamp, difficulty, height,
        IF(@prevStatus = YT.difficulty, @rn := @rn + 1,
          IF(@prevStatus := YT.difficulty, @rn := 1, @rn := 1)
        ) AS rn
        FROM blocks YT
        CROSS JOIN
        (
          SELECT @prevStatus := -1, @rn := 1
        ) AS var
    `;

    if (interval) {
      query += ` WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
    }

    query += `
        ORDER BY YT.height
      ) AS t
      WHERE t.rn = 1
      ORDER BY t.height
    `;

    try {
      const [rows]: any[] = await connection.query(query);
      connection.release();

      for (let row of rows) {
        delete row['rn'];
      }

      return rows;
    } catch (e) {
      connection.release();
      logger.err('$getBlocksDifficulty() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  public async $getOldestIndexedBlockHeight(): Promise<number> {
    const connection = await DB.getConnection();
    try {
      const [rows]: any[] = await connection.query(`SELECT MIN(height) as minHeight FROM blocks`);
      connection.release();

      return rows[0].minHeight;
    } catch (e) {
      connection.release();
      logger.err('$getOldestIndexedBlockHeight() error' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new BlocksRepository();
