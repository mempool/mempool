const config = require('../../../mempool-config.json');
import { ITransaction, IMempoolInfo, IBlock } from '../../interfaces';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import * as request from 'request';

class EsploraApi implements AbstractBitcoinApi {

  constructor() {
  }

  getMempoolInfo(): Promise<IMempoolInfo> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/mempool', { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve({
          size: response.count,
          bytes: response.vsize,
        });
      });
    });
  }

  getRawMempool(): Promise<ITransaction['txid'][]> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/mempool/txids', { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getRawTransaction(txId: string): Promise<ITransaction> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/tx/' + txId, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        response.vsize = Math.round(response.weight / 4);
        response.fee = response.fee / 100000000;
        response.blockhash = response.status.block_hash;

        resolve(response);
      });
    });
  }

  getBlockCount(): Promise<number> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/blocks/tip/height', { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getBlockAndTransactions(hash: string): Promise<IBlock> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/block/' + hash, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        request(config.ESPLORA_API_URL + '/block/' + hash + '/txids', { json: true }, (err2, res2, response2) => {
          if (err2) {
            reject(err2);
          }
          const block = response;
          block.hash = hash;
          block.nTx = block.tx_count;
          block.time = block.timestamp;
          block.tx = response2;

          resolve(block);
        });
      });
    });
  }

  getBlockHash(height: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/block-height/' + height, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getBlocks(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/blocks', { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getBlocksFromHeight(height: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/blocks/' + height, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getBlock(hash: string): Promise<IBlock> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/block/' + hash, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getBlockTransactions(hash: string): Promise<IBlock> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/block/' + hash + '/txs', { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getBlockTransactionsFromIndex(hash: string, index: number): Promise<IBlock> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/block/' + hash + '/txs/' + index, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getAddress(address: string): Promise<IBlock> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/address/' + address, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getAddressTransactions(address: string): Promise<IBlock> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/address/' + address + '/txs', { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }

  getAddressTransactionsFromLastSeenTxid(address: string, lastSeenTxid: string): Promise<IBlock> {
    return new Promise(async (resolve, reject) => {
      request(config.ESPLORA_API_URL + '/address/' + address + '/txs/chain/' + lastSeenTxid, { json: true }, (err, res, response) => {
        if (err) {
          reject(err);
        }
        resolve(response);
      });
    });
  }
}

export default EsploraApi;
