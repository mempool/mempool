const config = require('../../mempool-config.json');
import * as bitcoin from 'bitcoin-core';
import { ITransaction, IMempoolInfo, IBlock } from '../interfaces';

class BitcoinApi {
  client: any;

  constructor() {
    this.client = new bitcoin.Client({
      host: config.BITCOIN_NODE_HOST,
      port: config.BITCOIN_NODE_PORT,
      user: config.BITCOIN_NODE_USER,
      pass: config.BITCOIN_NODE_PASS,
    });
  }

  getMempoolInfo(): Promise<IMempoolInfo> {
    return new Promise((resolve, reject) => {
      this.client.getMempoolInfo((err: Error, mempoolInfo: any) => {
        if (err) {
          return reject(err);
        }
        resolve(mempoolInfo);
      });
    });
  }

  getRawMempool(): Promise<ITransaction['txid'][]> {
    return new Promise((resolve, reject) => {
      this.client.getRawMemPool((err: Error, transactions: ITransaction['txid'][]) => {
        if (err) {
          return reject(err);
        }
        resolve(transactions);
      });
    });
  }

  getRawTransaction(txId: string): Promise<ITransaction> {
    return new Promise((resolve, reject) => {
      this.client.getRawTransaction(txId, true, (err: Error, txData: ITransaction) => {
        if (err) {
          return reject(err);
        }
        resolve(txData);
      });
    });
  }

  getBlockCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.client.getBlockCount((err: Error, response: number) => {
        if (err) {
          return reject(err);
        }
        resolve(response);
      });
    });
  }

  getBlock(hash: string, verbosity:  1 | 2 = 1): Promise<IBlock> {
    return new Promise((resolve, reject) => {
      this.client.getBlock(hash, verbosity, (err: Error, block: IBlock) => {
        if (err) {
          return reject(err);
        }
        resolve(block);
      });
    });
  }

  getBlockHash(height: number): Promise<string> {
    return new Promise((resolve, reject) => {
      this.client.getBlockHash(height, (err: Error, response: string) => {
        if (err) {
          return reject(err);
        }
        resolve(response);
      });
    });
  }
}

export default new BitcoinApi();
