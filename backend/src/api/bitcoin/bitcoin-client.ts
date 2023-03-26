import config from '../../config';
const bitcoin = require('../../rpc-api/index');
import { BitcoinRpcCredentials } from './bitcoin-api-abstract-factory';

export const defaultCookiePath = `${process.env.HOME}/.bitcoin/${{mainnet:'',testnet:'testnet3/',signet:'signet/'}[config.MEMPOOL.NETWORK]}.cookie`;

const nodeRpcCredentials: BitcoinRpcCredentials = {
  host: config.CORE_RPC.HOST,
  port: config.CORE_RPC.PORT,
  user: config.CORE_RPC.USERNAME,
  pass: config.CORE_RPC.PASSWORD,
  timeout: config.CORE_RPC.TIMEOUT,
  cookie: config.CORE_RPC.COOKIE ? config.CORE_RPC.COOKIE_PATH || defaultCookiePath : undefined,
};

export default new bitcoin.Client(nodeRpcCredentials);
