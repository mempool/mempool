import config from '../../config';
const bitcoin = require('../../rpc-api/index');
import { BitcoinRpcCredentials } from './bitcoin-api-abstract-factory';

const nodeRpcCredentials: BitcoinRpcCredentials = {
  host: config.SECOND_CORE_RPC.HOST,
  port: config.SECOND_CORE_RPC.PORT,
  user: config.SECOND_CORE_RPC.USERNAME,
  pass: config.SECOND_CORE_RPC.PASSWORD,
  timeout: 60000,
};

export default new bitcoin.Client(nodeRpcCredentials);
