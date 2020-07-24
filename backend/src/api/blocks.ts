const config = require('../../mempool-config.json');
import bitcoinApi from './bitcoin/electrs-api';
import memPool from './mempool';
import { Block, TransactionExtended, TransactionMinerInfo } from '../interfaces';
import { Common } from './common';

class Blocks {
  private blocks: Block[] = [];
  private currentBlockHeight = 0;
  private newBlockCallback: ((block: Block, txIds: string[], transactions: TransactionExtended[]) => void) | undefined;

  constructor() { }

  public getBlocks(): Block[] {
    return this.blocks;
  }

  public setBlocks(blocks: Block[]) {
    this.blocks = blocks;
  }

  public setNewBlockCallback(fn: (block: Block, txIds: string[], transactions: TransactionExtended[]) => void) {
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
        block.coinbaseTx = this.stripCoinbaseTransaction(transactions[0]);
        transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
        block.medianFee = transactions.length > 1 ? Common.median(transactions.map((tx) => tx.feePerVsize)) : 0;
        block.feeRange = transactions.length > 1 ? Common.getFeesInRange(transactions.slice(0, transactions.length - 1), 8) : [0, 0];

        this.blocks.push(block);
        if (this.blocks.length > config.KEEP_BLOCK_AMOUNT) {
          this.blocks.shift();
        }

        if (this.newBlockCallback) {
          this.newBlockCallback(block, txIds, transactions);
        }
      }

    } catch (err) {
      console.log('updateBlocks error', err);
    }
  }

  private stripCoinbaseTransaction(tx: TransactionExtended): TransactionMinerInfo {
    return {
      vin: [{
        scriptsig: tx.vin[0].scriptsig
      }],
      vout: tx.vout
        .map((vout) => ({ scriptpubkey_address: vout.scriptpubkey_address, value: vout.value }))
        .filter((vout) => vout.value)
    };
  }
}

export default new Blocks();
