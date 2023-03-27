import config from '../../config';
const bitcoin = require('../../rpc-api/index');
import { BitcoinRpcCredentials } from './bitcoin-api-abstract-factory';

const nodeRpcCredentials: BitcoinRpcCredentials = {
  host: config.SECOND_CORE_RPC.HOST,
  port: config.SECOND_CORE_RPC.PORT,
  user: config.SECOND_CORE_RPC.USERNAME,
  pass: config.SECOND_CORE_RPC.PASSWORD,
  timeout: config.SECOND_CORE_RPC.TIMEOUT,
  cookie: config.SECOND_CORE_RPC.COOKIE ? config.SECOND_CORE_RPC.COOKIE_PATH : undefined,
};

export default new bitcoin.Client(nodeRpcCredentials);
