import { BlockExtended, BlockPrice } from '../mempool.interfaces';
import DB from '../database';
import logger from '../logger';
import { Common } from '../api/common';
import { prepareBlock } from '../utils/blocks-utils';
import PoolsRepository from './PoolsRepository';
import HashratesRepository from './HashratesRepository';
import { escape } from 'mysql2';
import BlocksSummariesRepository from './BlocksSummariesRepository';
import DifficultyAdjustmentsRepository from './DifficultyAdjustmentsRepository';
import bitcoinClient from '../api/bitcoin/bitcoin-client';
import config from '../config';

class BlocksRepository {
  /**
   * Save indexed block data in the database
   */
  public async $saveBlockInDatabase(block: BlockExtended) {
    try {
      const query = `INSERT INTO blocks(
        height,             hash,                blockTimestamp,    size,
        weight,             tx_count,            coinbase_raw,      difficulty,
        pool_id,            fees,                fee_span,          median_fee,
        reward,             version,             bits,              nonce,
        merkle_root,        previous_block_hash, avg_fee,           avg_fee_rate,
        median_timestamp,   block_time,          header,            coinbase_address,
        coinbase_signature, utxoset_size,        utxoset_change,    avg_tx_size,
        total_inputs,       total_outputs,       total_input_amt,   total_output_amt,
        fee_percentiles,    segwit_total_txs,    segwit_total_size, segwit_total_weight,
        median_fee_amt
      ) VALUE (
        ?, ?, FROM_UNIXTIME(?), ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?
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
        block.extras.medianTimestamp,
        block.extras.blockTime,
        block.extras.header,
        block.extras.coinbaseAddress,
        block.extras.coinbaseSignature,
        block.extras.utxoSetSize,
        block.extras.utxoSetChange,
        block.extras.avgTxSize,
        block.extras.totalInputs,
        block.extras.totalOutputs,
        block.extras.totalInputAmt,
        block.extras.totalOutputAmt,
        JSON.stringify(block.extras.feePercentiles),
        block.extras.segwitTotalTxs,
        block.extras.segwitTotalSize,
        block.extras.segwitTotalWeight,
        block.extras.medianFeeAmt,
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
   * Save newly indexed data from core coinstatsindex
   * 
   * @param utxoSetSize 
   * @param totalInputAmt 
   */
  public async $updateCoinStatsIndexData(blockHash: string, utxoSetSize: number,
    totalInputAmt: number
  ) : Promise<void> {
    try {
      const query = `
        UPDATE blocks
        SET utxoset_size = ?, total_input_amt = ?
        WHERE hash = ?
      `;
      const params: any[] = [
        utxoSetSize,
        totalInputAmt,
        blockHash
      ];
      await DB.query(query, params);
    } catch (e: any) {
      logger.err('Cannot update indexed block coinstatsindex. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
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
   * Return most recent block height
   */
  public async $mostRecentBlockHeight(): Promise<number> {
    try {
      const [row] = await DB.query('SELECT MAX(height) as maxHeight from blocks');
      return row[0]['maxHeight'];
    } catch (e) {
      logger.err(`Cannot count blocks for this pool (using offset). Reason: ` + (e instanceof Error ? e.message : e));
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
      throw new Error('This mining pool does not exist ' + escape(slug));
    }

    const params: any[] = [];
    let query = ` SELECT
      blocks.height,
      hash as id,
      UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp,
      size,
      weight,
      tx_count,
      coinbase_raw,
      difficulty,
      fees,
      fee_span,
      median_fee,
      reward,
      version,
      bits,
      nonce,
      merkle_root,
      previous_block_hash as previousblockhash,
      avg_fee,
      avg_fee_rate
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
      const [rows]: any[] = await DB.query(`SELECT
        blocks.*,
        hash as id,
        UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp,
        UNIX_TIMESTAMP(blocks.median_timestamp) as medianTime,
        pools.id as pool_id,
        pools.name as pool_name,
        pools.link as pool_link,
        pools.slug as pool_slug,
        pools.addresses as pool_addresses,
        pools.regexes as pool_regexes,
        previous_block_hash as previousblockhash
        FROM blocks
        JOIN pools ON blocks.pool_id = pools.id
        WHERE blocks.height = ${height}
      `);

      if (rows.length <= 0) {
        return null;
      }

      rows[0].fee_span = JSON.parse(rows[0].fee_span);
      rows[0].fee_percentiles = JSON.parse(rows[0].fee_percentiles);
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
        SELECT *, blocks.height, UNIX_TIMESTAMP(blocks.blockTimestamp) as blockTimestamp, hash as id,
        pools.id as pool_id, pools.name as pool_name, pools.link as pool_link, pools.slug as pool_slug,
        pools.addresses as pool_addresses, pools.regexes as pool_regexes,
        previous_block_hash as previousblockhash
        FROM blocks
        JOIN pools ON blocks.pool_id = pools.id
        WHERE hash = ?;
      `;
      const [rows]: any[] = await DB.query(query, [hash]);

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
  public async $getBlocksDifficulty(): Promise<object[]> {
    try {
      const [rows]: any[] = await DB.query(`SELECT UNIX_TIMESTAMP(blockTimestamp) as time, height, difficulty FROM blocks`);
      return rows;
    } catch (e) {
      logger.err('Cannot get blocks difficulty list from the db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get the first block at or directly after a given timestamp
   * @param timestamp number unix time in seconds
   * @returns The height and timestamp of a block (timestamp might vary from given timestamp)
   */
  public async $getBlockHeightFromTimestamp(
    timestamp: number,
  ): Promise<{ height: number; hash: string; timestamp: number }> {
    try {
      // Get first block at or after the given timestamp
      const query = `SELECT height, hash, blockTimestamp as timestamp FROM blocks
        WHERE blockTimestamp <= FROM_UNIXTIME(?)
        ORDER BY blockTimestamp DESC
        LIMIT 1`;
      const params = [timestamp];
      const [rows]: any[][] = await DB.query(query, params);
      if (rows.length === 0) {
        throw new Error(`No block was found before timestamp ${timestamp}`);
      }

      return rows[0];
    } catch (e) {
      logger.err(
        'Cannot get block height from timestamp from the db. Reason: ' +
          (e instanceof Error ? e.message : e),
      );
      throw e;
    }
  }

  /**
   * Return blocks height
   */
   public async $getBlocksHeightsAndTimestamp(): Promise<object[]> {
    try {
      const [rows]: any[] = await DB.query(`SELECT height, blockTimestamp as timestamp FROM blocks`);
      return rows;
    } catch (e) {
      logger.err('Cannot get blocks height and timestamp from the db. Reason: ' + (e instanceof Error ? e.message : e));
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
          logger.warn(`Chain divergence detected at block ${blocks[idx - 1].height}`);
          await this.$deleteBlocksFrom(blocks[idx - 1].height);
          await BlocksSummariesRepository.$deleteBlocksFrom(blocks[idx - 1].height);
          await HashratesRepository.$deleteHashratesFromTimestamp(blocks[idx - 1].timestamp - 604800);
          await DifficultyAdjustmentsRepository.$deleteAdjustementsFromHeight(blocks[idx - 1].height);
          return false;
        }
        ++idx;
      }

      logger.debug(`${idx} blocks hash validated in ${new Date().getTime() - start} ms`);
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
        CAST(AVG(blocks.height) as INT) as avgHeight,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(fees) as INT) as avgFees,
        prices.*
        FROM blocks
        JOIN blocks_prices on blocks_prices.height = blocks.height
        JOIN prices on prices.id = blocks_prices.price_id
      `;

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
        CAST(AVG(blocks.height) as INT) as avgHeight,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(reward) as INT) as avgRewards,
        prices.*
        FROM blocks
        JOIN blocks_prices on blocks_prices.height = blocks.height
        JOIN prices on prices.id = blocks_prices.price_id
      `;

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
        CAST(AVG(height) as INT) as avgHeight,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[0]')) as INT) as avgFee_0,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[1]')) as INT) as avgFee_10,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[2]')) as INT) as avgFee_25,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[3]')) as INT) as avgFee_50,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[4]')) as INT) as avgFee_75,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[5]')) as INT) as avgFee_90,
        CAST(AVG(JSON_EXTRACT(fee_span, '$[6]')) as INT) as avgFee_100
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
        CAST(AVG(height) as INT) as avgHeight,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(size) as INT) as avgSize
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
        CAST(AVG(height) as INT) as avgHeight,
        CAST(AVG(UNIX_TIMESTAMP(blockTimestamp)) as INT) as timestamp,
        CAST(AVG(weight) as INT) as avgWeight
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
   * Get a list of blocks that have been indexed
   */
  public async $getIndexedBlocks(): Promise<any[]> {
    try {
      const [rows]: any = await DB.query(`SELECT height, hash FROM blocks ORDER BY height DESC`);
      return rows;
    } catch (e) {
      logger.err('Cannot generate block size and weight history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get a list of blocks that have not had CPFP data indexed
   */
   public async $getCPFPUnindexedBlocks(): Promise<any[]> {
    try {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      const currentBlockHeight = blockchainInfo.blocks;
      let indexingBlockAmount = Math.min(config.MEMPOOL.INDEXING_BLOCKS_AMOUNT, currentBlockHeight);
      if (indexingBlockAmount <= -1) {
        indexingBlockAmount = currentBlockHeight + 1;
      }
      const minHeight = Math.max(0, currentBlockHeight - indexingBlockAmount + 1);

      const [rows]: any[] = await DB.query(`
        SELECT height
        FROM compact_cpfp_clusters
        WHERE height <= ? AND height >= ?
        ORDER BY height DESC;
      `, [currentBlockHeight, minHeight]);

      const indexedHeights = {};
      rows.forEach((row) => { indexedHeights[row.height] = true; });
      const allHeights: number[] = Array.from(Array(currentBlockHeight - minHeight + 1).keys(), n => n + minHeight).reverse();
      const unindexedHeights = allHeights.filter(x => !indexedHeights[x]);

      return unindexedHeights;
    } catch (e) {
      logger.err('Cannot fetch CPFP unindexed blocks. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Return the oldest block  from a consecutive chain of block from the most recent one
   */
  public async $getOldestConsecutiveBlock(): Promise<any> {
    try {
      const [rows]: any = await DB.query(`SELECT height, UNIX_TIMESTAMP(blockTimestamp) as timestamp, difficulty FROM blocks ORDER BY height DESC`);
      for (let i = 0; i < rows.length - 1; ++i) {
        if (rows[i].height - rows[i + 1].height > 1) {
          return rows[i];
        }
      }
      return rows[rows.length - 1];
    } catch (e) {
      logger.err('Cannot generate block size and weight history. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Get all blocks which have not be linked to a price yet
   */
   public async $getBlocksWithoutPrice(): Promise<object[]> {
    try {
      const [rows]: any[] = await DB.query(`
        SELECT UNIX_TIMESTAMP(blocks.blockTimestamp) as timestamp, blocks.height
        FROM blocks
        LEFT JOIN blocks_prices ON blocks.height = blocks_prices.height
        WHERE blocks_prices.height IS NULL
        ORDER BY blocks.height
      `);
      return rows;
    } catch (e) {
      logger.err('Cannot get blocks height and timestamp from the db. Reason: ' + (e instanceof Error ? e.message : e));
      throw e;
    }
  }

  /**
   * Save block price by batch
   */
   public async $saveBlockPrices(blockPrices: BlockPrice[]): Promise<void> {
    try {
      let query = `INSERT INTO blocks_prices(height, price_id) VALUES`;
      for (const price of blockPrices) {
        query += ` (${price.height}, ${price.priceId}),`;
      }
      query = query.slice(0, -1);
      await DB.query(query);
    } catch (e: any) {
      if (e.errno === 1062) { // ER_DUP_ENTRY - This scenario is possible upon node backend restart
        logger.debug(`Cannot save blocks prices for blocks [${blockPrices[0].height} to ${blockPrices[blockPrices.length - 1].height}] because it has already been indexed, ignoring`);
      } else {
        logger.err(`Cannot save blocks prices for blocks [${blockPrices[0].height} to ${blockPrices[blockPrices.length - 1].height}] into db. Reason: ` + (e instanceof Error ? e.message : e));
        throw e;
      }
    }
  }

  /**
   * Get all indexed blocsk with missing coinstatsindex data
   */
  public async $getBlocksMissingCoinStatsIndex(maxHeight: number, minHeight: number): Promise<any> {
    try {
      const [blocks] = await DB.query(`
        SELECT height, hash
        FROM blocks
        WHERE height >= ${minHeight} AND height <= ${maxHeight} AND
          (utxoset_size IS NULL OR total_input_amt IS NULL)
      `);
      return blocks;
    } catch (e) {
      logger.err(`Cannot get blocks with missing coinstatsindex. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new BlocksRepository();
