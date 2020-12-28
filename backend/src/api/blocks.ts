import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { Common } from './common';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';

class Blocks {
  private static KEEP_BLOCK_AMOUNT = 8;
  private blocks: BlockExtended[] = [];
  private currentBlockHeight = 0;
  private lastDifficultyAdjustmentTime = 0;
  private newBlockCallbacks: ((block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => void)[] = [];

  constructor() { }

  public getBlocks(): BlockExtended[] {
    return this.blocks;
  }

  public setBlocks(blocks: BlockExtended[]) {
    this.blocks = blocks;
  }

  public setNewBlockCallback(fn: (block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => void) {
    this.newBlockCallbacks.push(fn);
  }

  public async $updateBlocks() {
    const blockHeightTip = await bitcoinApi.$getBlockHeightTip();

    if (this.blocks.length === 0) {
      this.currentBlockHeight = blockHeightTip - Blocks.KEEP_BLOCK_AMOUNT;
    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
    }

    if (blockHeightTip - this.currentBlockHeight > Blocks.KEEP_BLOCK_AMOUNT * 2) {
      logger.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${Blocks.KEEP_BLOCK_AMOUNT} recent blocks`);
      this.currentBlockHeight = blockHeightTip - Blocks.KEEP_BLOCK_AMOUNT;
    }

    if (!this.lastDifficultyAdjustmentTime) {
      const heightDiff = blockHeightTip % 2016;
      const blockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff);
      const block = await bitcoinApi.$getBlock(blockHash);
      this.lastDifficultyAdjustmentTime = block.timestamp;
    }

    while (this.currentBlockHeight < blockHeightTip) {
      if (this.currentBlockHeight === 0) {
        this.currentBlockHeight = blockHeightTip;
      } else {
        this.currentBlockHeight++;
        logger.debug(`New block found (#${this.currentBlockHeight})!`);
      }

      const transactions: TransactionExtended[] = [];

      const blockHash = await bitcoinApi.$getBlockHash(this.currentBlockHeight);
      const block = await bitcoinApi.$getBlock(blockHash);
      const txIds: string[] = await bitcoinApi.$getTxIdsForBlock(blockHash);

      const mempool = memPool.getMempool();
      let transactionsFound = 0;

      for (let i = 0; i < txIds.length; i++) {
        // When using bitcoind, just fetch the coinbase tx for now
        if (config.MEMPOOL.BACKEND !== 'none' && i === 0) {
          let txFound = false;
          let findCoinbaseTxTries = 0;
          // It takes Electrum Server a few seconds to index the transaction after a block is found
          while (findCoinbaseTxTries < 5 && !txFound) {
            const tx = await transactionUtils.$getTransactionExtended(txIds[i]);
            if (tx) {
              txFound = true;
              transactions.push(tx);
            } else {
              await Common.sleep(1000);
              findCoinbaseTxTries++;
            }
          }
        }
        if (mempool[txIds[i]]) {
          transactions.push(mempool[txIds[i]]);
          transactionsFound++;
        } else if (config.MEMPOOL.BACKEND === 'esplora') {
          logger.debug(`Fetching block tx ${i} of ${txIds.length}`);
          const tx = await transactionUtils.$getTransactionExtended(txIds[i]);
          if (tx) {
            transactions.push(tx);
          }
        }
      }

      logger.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${txIds.length - transactionsFound} not found.`);

      const blockExtended: BlockExtended = Object.assign({}, block);
      blockExtended.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
      blockExtended.coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);
      transactions.sort((a, b) => b.feePerVsize - a.feePerVsize);
      blockExtended.medianFee = transactions.length > 1 ? Common.median(transactions.map((tx) => tx.feePerVsize)) : 0;
      blockExtended.feeRange = transactions.length > 1 ? Common.getFeesInRange(transactions.slice(0, transactions.length - 1), 8) : [0, 0];

      if (block.height % 2016 === 0) {
        this.lastDifficultyAdjustmentTime = block.timestamp;
      }

      this.blocks.push(blockExtended);
      if (this.blocks.length > Blocks.KEEP_BLOCK_AMOUNT) {
        this.blocks = this.blocks.slice(-Blocks.KEEP_BLOCK_AMOUNT);
      }

      if (this.newBlockCallbacks.length) {
        this.newBlockCallbacks.forEach((cb) => cb(blockExtended, txIds, transactions));
      }
      diskCache.$saveCacheToDisk();
    }
  }

  public getLastDifficultyAdjustmentTime(): number {
    return this.lastDifficultyAdjustmentTime;
  }

  public getCurrentBlockHeight(): number {
    return this.currentBlockHeight;
  }
}

export default new Blocks();
