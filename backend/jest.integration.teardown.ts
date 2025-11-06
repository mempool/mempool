import DB from './src/database';
import logger from './src/logger';
import mempool from './src/api/mempool';
import { execSync } from 'child_process';
import * as path from 'path';

module.exports = async () => {
  try {
    // Final cleanup after all tests
    const tables = [
      'blocks_audits',
      'blocks_summaries',
      'blocks_prices',
      'blocks_templates',
      'cpfp_clusters',
      'blocks',
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

    await DB.query('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const table of tables) {
      try {
        // Use 'silent' error logging to avoid noise for optional tables that don't exist
        await DB.query(`TRUNCATE TABLE ${table}`, [], 'silent');
      } catch (e) {
        // Table might not exist - silently ignore
      }
    }
    
    await DB.query('SET FOREIGN_KEY_CHECKS = 1');
    
    logger.info('Integration tests cleanup completed');
    
    // Close the database connection pool to prevent Jest from hanging
    await DB.close();
    logger.info('Database connection pool closed');
    
    // Clean up singleton resources that have timers or sockets
    mempool.destroy();
    logger.info('Mempool resources cleaned up');
    
    // Close logger's UDP socket last (after all logging is done)
    logger.close();
    
    // Stop and remove the Docker test database container
    try {
      const composeFile = path.join(__dirname, 'docker-compose.test.yml');
      execSync(`docker-compose -f "${composeFile}" down -v`, { 
        stdio: 'inherit',
        cwd: __dirname
      });
      console.log('Test database container stopped and removed');
    } catch (error) {
      console.error('Failed to stop Docker container:', error instanceof Error ? error.message : error);
    }
  } catch (error) {
    // Use console.error since logger might be closed
    console.error('Failed to cleanup after integration tests:', error instanceof Error ? error.message : error);
  } finally {
    // Ensure we always try to close connections even if cleanup fails
    try {
      await DB.close();
      mempool.destroy();
      logger.close();
    } catch (e) {
      // Ignore errors on close
    }
  }
};

