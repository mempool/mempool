import config from '../../config';
const bitcoin = require('./rpc-api/index');

const nodeRpcCredentials: any = {
  host: config.CORE_RPC.HOST,
  port: config.CORE_RPC.PORT,
  user: config.CORE_RPC.USERNAME,
  pass: config.CORE_RPC.PASSWORD,
  timeout: 60000,
};

export default new bitcoin.Client(nodeRpcCredentials);
