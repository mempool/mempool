const config = require('../../mempool-config.json');
import * as fs from 'fs';
import { BisqBlocks, BisqBlock, BisqTransaction } from '../interfaces';

class Bisq {
  private latestBlockHeight = 0;
  private blocks: BisqBlock[] = [];
  private transactions: BisqTransaction[] = [];
  private transactionsIndex: { [txId: string]: BisqTransaction } = {};
  private blocksIndex: { [hash: string]: BisqBlock } = {};

  constructor() {}

  startBisqService(): void {
    this.loadBisqDumpFile();

    let fsWait: NodeJS.Timeout | null = null;
    fs.watch(config.BSQ_BLOCKS_DATA_PATH, (event, filename) => {
      if (filename) {
        if (fsWait) {
          clearTimeout(fsWait);
        }
        fsWait = setTimeout(() => {
          console.log(`${filename} file change detected.`);
          this.loadBisqDumpFile();
        }, 1000);
      }
    });
  }

  getTransaction(txId: string): BisqTransaction | undefined {
    return this.transactionsIndex[txId];
  }

  getTransactions(start: number, length: number): [BisqTransaction[], number] {
    return [this.transactions.slice(start, length + start), this.transactions.length];
  }

  getBlock(hash: string): BisqBlock | undefined {
    console.log(hash);
    console.log(this.blocksIndex[hash]);
    return this.blocksIndex[hash];
  }

  getBlocks(start: number, length: number): [BisqBlock[], number] {
    return [this.blocks.slice(start, length + start), this.blocks.length];
  }

  private async loadBisqDumpFile(): Promise<void> {
    try {
      const data = await this.loadData();
      await this.loadBisqBlocksDump(data);
      this.buildIndex();
    } catch (e) {
      console.log('loadBisqDumpFile() error.', e.message);
    }
  }

  private buildIndex() {
    const start = new Date().getTime();
    this.transactions = [];
    this.transactionsIndex = {};
    this.blocks.forEach((block) => {
      if (!this.blocksIndex[block.hash]) {
        this.blocksIndex[block.hash] = block;
      }
      block.txs.forEach((tx) => {
        this.transactions.push(tx);
        this.transactionsIndex[tx.id] = tx;
      });
    });
    const time = new Date().getTime() - start;
    console.log('Bisq data index rebuilt in ' + time + ' ms');
  }

  private async loadBisqBlocksDump(cacheData: string): Promise<void> {
    const start = new Date().getTime();
    if (cacheData && cacheData.length !== 0) {
      console.log('Loading Bisq data from dump...');
      const data: BisqBlocks = JSON.parse(cacheData);
      if (data.blocks && data.blocks.length !== this.blocks.length) {
        this.blocks = data.blocks;
        this.blocks.reverse();
        this.latestBlockHeight = data.chainHeight;
        const time = new Date().getTime() - start;
        console.log('Bisq dump loaded in ' + time + ' ms');
      } else {
        throw new Error(`Bisq dump didn't contain any blocks`);
      }
    }
  }

  private loadData(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(config.BSQ_BLOCKS_DATA_PATH, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    });
  }
}

export default new Bisq();
