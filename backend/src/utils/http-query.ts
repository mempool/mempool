import http from 'node:http';
import https from 'node:https';
import { SocksProxyAgent } from 'socks-proxy-agent';
import backendInfo from '../api/backend-info';
import config from '../config';
import logger from '../logger';

export async function query(url, formatResponseJson = true): Promise<any> {
  let client;
  if (url.indexOf('https') !== -1) {
    client = https;
  } else {
    client = http;
  }

  let retry = 0;
  while (retry < config.MEMPOOL.EXTERNAL_MAX_RETRY) {
    logger.debug(`GET ${url} (attempt ${retry + 1}/${config.MEMPOOL.EXTERNAL_MAX_RETRY})`);

    const options: any = {
      headers: {
        'User-Agent': (config.MEMPOOL.USER_AGENT === 'mempool') ? `mempool/v${backendInfo.getBackendInfo().version}` : `${config.MEMPOOL.USER_AGENT}`
      },
      timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000,
    };

    // Tor
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
      options.httpsAgent = new SocksProxyAgent(socksOptions);
    }

    try {
      return await attempt(url, client, options, formatResponseJson);
    } catch (e) {
      retry++;
      if (retry >= config.MEMPOOL.EXTERNAL_MAX_RETRY) {
        logger.err(`GET ${url} failed after ${retry} attempts`);
        return null;
      }
    }
  }

  return null;
}

export async function attempt(url, client, options, formatResponseJson = true): Promise<any> {
  return new Promise((resolve, reject) => {
    let data = '';
    client.get(url, options, response => {
      response.on('data', chunk => {
        data += chunk;
      });
      response.on('end', () => {
        if (formatResponseJson) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            logger.debug(`GET ${url} failed. formatResponseJson flag is true, but we could not parse the response as JSON. Exception ${e}`);
            reject(null);
          }
        } else {
          resolve(data);
        }
      });
    }).on('error', err => {
      logger.debug(`GET ${url} failed. Error: ${err}`);
    });
  });
}