import bitcoinApi from './bitcoin/electrs-api';
import logger from '../logger';
import memPool from './mempool';
import { Block, TransactionExtended, TransactionMinerInfo } from '../interfaces';
import { Common } from './common';

class Blocks {
  private static INITIAL_BLOCK_AMOUNT = 8;
  private static KEEP_BLOCK_AMOUNT = 24;
  private blocks: Block[] = [];
  private currentBlockHeight = 0;
  private lastDifficultyAdjustmentTime = 0;
  private newBlockCallbacks: ((block: Block, txIds: string[], transactions: TransactionExtended[]) => void)[] = [];

  constructor() { }

  public getBlocks(): Block[] {
    return this.blocks;
  }

  public setBlocks(blocks: Block[]) {
    this.blocks = blocks;
  }

  public setNewBlockCallback(fn: (block: Block, txIds: string[], transactions: TransactionExtended[]) => void) {
    this.newBlockCallbacks.push(fn);
  }

  public async $updateBlocks() {
    const blockHeightTip = await bitcoinApi.getBlockHeightTip();

    if (this.blocks.length === 0) {
      this.currentBlockHeight = blockHeightTip - Blocks.INITIAL_BLOCK_AMOUNT;
    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
    }

    if (blockHeightTip - this.currentBlockHeight > Blocks.INITIAL_BLOCK_AMOUNT * 2) {
      logger.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${Blocks.INITIAL_BLOCK_AMOUNT} recent blocks`);
      this.currentBlockHeight = blockHeightTip - Blocks.INITIAL_BLOCK_AMOUNT;
    }

    if (!this.lastDifficultyAdjustmentTime) {
      const heightDiff = blockHeightTip % 2016;
      const blockHash = await bitcoinApi.getBlockHash(blockHeightTip - heightDiff);
      const block = await bitcoinApi.getBlock(blockHash);
      this.lastDifficultyAdjustmentTime = block.timestamp;
    }

    while (this.currentBlockHeight < blockHeightTip) {
      if (this.currentBlockHeight === 0) {
        this.currentBlockHeight = blockHeightTip;
      } else {
        this.currentBlockHeight++;
        logger.debug(`New block found (#${this.currentBlockHeight})!`);
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
          logger.debug(`Fetching block tx ${i} of ${txIds.length}`);
          const tx = await memPool.getTransactionExtended(txIds[i]);
          if (tx) {
            transactions.push(tx);
          }
          notFound++;
        }
      }

      logger.debug(`${found} of ${txIds.length} found in mempool. ${notFound} not found.`);

      block.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
      block.coinbaseTx = this.stripCoinbaseTransaction(transactions[0]);
      transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
      block.medianFee = transactions.length > 1 ? Common.median(transactions.map((tx) => tx.feePerVsize)) : 0;
      block.feeRange = transactions.length > 1 ? Common.getFeesInRange(transactions.slice(0, transactions.length - 1), 8) : [0, 0];

      if (block.height % 2016 === 0) {
        this.lastDifficultyAdjustmentTime = block.timestamp;
      }

      this.blocks.push(block);
      if (this.blocks.length > Blocks.KEEP_BLOCK_AMOUNT) {
        this.blocks.shift();
      }

      if (this.newBlockCallbacks.length) {
        this.newBlockCallbacks.forEach((cb) => cb(block, txIds, transactions));
      }
    }
  }

  public getLastDifficultyAdjustmentTime(): number {
    return this.lastDifficultyAdjustmentTime;
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
