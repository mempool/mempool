import DB from '../database';
import config from '../config';
import logger from '../logger';
import databaseMigration from '../api/database-migration';

/**
 * Initialize the test database with schema migrations
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    await DB.checkDbConnection();
    await databaseMigration.$initializeOrMigrateDatabase();
  } catch (error) {
    logger.err('Failed to setup test database: ' + (error instanceof Error ? error.message : error));
    throw error;
  }
}

/**
 * Clean up all data from test tables (but preserve schema)
 * This runs between each test to ensure isolation
 */
export async function cleanupTestData(): Promise<void> {
  // Order matters: delete child tables before parent tables
  const tables = [
    'blocks_audits',
    'blocks_summaries',
    'blocks_prices',
    'blocks_templates',
    'cpfp_clusters',
    'blocks',  // blocks references pools
    'difficulty_adjustments',
    'hashrates',
    'prices',
    'node_records',
    'nodes_sockets',
    'nodes',
    'lightning_stats',
    'transactions',
    'elements_pegs',
    'federation_txos',
    'pools'
  ];

  try {
    // Disable foreign key checks temporarily for faster cleanup
    await DB.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of tables) {
      try {
        // Use 'silent' error logging to avoid noise for optional tables that don't exist
        await DB.query(`TRUNCATE TABLE ${table}`, [], 'silent');
      } catch (e) {
        // Table might not exist, that's okay for optional tables
        // Silently ignore - no need to log since these are expected for optional features
      }
    }

    // Re-enable foreign key checks
    await DB.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch (error) {
    // Try to re-enable foreign keys even if cleanup failed
    try {
      await DB.query('SET FOREIGN_KEY_CHECKS = 1');
    } catch (e) {
      // Ignore
    }
    logger.err('Failed to cleanup test data: ' + (error instanceof Error ? error.message : error));
    throw error;
  }
}

/**
 * Wait for database to be ready
 */
export async function waitForDatabase(maxRetries = 30, retryInterval = 1000): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await DB.query('SELECT 1');
      logger.info('Database is ready');
      return;
    } catch (error) {
      logger.debug(`Waiting for database... attempt ${i + 1}/${maxRetries}`);
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
  throw new Error('Database did not become ready in time');
}

/**
 * Get database configuration for tests
 */
export function getTestDatabaseConfig() {
  return {
    host: config.DATABASE.HOST,
    port: config.DATABASE.PORT,
    database: config.DATABASE.DATABASE,
    username: config.DATABASE.USERNAME,
    enabled: config.DATABASE.ENABLED
  };
}

/**
 * Insert a test pool into the database
 */
export async function insertTestPool(poolData: {
  id?: number;
  name: string;
  link?: string;
  slug: string;
  addresses?: string;
  regexes?: string;
}) {
  const [result] = await DB.query<any>(
    `INSERT INTO pools (unique_id, name, link, slug, addresses, regexes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      poolData.id || -1,
      poolData.name,
      poolData.link || '',
      poolData.slug,
      poolData.addresses || '[]',
      poolData.regexes || '[]'
    ]
  );
  return result.insertId;
}

/**
 * Insert a test block into the database
 */
export async function insertTestBlock(blockData: {
  height: number;
  hash: string;
  blockTimestamp?: Date;
  size?: number;
  weight?: number;
  tx_count?: number;
  difficulty?: number;
  poolId?: number | null;
}) {
  const timestamp = blockData.blockTimestamp || new Date();
  const size = blockData.size || 1000000;
  const weight = blockData.weight || 4000000;
  const txCount = blockData.tx_count || 2000;

  await DB.query(
    `INSERT INTO blocks (
      height, hash, blockTimestamp, size, weight, tx_count, 
      difficulty, pool_id, version, bits, nonce, merkle_root, 
      previous_block_hash, median_timestamp, stale,
      fees, fee_span, median_fee,
      avg_tx_size, total_inputs, total_outputs, total_output_amt,
      segwit_total_txs, segwit_total_size, segwit_total_weight,
      header, utxoset_change
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      blockData.height,
      blockData.hash,
      timestamp,
      size,
      weight,
      txCount,
      blockData.difficulty || 1.0,
      blockData.poolId !== undefined ? blockData.poolId : null,
      0x20000000,
      0x1d00ffff,
      0,
      '0000000000000000000000000000000000000000000000000000000000000000',
      '0000000000000000000000000000000000000000000000000000000000000000',
      timestamp,
      0,  // stale = false
      // Required fields with defaults
      50000000,  // fees (in sats)
      JSON.stringify([0, 0, 0, 0, 0, 0, 0]),  // fee_span (JSON array)
      10000,  // median_fee (in sats)
      size / txCount,  // avg_tx_size
      txCount * 2,  // total_inputs (estimate)
      txCount * 2,  // total_outputs (estimate)
      2100000000000000,  // total_output_amt (21M BTC in sats, estimate)
      txCount,  // segwit_total_txs (assume all segwit for test)
      size,  // segwit_total_size
      weight,  // segwit_total_weight
      '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',  // header (160 chars)
      0  // utxoset_change
    ]
  );
}

