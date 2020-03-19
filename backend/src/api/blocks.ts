const config = require('../../mempool-config.json');
import bitcoinApi from './bitcoin/electrs-api';
import memPool from './mempool';
import { Block, TransactionExtended } from '../interfaces';

class Blocks {
  private blocks: Block[] = [];
  private currentBlockHeight = 0;
  private newBlockCallback: Function = () => {};

  constructor() { }

  public getBlocks(): Block[] {
    return this.blocks;
  }

  public setBlocks(blocks: Block[]) {
    this.blocks = blocks;
  }

  public setNewBlockCallback(fn: Function) {
    this.newBlockCallback = fn;
  }

  public async updateBlocks() {
    try {
      const blockHeightTip = await bitcoinApi.getBlockHeightTip();

      if (this.blocks.length === 0) {
        this.currentBlockHeight = blockHeightTip - config.INITIAL_BLOCK_AMOUNT;
      } else {
        this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
      }

      if (blockHeightTip - this.currentBlockHeight > config.INITIAL_BLOCK_AMOUNT * 2) {
        console.log(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${config.INITIAL_BLOCK_AMOUNT} recent blocks`);
        this.currentBlockHeight = blockHeightTip - config.INITIAL_BLOCK_AMOUNT;
      }

      while (this.currentBlockHeight < blockHeightTip) {
        if (this.currentBlockHeight === 0) {
          this.currentBlockHeight = blockHeightTip;
        } else {
          this.currentBlockHeight++;
          console.log(`New block found (#${this.currentBlockHeight})!`);
        }

        const blockHash = await bitcoinApi.getBlockHash(this.currentBlockHeight);
        const block = await bitcoinApi.getBlock(blockHash);
        const txIds = await bitcoinApi.getTxIdsForBlock(blockHash);

        const mempool = memPool.getMempool();
        let found = 0;
        let notFound = 0;

        const transactions: TransactionExtended[] = [];

        for (let i = 0; i < txIds.length; i++) {
          if (mempool[txIds[i]]) {
            transactions.push(mempool[txIds[i]]);
            found++;
          } else {
            console.log(`Fetching block tx ${i} of ${txIds.length}`);
            const tx = await memPool.getTransactionExtended(txIds[i]);
            if (tx) {
              transactions.push(tx);
            }
            notFound++;
          }
        }

        console.log(`${found} of ${txIds.length} found in mempool. ${notFound} not found.`);

        block.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
        transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
        block.medianFee = transactions.length > 1 ? this.median(transactions.map((tx) => tx.feePerVsize)) : 0;
        block.feeRange = transactions.length > 1 ? this.getFeesInRange(transactions, 8) : [0, 0];

        this.blocks.push(block);
        if (this.blocks.length > config.KEEP_BLOCK_AMOUNT) {
          this.blocks.shift();
        }

        this.newBlockCallback(block, txIds, transactions);
      }

    } catch (err) {
      console.log('updateBlocks error', err);
    }
  }

  private median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    if (numsLen % 2 === 0) {
        medianNr = (numbers[numsLen / 2 - 1] + numbers[numsLen / 2]) / 2;
    } else {
        medianNr = numbers[(numsLen - 1) / 2];
    }
    return medianNr;
  }

  private getFeesInRange(transactions: any[], rangeLength: number) {
    const arr = [transactions[transactions.length - 1].feePerVsize];
    const chunk = 1 / (rangeLength - 1);
    let itemsToAdd = rangeLength - 2;

    while (itemsToAdd > 0) {
      arr.push(transactions[Math.floor(transactions.length * chunk * itemsToAdd)].feePerVsize);
      itemsToAdd--;
    }

    arr.push(transactions[1].feePerVsize);
    return arr;
  }
}

export default new Blocks();
