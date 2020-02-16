const config = require('../../mempool-config.json');
import bitcoinApi from './bitcoin/electrs-api';
import { Block } from '../interfaces';

class Blocks {
  private blocks: Block[] = [];
  private currentBlockHeight = 0;
  private newBlockCallback: Function = () => {};

  constructor() { }

  public getBlocks(): Block[] {
    return this.blocks;
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

        block.medianFee = 2;
        block.feeRange = [1, 3];

        this.blocks.push(block);
        if (this.blocks.length > config.KEEP_BLOCK_AMOUNT) {
          this.blocks.shift();
        }

        this.newBlockCallback(block, txIds);
      }

    } catch (err) {
      console.log('updateBlocks error', err);
    }
  }

  private median(numbers: number[]) {
    let medianNr = 0;
    const numsLen = numbers.length;
    numbers.sort();
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

    arr.push(transactions[0].feePerVsize);
    return arr;
  }
}

export default new Blocks();
