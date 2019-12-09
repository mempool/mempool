const config = require('../../../mempool-config.json');
import { ITransaction, IMempoolInfo, IBlock } from '../../interfaces';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import * as request from 'request';

class ElectrsApi implements AbstractBitcoinApi {

  constructor() {
  }

  getMempoolInfo(): Promise<IMempoolInfo> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/mempool', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          resolve({
            size: response.count,
            bytes: response.vsize,
          });
        }
      });
    });
  }

  getRawMempool(): Promise<ITransaction['txid'][]> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/mempool/txids', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  }

  getRawTransaction(txId: string): Promise<ITransaction> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/tx/' + txId, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          response.vsize = Math.round(response.weight / 4);
          response.fee = response.fee / 100000000;
          response.blockhash = response.status.block_hash;
          resolve(response);
        }
      });
    });
  }

  getBlockCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/blocks/tip/height', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  }

  getBlockAndTransactions(hash: string): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/block/' + hash, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          request(config.ELECTRS_API_URL + '/block/' + hash + '/txids', { json: true, timeout: 10000 }, (err2, res2, response2) => {
            if (err2) {
              reject(err2);
            } else if (res.statusCode !== 200) {
              reject(response);
            } else {
              const block = response;
              block.hash = hash;
              block.nTx = block.tx_count;
              block.time = block.timestamp;
              block.tx = response2;

              resolve(block);
            }
          });
        }
      });
    });
  }

  getBlockHash(height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/block-height/' + height, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getBlocks(): Promise<string> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/blocks', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getBlocksFromHeight(height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/blocks/' + height, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getBlock(hash: string): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/block/' + hash, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getBlockTransactions(hash: string): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/block/' + hash + '/txs', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getBlockTransactionsFromIndex(hash: string, index: number): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/block/' + hash + '/txs/' + index, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getAddress(address: string): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/address/' + address, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getAddressTransactions(address: string): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/address/' + address + '/txs', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }

  getAddressTransactionsFromLastSeenTxid(address: string, lastSeenTxid: string): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/address/' + address + '/txs/chain/' + lastSeenTxid,
        { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else  {
          resolve(response);
        }
      });
    });
  }
}

export default ElectrsApi;
