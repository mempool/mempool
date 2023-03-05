import config from '../../config';
import Client from '../../rpc-api/index';
import { BitcoinRpcCredentials } from './bitcoin-api-abstract-factory';

import { defaultCookiePath } from './bitcoin-client';

const nodeRpcCredentials: BitcoinRpcCredentials = {
  host: config.SECOND_CORE_RPC.HOST,
  port: config.SECOND_CORE_RPC.PORT,
  user: config.SECOND_CORE_RPC.USERNAME,
  pass: config.SECOND_CORE_RPC.PASSWORD,
  timeout: 60000,
  cookie: config.SECOND_CORE_RPC.COOKIE ? config.SECOND_CORE_RPC.COOKIE_PATH || defaultCookiePath : undefined,
  ssl: false,
  sslStrict: false,
};

export default new Client(nodeRpcCredentials);
