const config = require('../../mempool-config.json');
import * as fs from 'fs';
import { BisqBlocks, BisqBlock, BisqTransaction } from '../interfaces';

class Bisq {
  private blocks: BisqBlock[] = [];
  private transactions: BisqTransaction[] = [];
  private transactionIndex: { [txId: string]: BisqTransaction } = {};
  private blockIndex: { [hash: string]: BisqBlock } = {};
  private addressIndex: { [address: string]: BisqTransaction[] } = {};

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
    return this.transactionIndex[txId];
  }

  getTransactions(start: number, length: number): [BisqTransaction[], number] {
    return [this.transactions.slice(start, length + start), this.transactions.length];
  }

  getBlock(hash: string): BisqBlock | undefined {
    return this.blockIndex[hash];
  }

  getAddress(hash: string): BisqTransaction[] {
    return this.addressIndex[hash];
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
    this.transactionIndex = {};
    this.addressIndex = {};

    this.blocks.forEach((block) => {
      /* Build block index */
      if (!this.blockIndex[block.hash]) {
        this.blockIndex[block.hash] = block;
      }

      /* Build transactions index */
      block.txs.forEach((tx) => {
        this.transactions.push(tx);
        this.transactionIndex[tx.id] = tx;
      });
    });

    /* Build address index */
    this.transactions.forEach((tx) => {
      tx.inputs.forEach((input) => {
        if (!this.addressIndex[input.address]) {
          this.addressIndex[input.address] = [];
        }
        if (this.addressIndex[input.address].indexOf(tx) === -1) {
          this.addressIndex[input.address].push(tx);
        }
      });
      tx.outputs.forEach((output) => {
        if (!this.addressIndex[output.address]) {
          this.addressIndex[output.address] = [];
        }
        if (this.addressIndex[output.address].indexOf(tx) === -1) {
          this.addressIndex[output.address].push(tx);
        }
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
        this.blocks = data.blocks.filter((block) => block.txs.length > 0);
        this.blocks.reverse();
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
