import axios, { AxiosResponse } from 'axios';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import backendInfo from '../api/backend-info';
import logger from '../logger';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';
import { query } from '../utils/http-query';

/**
 * Maintain the most recent version of pools-v2.json
 */
class PoolsUpdater {
  lastRun: number = 0;
  currentSha: string | null = null;
  poolsUrl: string = config.MEMPOOL.POOLS_JSON_URL;
  treeUrl: string = config.MEMPOOL.POOLS_JSON_TREE_URL;

  public async updatePoolsJson(): Promise<void> {
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) === false ||
      config.MEMPOOL.ENABLED === false
    ) {
      return;
    }

    const oneWeek = 604800;
    const oneDay = 86400;

    const now = new Date().getTime() / 1000;
    if (now - this.lastRun < oneWeek) { // Execute the PoolsUpdate only once a week, or upon restart
      return;
    }

    this.lastRun = now;

    try {
      const githubSha = await this.fetchPoolsSha(); // Fetch pools-v2.json sha from github
      if (githubSha === null) {
        return;
      }

      if (config.DATABASE.ENABLED === true) {
        this.currentSha = await this.getShaFromDb();
      }

      logger.debug(`pools-v2.json sha | Current: ${this.currentSha} | Github: ${githubSha}`);
      if (this.currentSha !== null && this.currentSha === githubSha) {
        return;
      }

      // See backend README for more details about the mining pools update process
      if (this.currentSha !== null && // If we don't have any mining pool, download it at least once
        config.MEMPOOL.AUTOMATIC_BLOCK_REINDEXING !== true && // Automatic pools update is disabled
        !process.env.npm_config_update_pools // We're not manually updating mining pool
      ) {
        logger.warn(`Updated mining pools data is available (${githubSha}) but AUTOMATIC_BLOCK_REINDEXING is disabled`);
        logger.info(`You can update your mining pools using the --update-pools command flag. You may want to clear your nginx cache as well if applicable`);
        return;
      }

      const network = config.SOCKS5PROXY.ENABLED ? 'tor' : 'clearnet';
      if (this.currentSha === null) {
        logger.info(`Downloading pools-v2.json for the first time from ${this.poolsUrl} over ${network}`, logger.tags.mining);
      } else {
        logger.warn(`pools-v2.json is outdated, fetch latest from ${this.poolsUrl} over ${network}`, logger.tags.mining);
      }
      const poolsJson = await query(this.poolsUrl);
      if (poolsJson === undefined) {
        return;
      }
      poolsParser.setMiningPools(poolsJson);

      if (config.DATABASE.ENABLED === false) { // Don't run db operations
        logger.info('Mining pools-v2.json import completed (no database)');
        return;
      }

      try {
        await DB.query('START TRANSACTION;');
        await poolsParser.migratePoolsJson();
        await this.updateDBSha(githubSha);
        await DB.query('COMMIT;');
      } catch (e) {
        logger.err(`Could not migrate mining pools, rolling back. Exception: ${JSON.stringify(e)}`, logger.tags.mining);
        await DB.query('ROLLBACK;');
      }
      logger.info('PoolsUpdater completed');

    } catch (e) {
      this.lastRun = now - (oneWeek - oneDay); // Try again in 24h instead of waiting next week
      logger.err(`PoolsUpdater failed. Will try again in 24h. Exception: ${JSON.stringify(e)}`, logger.tags.mining);
    }
  }

  /**
   * Fetch our latest pools-v2.json sha from the db
   */
  private async updateDBSha(githubSha: string): Promise<void> {
    this.currentSha = githubSha;
    if (config.DATABASE.ENABLED === true) {
      try {
        await DB.query('DELETE FROM state where name="pools_json_sha"');
        await DB.query(`INSERT INTO state VALUES('pools_json_sha', NULL, '${githubSha}')`);
      } catch (e) {
        logger.err('Cannot save github pools-v2.json sha into the db. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      }
    }
  }

  /**
   * Fetch our latest pools-v2.json sha from the db
   */
  private async getShaFromDb(): Promise<string | null> {
    try {
      const [rows]: any[] = await DB.query('SELECT string FROM state WHERE name="pools_json_sha"');
      return (rows.length > 0 ? rows[0].string : null);
    } catch (e) {
      logger.err('Cannot fetch pools-v2.json sha from db. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      return null;
    }
  }

  /**
   * Fetch our latest pools-v2.json sha from github
   */
  private async fetchPoolsSha(): Promise<string | null> {
    const response = await query(this.treeUrl);

    if (response !== undefined) {
      for (const file of response['tree']) {
        if (file['path'] === 'pools-v2.json') {
          return file['sha'];
        }
      }
    }

    logger.err(`Cannot find "pools-v2.json" in git tree (${this.treeUrl})`, logger.tags.mining);
    return null;
  }
}

export default new PoolsUpdater();
