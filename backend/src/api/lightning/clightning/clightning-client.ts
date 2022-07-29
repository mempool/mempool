import config from '../../../config';
import CLightningClient from './jsonrpc';

export default new CLightningClient(config.CLIGHTNING.SOCKET);
