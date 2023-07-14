import config from '../config';
import backendInfo from '../api/backend-info';
import axios, { AxiosResponse } from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import * as https from 'https';

export async function $sync(path): Promise<{ data?: any, exists: boolean, server?: string }> {
  // start with a random server so load is uniformly spread
  let allMissing = true;
  const offset = Math.floor(Math.random() * config.REPLICATION.SERVERS.length);
  for (let i = 0; i < config.REPLICATION.SERVERS.length; i++) {
    const server = config.REPLICATION.SERVERS[(i + offset) % config.REPLICATION.SERVERS.length];
    // don't query ourself
    if (server === backendInfo.getBackendInfo().hostname) {
      continue;
    }
    
    try {
      const result = await query(`https://${server}${path}`);
      if (result) {
        return { data: result, exists: true, server };
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