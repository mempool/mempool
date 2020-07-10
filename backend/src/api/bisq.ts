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
          console.log(`${filename} file changed. Reloading dump file.`);
          this.loadBisqDumpFile();
        }, 1000);
      }
    });
  }

  async loadBisqDumpFile(): Promise<void> {
    try {
      const data = await this.loadData();
      await this.loadBisqBlocksDump(data);
      this.buildIndex();
    } catch (e) {
      console.log('loadBisqDumpFile() error.', e.message);
    }
  }

  getTransaction(txId: string): BisqTransaction | undefined {
    return this.transactionsIndex[txId];
  }

  getTransactions(start: number, length: number): [BisqTransaction[], number] {
    return [this.transactions.slice(start, length + start), this.transactions.length];
  }

  getBlockTransactions(blockHash: string, start: number, length: number): [BisqTransaction[], number] {
    const block = this.blocksIndex[blockHash];
    if (!block) {
      return [[], -1];
    }
    return [block.txs.slice(start, length + start), block.txs.length];
  }

  getBlock(hash: string): BisqBlock | undefined {
    return this.blocksIndex[hash];
  }

  private buildIndex() {
    this.blocks.forEach((block) => {
      if (this.blocksIndex[block.hash]) {
        return;
      }
      this.blocksIndex[block.hash] = block;
      block.txs.forEach((tx) => {
        this.transactions.unshift(tx);
        this.transactionsIndex[tx.id] = tx;
      });
    });
    console.log('Bisq data index rebuilt');
  }

  private async loadBisqBlocksDump(cacheData: string): Promise<void> {
    const start = new Date().getTime();
    if (cacheData && cacheData.length !== 0) {
      console.log('Parsing Bisq data from dump file');
      const data: BisqBlocks = JSON.parse(cacheData);
      if (data.blocks && data.blocks.length !== this.blocks.length) {
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
