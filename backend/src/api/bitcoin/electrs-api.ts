const config = require('../../../mempool-config.json');
import { Transaction, Block } from '../../interfaces';
import * as request from 'request';

class ElectrsApi {

  constructor() {
  }

  getRawMempool(): Promise<Transaction['txid'][]> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/mempool/txids', { json: true, timeout: 10000, forever: true }, (err, res, response) => {
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

  getRawTransaction(txId: string): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/tx/' + txId, { json: true, timeout: 10000, forever: true }, (err, res, response) => {
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

  getBlockHeightTip(): Promise<number> {
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

  getTxIdsForBlock(hash: string): Promise<Block> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS_API_URL + '/block/' + hash + '/txids', { json: true, timeout: 10000 }, (err, res, response) => {
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

  getBlock(hash: string): Promise<Block> {
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
}

export default new ElectrsApi();
