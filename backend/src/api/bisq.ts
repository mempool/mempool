const config = require('../../mempool-config.json');
import * as fs from 'fs';
import * as request from 'request';
import { BisqBlocks, BisqBlock, BisqTransaction, BisqStats, BisqTrade } from '../interfaces';
import { Common } from './common';

class Bisq {
  private static BLOCKS_JSON_FILE_PATH = '/all/blocks.json';
  private latestBlockHeight = 0;
  private blocks: BisqBlock[] = [];
  private transactions: BisqTransaction[] = [];
  private transactionIndex: { [txId: string]: BisqTransaction } = {};
  private blockIndex: { [hash: string]: BisqBlock } = {};
  private addressIndex: { [address: string]: BisqTransaction[] } = {};
  private stats: BisqStats = {
    minted: 0,
    burnt: 0,
    addresses: 0,
    unspent_txos: 0,
    spent_txos: 0,
  };
  private price: number = 0;
  private priceUpdateCallbackFunction: ((price: number) => void) | undefined;
  private topDirectoryWatcher: fs.FSWatcher | undefined;
  private subdirectoryWatcher: fs.FSWatcher | undefined;

  constructor() {}

  startBisqService(): void {
    this.checkForBisqDataFolder();
    this.loadBisqDumpFile();
    setInterval(this.updatePrice.bind(this), 1000 * 60 * 60);
    this.updatePrice();
    this.startTopDirectoryWatcher();
    this.startSubDirectoryWatcher();
  }

  getTransaction(txId: string): BisqTransaction | undefined {
    return this.transactionIndex[txId];
  }

  getTransactions(start: number, length: number, types: string[]): [BisqTransaction[], number] {
    let transactions = this.transactions;
    if (types.length) {
      transactions = transactions.filter((tx) => types.indexOf(tx.txType) > -1);
    }
    return [transactions.slice(start, length + start), transactions.length];
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

  getStats(): BisqStats {
    return this.stats;
  }

  setPriceCallbackFunction(fn: (price: number) => void) {
    this.priceUpdateCallbackFunction = fn;
  }

  getLatestBlockHeight(): number {
    return this.latestBlockHeight;
  }

  private checkForBisqDataFolder() {
    if (!fs.existsSync(config.BSQ_BLOCKS_DATA_PATH + Bisq.BLOCKS_JSON_FILE_PATH)) {
      console.log(config.BSQ_BLOCKS_DATA_PATH + Bisq.BLOCKS_JSON_FILE_PATH + ` doesn't exist. Make sure Bisq is running and the config is correct before starting the server.`);
      return process.exit(1);
    }
  }

  private startTopDirectoryWatcher() {
    if (this.topDirectoryWatcher) {
      this.topDirectoryWatcher.close();
    }
    let fsWait: NodeJS.Timeout | null = null;
    this.topDirectoryWatcher = fs.watch(config.BSQ_BLOCKS_DATA_PATH, () => {
      if (fsWait) {
        clearTimeout(fsWait);
      }
      if (this.subdirectoryWatcher) {
        this.subdirectoryWatcher.close();
      }
      fsWait = setTimeout(() => {
        console.log(`Bisq restart detected. Resetting both watchers in 3 minutes.`);
        setTimeout(() => {
          this.startTopDirectoryWatcher();
          this.startSubDirectoryWatcher();
          this.loadBisqDumpFile();
        }, 180000);
      }, 15000);
    });
  }

  private startSubDirectoryWatcher() {
    if (this.subdirectoryWatcher) {
      this.subdirectoryWatcher.close();
    }
    if (!fs.existsSync(config.BSQ_BLOCKS_DATA_PATH + Bisq.BLOCKS_JSON_FILE_PATH)) {
      console.log(config.BSQ_BLOCKS_DATA_PATH + Bisq.BLOCKS_JSON_FILE_PATH + ` doesn't exist. Trying to restart sub directory watcher again in 3 minutes.`);
      setTimeout(() => this.startSubDirectoryWatcher(), 180000);
      return;
    }
    let fsWait: NodeJS.Timeout | null = null;
    this.subdirectoryWatcher = fs.watch(config.BSQ_BLOCKS_DATA_PATH + '/all', () => {
      if (fsWait) {
        clearTimeout(fsWait);
      }
      fsWait = setTimeout(() => {
        console.log(`Change detected in the Bisq data folder.`);
        this.loadBisqDumpFile();
      }, 2000);
    });
  }

  private updatePrice() {
    request('https://markets.bisq.network/api/trades/?market=bsq_btc', { json: true }, (err, res, trades: BisqTrade[]) => {
      if (err) { return console.log(err); }

      const prices: number[] = [];
      trades.forEach((trade) => {
        prices.push(parseFloat(trade.price) * 100000000);
      });
      prices.sort((a, b) => a - b);
      this.price = Common.median(prices);
      if (this.priceUpdateCallbackFunction) {
        this.priceUpdateCallbackFunction(this.price);
      }
    });
  }

  private async loadBisqDumpFile(): Promise<void> {
    try {
      const data = await this.loadData();
      await this.loadBisqBlocksDump(data);
      this.buildIndex();
      this.calculateStats();
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

  private calculateStats() {
    let minted = 0;
    let burned = 0;
    let unspent = 0;
    let spent = 0;

    this.transactions.forEach((tx) => {
      tx.outputs.forEach((output) => {
        if (output.opReturn) {
          return;
        }
        if (output.txOutputType === 'GENESIS_OUTPUT' || output.txOutputType === 'ISSUANCE_CANDIDATE_OUTPUT' && output.isVerified) {
          minted += output.bsqAmount;
        }
        if (output.isUnspent) {
          unspent++;
        } else {
          spent++;
        }
      });
      burned += tx['burntFee'];
    });

    this.stats = {
      addresses: Object.keys(this.addressIndex).length,
      minted: minted,
      burnt: burned,
      spent_txos: spent,
      unspent_txos: unspent,
    };
  }

  private async loadBisqBlocksDump(cacheData: string): Promise<void> {
    const start = new Date().getTime();
    if (cacheData && cacheData.length !== 0) {
      console.log('Processing Bisq data dump...');
      const data: BisqBlocks = JSON.parse(cacheData);
      if (data.blocks && data.blocks.length !== this.blocks.length) {
        this.blocks = data.blocks.filter((block) => block.txs.length > 0);
        this.blocks.reverse();
        this.latestBlockHeight = data.chainHeight;
        const time = new Date().getTime() - start;
        console.log('Bisq dump processed in ' + time + ' ms');
      } else {
        throw new Error(`Bisq dump didn't contain any blocks`);
      }
    }
  }

  private loadData(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(config.BSQ_BLOCKS_DATA_PATH + Bisq.BLOCKS_JSON_FILE_PATH)) {
        return reject(Bisq.BLOCKS_JSON_FILE_PATH + ` doesn't exist`);
      }
      fs.readFile(config.BSQ_BLOCKS_DATA_PATH + Bisq.BLOCKS_JSON_FILE_PATH, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        }
        resolve(data);
      });
    });
  }
}

export default new Bisq();
