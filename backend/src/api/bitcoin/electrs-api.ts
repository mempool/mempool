import config from '../../config';
import { Transaction, Block, MempoolInfo } from '../../interfaces';
import * as request from 'request';

class ElectrsApi {

  constructor() {
  }

  getMempoolInfo(): Promise<MempoolInfo> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS.REST_API_URL + '/mempool', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject('getMempoolInfo error: ' + err.message || err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          if (typeof response.count !== 'number') {
            reject('Empty data');
            return;
          }
          resolve({
            size: response.count,
            bytes: response.vsize,
          });
        }
      });
    });
  }

  getRawMempool(): Promise<Transaction['txid'][]> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS.REST_API_URL + '/mempool/txids', { json: true, timeout: 10000, forever: true }, (err, res, response) => {
        if (err) {
          reject('getRawMempool error: ' + err.message || err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          if (response.constructor === Array) {
            resolve(response);
          } else {
            reject('returned invalid data');
          }
        }
      });
    });
  }

  getRawTransaction(txId: string): Promise<Transaction> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS.REST_API_URL + '/tx/' + txId, { json: true, timeout: 10000, forever: true }, (err, res, response) => {
        if (err) {
          reject('getRawTransaction error: ' + err.message || err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          if (response.constructor === Object) {
            resolve(response);
          } else {
            reject('returned invalid data');
          }
        }
      });
    });
  }

  getBlockHeightTip(): Promise<number> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS.REST_API_URL + '/blocks/tip/height', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject('getBlockHeightTip error: ' + err.message || err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          resolve(response);
        }
      });
    });
  }

  getTxIdsForBlock(hash: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS.REST_API_URL + '/block/' + hash + '/txids', { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject('getTxIdsForBlock error: ' + err.message || err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          if (response.constructor === Array) {
            resolve(response);
          } else {
            reject('returned invalid data');
          }
        }
      });
    });
  }

  getBlockHash(height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      request(config.ELECTRS.REST_API_URL + '/block-height/' + height, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject('getBlockHash error: ' + err.message || err);
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
      request(config.ELECTRS.REST_API_URL + '/blocks/' + height, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject('getBlocksFromHeight error: ' + err.message || err);
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
      request(config.ELECTRS.REST_API_URL + '/block/' + hash, { json: true, timeout: 10000 }, (err, res, response) => {
        if (err) {
          reject('getBlock error: ' + err.message || err);
        } else if (res.statusCode !== 200) {
          reject(response);
        } else {
          if (response.constructor === Object) {
            resolve(response);
          } else {
            reject('getBlock returned invalid data');
          }
        }
      });
    });
  }
}

export default new ElectrsApi();
