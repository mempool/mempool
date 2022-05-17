import { BlockExtended } from '../mempool.interfaces';
import DB from '../database';
import logger from '../logger';
import { Common } from '../api/common';
import { prepareBlock } from '../utils/blocks-utils';
import PoolsRepository from './PoolsRepository';
import HashratesRepository from './HashratesRepository';

class BlocksRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveBlockInDatabase(block: BlockExtended) {
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

      await DB.query(query, params);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`$saveBlockInDatabase() - Block ${block.height} has already been indexed, ignoring`);
      } else {
        logger.err('Cannot save indexed block into db. Reason: ' + (e instanceof Error ? e.message : e));
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

    try {
      const [rows]: any[] = await DB.query(`
        SELECT height
        FROM blocks
        WHERE height <= ? AND height >= ?
        ORDER BY height DESC;
      `, [startHeight, endHeight]);

      const indexedBlockHeights: number[] = [];
      rows.forEach((row: any) => { indexedBlockHeights.push(row.height); });
      const seekedBlocks: number[] = Array.from(Array(startHeight - endHeight + 1).keys(), n => n + endHeight).reverse();
      const missingBlocksHeights = seekedBlocks.filter(x => indexedBlockHeights.indexOf(x) === -1);

      return missingBlocksHeights;
    } catch (e) {
      logger.err('Cannot retrieve blocks list to index. Reason: ' + (e instanceof Error ? e.message : e));
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

    try {
      const [rows] = await DB.query(query, params);
      return rows;
    } catch (e) {
      logger.err('Cannot count empty blocks. Reason: ' + (e instanceof Error ? e.message : e));
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

    try {
      const [rows] = await DB.query(query, params);
      return <number>rows[0].blockCount;
    } catch (e) {
      logger.err(`Cannot count blocks for this pool (using offset). Reason: ` + (e instanceof Error ? e.message : e));
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

    try {
      const [rows] = await DB.query(query, params);
      return <number>rows[0];
    } catch (e) {
      logger.err(`Cannot count blocks for this pool (using timestamps). Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get blocks count for a period
   */
   public async $blockCountBetweenHeight(startHeight: number, endHeight: number): Promise<number> {
    const params: any[] = [];
    let query = `SELECT count(height) as blockCount
      FROM blocks
      WHERE height <= ${startHeight} AND height >= ${endHeight}`;

    try {
      const [rows] = await DB.query(query, params);
      return <number>rows[0].blockCount;
    } catch (e) {
      logger.err(`Cannot count blocks for this pool (using offset). Reason: ` + (e instanceof Error ? e.message : e));
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

    try {
      const [rows]: any[] = await DB.query(query);

      if (rows.length <= 0) {
        return -1;
      }

      return <number>rows[0].blockTimestamp;
    } catch (e) {
      logger.err('Cannot get oldest indexed block timestamp. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get blocks mined by a specific mining pool
   */
  public async $getBlocksByPool(slug: string, startHeight?: number): Promise<object[]> {
    const pool = await PoolsRepository.$getPool(slug);
    if (!pool) {
      throw new Error(`This mining pool does not exist`);
    }

    const params: any[] = [];
    let query = ` SELECT *, UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp,
      previous_block_hash as previousblockhash
      FROM blocks
      WHERE pool_id = ?`;
    params.push(pool.id);

    if (startHeight !== undefined) {
      query += ` AND height < ?`;
      params.push(startHeight);
    }

    query += ` ORDER BY height DESC
      LIMIT 10`;

    try {
      const [rows] = await DB.query(query, params);

      const blocks: BlockExtended[] = [];
      for (const block of <object[]>rows) {
        blocks.push(prepareBlock(block));
      }

      return blocks;
    } catch (e) {
      logger.err('Cannot get blocks for this pool. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get one block by height
   */
  public async $getBlockByHeight(height: number): Promise<object | null> {
    try {
      const [rows]: any[] = await DB.query(`
        SELECT *, UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp,
        pools.id as pool_id, pools.name as pool_name, pools.link as pool_link, pools.slug as pool_slug,
        pools.addresses as pool_addresses, pools.regexes as pool_regexes,
        previous_block_hash as previousblockhash
        FROM blocks
        JOIN pools ON blocks.pool_id = pools.id
        WHERE height = ${height};
      `);

      if (rows.length <= 0) {
        return null;
      }

      rows[0].fee_span = JSON.parse(rows[0].fee_span);
      return rows[0];
    } catch (e) {
      logger.err(`Cannot get indexed block ${height}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get one block by hash
   */
  public async $getBlockByHash(hash: string): Promise<object | null> {
    try {
      const query = `
        SELECT *, UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp, hash as id,
        pools.id as pool_id, pools.name as pool_name, pools.link as pool_link, pools.slug as pool_slug,
        pools.addresses as pool_addresses, pools.regexes as pool_regexes,
        previous_block_hash as previousblockhash
        FROM blocks
        JOIN pools ON blocks.pool_id = pools.id
        WHERE hash = '${hash}';
      `;
      const [rows]: any[] = await DB.query(query);

      if (rows.length <= 0) {
        return null;
      }

      rows[0].fee_span = JSON.parse(rows[0].fee_span);
      return rows[0];
    } catch (e) {
      logger.err(`Cannot get indexed block ${hash}. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Return blocks difficulty
   */
  public async $getBlocksDifficulty(interval: string | null): Promise<object[]> {
    interval = Common.getSqlInterval(interval);

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
      const [rows]: any[] = await DB.query(query);

      for (const row of rows) {
        delete row['rn'];
      }

      return rows;
    } catch (e) {
      logger.err('Cannot generate difficulty history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get general block stats
   */
  public async $getBlockStats(blockCount: number): Promise<any> {
    try {
      // We need to use a subquery
      const query = `
        SELECT MIN(height) as startBlock, MAX(height) as endBlock, SUM(reward) as totalReward, SUM(fees) as totalFee, SUM(tx_count) as totalTx
        FROM
          (SELECT height, reward, fees, tx_count FROM blocks
          ORDER by height DESC
          LIMIT ?) as sub`;

      const [rows]: any = await DB.query(query, [blockCount]);

      return rows[0];
    } catch (e) {
      logger.err('Cannot generate reward stats. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /*
   * Check if the last 10 blocks chain is valid
   */
  public async $validateRecentBlocks(): Promise<boolean> {
    try {
      const [lastBlocks]: any[] = await DB.query(`SELECT height, hash, previous_block_hash FROM blocks ORDER BY height DESC LIMIT 10`);

      for (let i = 0; i < lastBlocks.length - 1; ++i) {
        if (lastBlocks[i].previous_block_hash !== lastBlocks[i + 1].hash) {
          logger.warn(`Chain divergence detected at block ${lastBlocks[i].height}, re-indexing most recent data`);
          return false;
        }
      }

      return true;
    } catch (e) {
      return true; // Don't do anything if there is a db error
    }
  }

  /**
   * Check if the chain of block hash is valid and delete data from the stale branch if needed
   */
  public async $validateChain(): Promise<boolean> {
    try {
      const start = new Date().getTime();
      const [blocks]: any[] = await DB.query(`SELECT height, hash, previous_block_hash,
        UNIX_TIMESTAMP(blockTimestamp) as timestamp FROM blocks ORDER BY height`);

      let partialMsg = false;
      let idx = 1;
      while (idx < blocks.length) {
        if (blocks[idx].height - 1 !== blocks[idx - 1].height) {
          if (partialMsg === false) {
            logger.info('Some blocks are not indexed, skipping missing blocks during chain validation');
            partialMsg = true;
          }
          ++idx;
          continue;
        }

        if (blocks[idx].previous_block_hash !== blocks[idx - 1].hash) {
          logger.warn(`Chain divergence detected at block ${blocks[idx - 1].height}, re-indexing newer blocks and hashrates`);
          await this.$deleteBlocksFrom(blocks[idx - 1].height);
          await HashratesRepository.$deleteHashratesFromTimestamp(blocks[idx - 1].timestamp - 604800);
          return false;
        }
        ++idx;
      }

      logger.info(`${idx} blocks hash validated in ${new Date().getTime() - start} ms`);
      return true;
    } catch (e) {
      logger.err('Cannot validate chain of block hash. Reason: ' + (e instanceof Error ? e.message : e));
      return true; // Don't do anything if there is a db error
    }
  }

  /**
   * Delete blocks from the database from blockHeight
   */
  public async $deleteBlocksFrom(blockHeight: number) {
    logger.info(`Delete newer blocks from height ${blockHeight} from the database`);

    try {
      await DB.query(`DELETE FROM blocks where height >= ${blockHeight}`);
    } catch (e) {
      logger.err('Cannot delete indexed blocks. Reason: ' + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Get the historical averaged block fees
   */
  public async $getHistoricalBlockFees(div: number, interval: string | null): Promise<any> {
    try {
      let query = `SELECT
        CAST(AVG(height) as INT) as avg_height,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(fees) as INT) as avg_fees
        FROM blocks`;

      if (interval !== null) {
        query += ` WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
      }

      query += ` GROUP BY UNIX_TIMESTAMP(blockTimestamp) DIV ${div}`;

      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('Cannot generate block fees history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get the historical averaged block rewards
   */
  public async $getHistoricalBlockRewards(div: number, interval: string | null): Promise<any> {
    try {
      let query = `SELECT
        CAST(AVG(height) as INT) as avg_height,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(reward) as INT) as avg_rewards
        FROM blocks`;

      if (interval !== null) {
        query += ` WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
      }

      query += ` GROUP BY UNIX_TIMESTAMP(blockTimestamp) DIV ${div}`;

      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('Cannot generate block rewards history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get the historical averaged block fee rate percentiles
   */
   public async $getHistoricalBlockFeeRates(div: number, interval: string | null): Promise<any> {
    try {
      let query = `SELECT
        CAST(AVG(height) as INT) as avg_height,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[0]')) as INT) as avg_fee_0,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[1]')) as INT) as avg_fee_10,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[2]')) as INT) as avg_fee_25,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[3]')) as INT) as avg_fee_50,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[4]')) as INT) as avg_fee_75,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[5]')) as INT) as avg_fee_90,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[6]')) as INT) as avg_fee_100
      FROM blocks`;

      if (interval !== null) {
        query += ` WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
      }

      query += ` GROUP BY UNIX_TIMESTAMP(blockTimestamp) DIV ${div}`;

      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('Cannot generate block fee rates history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get the historical averaged block sizes
   */
   public async $getHistoricalBlockSizes(div: number, interval: string | null): Promise<any> {
    try {
      let query = `SELECT
        CAST(AVG(height) as INT) as avg_height,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(size) as INT) as avg_size
      FROM blocks`;

      if (interval !== null) {
        query += ` WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
      }

      query += ` GROUP BY UNIX_TIMESTAMP(blockTimestamp) DIV ${div}`;

      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('Cannot generate block size and weight history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get the historical averaged block weights
   */
   public async $getHistoricalBlockWeights(div: number, interval: string | null): Promise<any> {
    try {
      let query = `SELECT
        CAST(AVG(height) as INT) as avg_height,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(weight) as INT) as avg_weight
      FROM blocks`;

      if (interval !== null) {
        query += ` WHERE blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${interval}) AND NOW()`;
      }

      query += ` GROUP BY UNIX_TIMESTAMP(blockTimestamp) DIV ${div}`;

      const [rows]: any = await DB.query(query);
      return rows;
    } catch (e) {
      logger.err('Cannot generate block size and weight history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new BlocksRepository();
