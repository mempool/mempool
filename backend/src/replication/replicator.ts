import config from '../config';
import backendInfo from '../api/backend-info';
import axios, { AxiosResponse } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';
import { Common } from '../api/common';
import logger from '../logger';

/** @asyncSafe */
export async function $sync(path, sanityCheckCb?: (resultsPerServer: Record<string, any>, path: string) => {serverPicked: string, sanitizedResult: any}): Promise<{ data?: any, exists: boolean, server?: string }> {
  // start with a random server so load is uniformly spread
  let allMissing = true;
  const servers = config.REPLICATION.SERVERS.filter(server => server !== backendInfo.getBackendInfo().hostname);
  let resultsPerServer: Record<string, any> = {};
  const minResults = Math.max(Math.ceil(servers.length / 4), 3);
  if (sanityCheckCb !== undefined && servers.length < minResults) {
    logger.warn(`Not enough servers to perform sanity check for ${path} (${servers.length}/${minResults}), skipping.`, logger.tags.replication);
    return { exists: false };
  }
  Common.shuffleArray(servers);
  for (const server of servers) {
    try {
      const result = await query(`https://${server}${path}`);
      if (result) {
        if (sanityCheckCb === undefined) {
          return { data: result, exists: true, server };
        }
        allMissing = false;
        resultsPerServer[server] = result;
        if (Object.keys(resultsPerServer).length >= minResults) {
          const {serverPicked, sanitizedResult} = sanityCheckCb(resultsPerServer, path);
          if (sanitizedResult.length > 0) {
            return { data: sanitizedResult, exists: true, server: serverPicked };
          } else {
            resultsPerServer = {};
          }
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

  if (sanityCheckCb !== undefined && Object.values(resultsPerServer).length > 0) {
    logger.warn(`Only ${Object.values(resultsPerServer).length} trusted servers responded to ${path} without agreement, skipping`, logger.tags.replication);
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