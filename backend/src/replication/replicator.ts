import config from '../config';
import backendInfo from '../api/backend-info';
import axios, { AxiosResponse } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';

/** @asyncSafe */
export async function $sync(path, sanityCheckCb?: (results: any, path: string) => any): Promise<{ data?: any, exists: boolean, server?: string }> {
  // start with a random server so load is uniformly spread
  let allMissing = true;
  const offset = Math.floor(Math.random() * config.REPLICATION.SERVERS.length);
  const results: any[] = [];
  for (let i = 0; i < config.REPLICATION.SERVERS.length; i++) {
    const server = config.REPLICATION.SERVERS[(i + offset) % config.REPLICATION.SERVERS.length];
    // don't query ourself
    if (server === backendInfo.getBackendInfo().hostname) {
      continue;
    }

    try {
      const result = await query(`https://${server}${path}`);
      if (result) {
        if (sanityCheckCb !== undefined && results.length >= 3) {
          results.push(result);
          const sanitizedResult = sanityCheckCb(results, path);
          return { data: sanitizedResult, exists: true, server };
        } else {
          return { data: result, exists: true, server };
        }
      }
    } catch (e: any) {
      if (e?.response?.status === 404) {
        // this server is also missing this data
      } else {
        // something else went wrong
        allMissing = false;
      }
    }
  }

  return { exists: !allMissing };
}

/** @asyncUnsafe */
export async function query(path): Promise<object> {
  type axiosOptions = {
    headers: {
      'User-Agent': string
    };
    timeout: number;
    httpsAgent?: https.Agent;
  };
  const axiosOptions: axiosOptions = {
    headers: {
      'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
    },
    timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000
  };

  if (config.SOCKS5PROXY.ENABLED) {
    const socksOptions = {
      agentOptions: {
        keepAlive: true,
      },
      hostname: config.SOCKS5PROXY.HOST,
      port: config.SOCKS5PROXY.PORT,
      username: config.SOCKS5PROXY.USERNAME || 'circuit0',
      password: config.SOCKS5PROXY.PASSWORD,
    };

    axiosOptions.httpsAgent = new SocksProxyAgent(socksOptions);
  }

  const data: AxiosResponse = await axios.get(path, axiosOptions);
  if (data.statusText === 'error' || !data.data) {
    throw new Error(`${data.status}`);
  }
  return data.data;
}

function performSanityCheck(results: any[], type: 'audits' | 'statistics', interval?: any): any[] {
  if (results.length === 0) {
    return [];
  }
  const finalResult: any[] = [];
  let tempResult: any[] = [];
  if (type === 'statistics') {
    for (const res of results) {
      if (tempResult.length === 0) {
        tempResult = [...res];
        continue;
      }

      for (const [key, value] of Object.entries(res)) {
        if (typeof value !== 'number') {
          continue;
        }

        const tmpValue = tempResult[key];
        const absDelta = Math.abs(tmpValue - value);

        let healthyResult = true;
        if (key === '' && absDelta > value * 0.1) {
          healthyResult = false;
        }
      }
    }
  }

  if (type === 'audits') {

  }

  return results[0];
}