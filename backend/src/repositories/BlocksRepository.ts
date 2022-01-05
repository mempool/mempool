import { IEsploraApi } from "../api/bitcoin/esplora-api.interface";
import { BlockExtended, PoolTag } from "../mempool.interfaces";
import { DB } from "../database";
import logger from "../logger";
import bitcoinApi from '../api/bitcoin/bitcoin-api-factory';

class BlocksRepository {
  /**
   * Save indexed block data in the database
   * @param block 
   * @param blockHash 
   * @param coinbaseTxid 
   * @param poolTag 
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
        height,  hash,     timestamp,    size,
        weight,  tx_count, coinbase_raw, difficulty,
        pool_id, fees,     fee_span,     median_fee
      ) VALUE (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )`;

      const params: any[] = [
        block.height, blockHash, block.timestamp, block.size,
        block.weight, block.tx_count, coinbaseHex ? coinbaseHex : "", block.difficulty,
        poolTag.id, 0, "[]", block.medianFee,
      ];

      await connection.query(query, params);
    } catch (e) {
      console.log(e);
      logger.err('$updateBlocksDatabase() error' + (e instanceof Error ? e.message : e));
    }

    connection.release();
  }

  /**
   * Check if a block has already been indexed in the database. Query the databse directly.
   * This can be cached/optimized if required later on to avoid too many db queries.
   * @param blockHeight
   * @returns
   */
  public async $isBlockAlreadyIndexed(blockHeight: number) {
    const connection = await DB.pool.getConnection();
    let exists = false;

    try {
      const query = `SELECT height from blocks where blocks.height = ${blockHeight}`;
      const [rows]: any[] = await connection.query(query);
      exists = rows.length === 1;
    } catch (e) {
      console.log(e);
      logger.err('$isBlockAlreadyIndexed() error' + (e instanceof Error ? e.message : e));
    }
    connection.release();

    return exists;
  }
}

export default new BlocksRepository();