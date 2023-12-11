import axios, { AxiosResponse } from 'axios';
import config from '../config';
import DB from '../database';
import backendInfo from '../api/backend-info';
import logger from '../logger';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';

/**
 * Maintain the most recent version of pools_addresses.csv
 */
class PoolsAddressesUpdater {
  lastRun: number = 0;
  currentSha: string | null = null;

  poolsAddressesUrl: string = config.MEMPOOL.MINGING_POOLS_ADDRESSES_URL;
  poolsAddressesTreeUrl: string = config.MEMPOOL.MINGING_POOLS_ADDRESSES_TREE_URL;

  public async updatePoolsAddressesCsv(): Promise<void> {
 
    if (config.MEMPOOL.NETWORK !== 'mainnet' || config.MEMPOOL.ENABLED === false) { return }

    const oneWeek = 604800;
    const oneDay = 86400;

    const now = new Date().getTime() / 1000;
    if (now - this.lastRun < oneWeek) { // Execute the PoolsAddressesUpdate only once a week, or upon restart
      return;
    }

    this.lastRun = now;

    try {
      if (config.DATABASE.ENABLED === false) {
        return;
      }

      const githubSha = await this.fetchPoolsAddressesSha(); // Fetch pools_addresses.csv sha from github
      if (githubSha === null) {
        return;
      }

      this.currentSha = await this.getShaFromDb();

      logger.debug(`pools_addresses.csv sha | Current: ${this.currentSha} | Github: ${githubSha}`);
      if (this.currentSha !== null && this.currentSha === githubSha) {
        return;
      }

      if (this.currentSha !== null && // If we don't have any pools addresses, download it at least once
        config.MEMPOOL.AUTOMATIC_BLOCK_REINDEXING !== true && // Automatic pools update is disabled
        !process.env.npm_config_update_pools // We're not manually updating mining pool
      ) {
        logger.warn(`Updated pools addresses data is available (${githubSha}) but AUTOMATIC_BLOCK_REINDEXING is disabled`);
        logger.info(`You can update your pools addresses using the --update-pools command flag. You may want to clear your nginx cache as well if applicable`);
        return;
      }

      const network = config.SOCKS5PROXY.ENABLED ? 'tor' : 'clearnet';
      if (this.currentSha === null) {
        logger.info(`Downloading pools_addresses.csv for the first time from ${this.poolsAddressesUrl} over ${network}`, logger.tags.mining);
      } else {
        logger.warn(`pools_addresses.csv is outdated, fetching latest from ${this.poolsAddressesUrl} over ${network}`, logger.tags.mining);
      }
      const poolsAddressesCsv = await this.query(this.poolsAddressesUrl);
      if (poolsAddressesCsv === undefined) {
        return;
      }

      try {
        await DB.query('START TRANSACTION;');
        await DB.query('DELETE FROM pools_addresses;');
        const chunks = poolsAddressesCsv.split('\n');
        const nbAddresses = chunks.length;
        let i = 0;
        for (const line of chunks) {
          const values = line.match(/"(.*?)"/g);
          if (!values) {
            continue;
          }
          await DB.query({
            sql: `INSERT INTO pools_addresses(address, pool_id, pool_value)
            VALUES(${values[0]}, ${values[1]},${values[2]});
          `});
          i++;
          if (i % 10000 === 0) {
            logger.info(`Populating pools_addresses table with ${i} / ${nbAddresses} addresses`);
            await DB.query('COMMIT;');
            await DB.query('START TRANSACTION;');
          }
        }
        await this.updateDBSha(githubSha);
        await DB.query('COMMIT;');
        logger.info(`pools_addresses.csv (${githubSha}) import completed`);
      } catch (e) {
        logger.err(`Could not migrate pools addresses, rolling back. Exception: ${JSON.stringify(e)}`, logger.tags.mining);
        await DB.query('ROLLBACK;');
      }

    } catch (e) {
      this.lastRun = now - (oneWeek - oneDay); // Try again in 24h instead of waiting next week
      logger.err(`PoolsAddressesUpdater failed. Will try again in 24h. Exception: ${JSON.stringify(e)}`, logger.tags.mining);
    }
  }

  /**
   * Fetch our latest pools_addresses.csv sha from the db
   */
  private async updateDBSha(githubSha: string): Promise<void> {
    this.currentSha = githubSha;
    try {
      await DB.query('DELETE FROM state where name="pools_addresses_sha";');
      await DB.query(`INSERT INTO state VALUES('pools_addresses_sha', NULL, '${githubSha}');`);
    } catch (e) {
      logger.err('Cannot save github pools_addresses.csv sha into the db. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
    }
  }

  /**
   * Fetch our latest pools_addresses.csv sha from the db
   */
  private async getShaFromDb(): Promise<string | null> {
    try {
      const [rows]: any[] = await DB.query('SELECT string FROM state WHERE name="pools_addresses_sha"');
      return (rows.length > 0 ? rows[0].string : null);
    } catch (e) {
      logger.err('Cannot fetch pools_addresses.csv sha from db. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      return null;
    }
  }

  /**
   * Fetch our latest pools_addresses.csv sha from github
   */
  private async fetchPoolsAddressesSha(): Promise<string | null> {
    const response = await this.query(this.poolsAddressesTreeUrl);

    if (response !== undefined) {
      for (const file of response['tree']) {
        if (file['path'] === 'pools_addresses.csv') {
          return file['sha'];
        }
      }
    }

    logger.err(`Cannot find "pools_addresses.csv" in git tree (${this.poolsAddressesTreeUrl})`, logger.tags.mining);
    return null;
  }

  /**
   * Http request wrapper
   */
  private async query(path): Promise<any> {
    type axiosOptions = {
      headers: {
        'User-Agent': string
      };
      timeout: number;
      httpsAgent?: https.Agent;
    };
    const setDelay = (secs: number = 1): Promise<void> => new Promise(resolve => setTimeout(() => resolve(), secs * 1000));
    const axiosOptions: axiosOptions = {
      headers: {
        'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
      },
      timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000
    };
    let retry = 0;

    while (retry < config.MEMPOOL.EXTERNAL_MAX_RETRY) {
      try {
        if (config.SOCKS5PROXY.ENABLED) {
          const socksOptions: any = {
            agentOptions: {
              keepAlive: true,
            },
            hostname: config.SOCKS5PROXY.HOST,
            port: config.SOCKS5PROXY.PORT
          };

          if (config.SOCKS5PROXY.USERNAME && config.SOCKS5PROXY.PASSWORD) {
            socksOptions.username = config.SOCKS5PROXY.USERNAME;
            socksOptions.password = config.SOCKS5PROXY.PASSWORD;
          } else {
            // Retry with different tor circuits https://stackoverflow.com/a/64960234
            socksOptions.username = `circuit${retry}`;
          }

          axiosOptions.httpsAgent = new SocksProxyAgent(socksOptions);
        }

        const data: AxiosResponse = await axios.get(path, axiosOptions);
        if (data.statusText === 'error' || !data.data) {
          throw new Error(`Could not fetch data from ${path}, Error: ${data.status}`);
        }
        return data.data;
      } catch (e) {
        logger.err('Could not connect to Github. Reason: ' + (e instanceof Error ? e.message : e));
        retry++;
      }
      await setDelay(config.MEMPOOL.EXTERNAL_RETRY_INTERVAL);
    }
    return undefined;
  }
}

export default new PoolsAddressesUpdater();
