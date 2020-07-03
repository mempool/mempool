import * as fs from 'fs';
import { BisqBlocks, BisqBlock, BisqTransaction } from '../interfaces';

class Bisq {
  static FILE_NAME = './blocks.json';
  private latestBlockHeight = 0;
  private blocks: BisqBlock[] = [];
  private transactions: BisqTransaction[] = [];
  private transactionsIndex: { [txId: string]: BisqTransaction } = {};
  private blocksIndex: { [hash: string]: BisqBlock } = {};

  constructor() {}

  startBisqService(): void {
    this.loadBisqDumpFile();
  }

  async loadBisqDumpFile(): Promise<void> {
    await this.loadBisqBlocksDump();
    this.buildIndex();
  }

  getTransaction(txId: string): BisqTransaction | undefined {
    return this.transactionsIndex[txId];
  }

  getTransactions(start: number, length: number): [BisqTransaction[], number] {
    return [this.transactions.slice(start, length + start), this.transactions.length];
  }

  getBlock(hash: string): BisqBlock | undefined {
    return this.blocksIndex[hash];
  }

  private buildIndex() {
    this.blocks.forEach((block) => {
      this.blocksIndex[block.hash] = block;
      block.txs.forEach((tx) => {
        this.transactions.push(tx);
        this.transactionsIndex[tx.id] = tx;
      });
    });
    this.blocks.reverse();
    this.transactions.reverse();
    console.log('Bisq data index rebuilt');
  }

  private async loadBisqBlocksDump() {
    const start = new Date().getTime();
    const cacheData = await this.loadData();
    if (cacheData) {
      console.log('Parsing Bisq data from dump file');
      const data: BisqBlocks = JSON.parse(cacheData);
      if (data.blocks) {
        this.blocks = data.blocks;
        this.latestBlockHeight = data.chainHeight;
        const end = new Date().getTime();
        const time = end - start;
        console.log('Loaded bisq dump in ' + time + ' ms');
      } else {
        throw new Error(`Bisq dump didn't contain any blocks`);
      }
    }
  }

  private loadData(): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(Bisq.FILE_NAME, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    });
  }
}

export default new Bisq();
