import axios, { AxiosResponse } from 'axios';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import backendInfo from '../api/backend-info';
import logger from '../logger';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';

/**
 * Maintain the most recent version of pools.json
 */
class PoolsUpdater {
  lastRun: number = 0;

  constructor() {
  }

  public async updatePoolsJson() {
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) === false || config.DATABASE.ENABLED === false) {
      return;
    }

    const oneWeek = 604800;
    const oneDay = 86400;

    const now = new Date().getTime() / 1000;
    if (now - this.lastRun < oneWeek) { // Execute the PoolsUpdate only once a week, or upon restart
      return;
    }

    this.lastRun = now;

    logger.info('Updating latest mining pools from Github');
    if (config.SOCKS5PROXY.ENABLED) {
      logger.info('List of public pools will be queried over the Tor network');
    } else {
      logger.info('List of public pools will be queried over clearnet');
    }

    try {
      const dbSha = await this.getShaFromDb();
      const githubSha = await this.fetchPoolsSha(); // Fetch pools.json sha from github
      if (githubSha === undefined) {
        return;
      }

      logger.debug(`Pools.json sha | Current: ${dbSha} | Github: ${githubSha}`);
      if (dbSha !== undefined && dbSha === githubSha) {
        return;
      }

      logger.warn('Pools.json is outdated, fetch latest from github');
      const poolsJson = await this.query('https://raw.githubusercontent.com/mempool/mining-pools/master/pools.json');
      if (poolsJson === undefined) {
        return;
      }
      await poolsParser.migratePoolsJson(poolsJson);
      await this.updateDBSha(githubSha);
      logger.notice('PoolsUpdater completed');

    } catch (e) {
      this.lastRun = now - (oneWeek - oneDay); // Try again in 24h instead of waiting next week
      logger.err('PoolsUpdater failed. Will try again in 24h. Reason: '  + (e instanceof Error ? e.message : e));
    }
  }

  /**
   * Fetch our latest pools.json sha from the db
   */
  private async updateDBSha(githubSha: string) {
    try {
      await DB.query('DELETE FROM state where name="pools_json_sha"');
      await DB.query(`INSERT INTO state VALUES('pools_json_sha', NULL, '${githubSha}')`);
    } catch (e) {
      logger.err('Cannot save github pools.json sha into the db. Reason: '  + (e instanceof Error ? e.message : e));
      return undefined;
    }
  }

  /**
   * Fetch our latest pools.json sha from the db
   */
  private async getShaFromDb(): Promise<string | undefined> {
    try {
      const [rows]: any[] = await DB.query('SELECT string FROM state WHERE name="pools_json_sha"');
      return (rows.length > 0 ? rows[0].string : undefined);
    } catch (e) {
      logger.err('Cannot fetch pools.json sha from db. Reason: '  + (e instanceof Error ? e.message : e));
      return undefined;
    }
  }

  /**
   * Fetch our latest pools.json sha from github
   */
  private async fetchPoolsSha(): Promise<string | undefined> {
    const response = await this.query('https://api.github.com/repos/mempool/mining-pools/git/trees/master');

    if (response !== undefined) {
      for (const file of response['tree']) {
        if (file['path'] === 'pools.json') {
          return file['sha'];
        }
      }
    }

    logger.err('Cannot to find latest pools.json sha from github api response');
    return undefined;
  }

  /**
   * Http request wrapper
   */
  private async query(path): Promise<object | undefined> {
    type axiosOptions = {
      headers: {
        'User-Agent': string
      };
      timeout: number;
      httpsAgent?: https.Agent;
    }
    const setDelay = (secs: number = 1): Promise<void> => new Promise(resolve => setTimeout(() => resolve(), secs * 1000));
    const axiosOptions: axiosOptions = {
      headers: {
        'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
      },
      timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000
    };
    let retry = 0;

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
      }

      axiosOptions.httpsAgent = new SocksProxyAgent(socksOptions);
    }

    while(retry < config.MEMPOOL.EXTERNAL_MAX_RETRY) {
      try {
        const data: AxiosResponse = await axios.get(path, axiosOptions);
        if (data.statusText === 'error' || !data.data) {
          throw new Error(`Could not fetch data from Github, Error: ${data.status}`);
        }
        return data.data;
      } catch (e) {
        logger.err('Could not connect to Github. Reason: '  + (e instanceof Error ? e.message : e));
        retry++;
      }
      await setDelay(config.MEMPOOL.EXTERNAL_RETRY_INTERVAL);
    }
    return undefined;
  }
}

export default new PoolsUpdater();
