import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, TransactionExtended } from '../mempool.interfaces';
import { Common } from './common';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';

class Blocks {
  private static INITIAL_BLOCK_AMOUNT = 8;
  private blocks: BlockExtended[] = [];
  private currentBlockHeight = 0;
  private lastDifficultyAdjustmentTime = 0;
  private newBlockCallbacks: ((block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => void)[] =
    [];

  constructor() {}

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
      this.currentBlockHeight = blockHeightTip - Blocks.INITIAL_BLOCK_AMOUNT;
    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
    }

    if (blockHeightTip - this.currentBlockHeight > Blocks.INITIAL_BLOCK_AMOUNT * 2) {
      logger.info(
        `${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${
          Blocks.INITIAL_BLOCK_AMOUNT
        } recent blocks`
      );
      this.currentBlockHeight = blockHeightTip - Blocks.INITIAL_BLOCK_AMOUNT;
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
        if (mempool[txIds[i]]) {
          transactions.push(mempool[txIds[i]]);
          transactionsFound++;
        } else if (config.MEMPOOL.BACKEND === 'esplora' || memPool.isInSync() || i === 0) {
          logger.debug(`Fetching block tx ${i} of ${txIds.length}`);
          try {
            const tx = await transactionUtils.$getTransactionExtended(txIds[i]);
            transactions.push(tx);
          } catch (e) {
            logger.debug('Error fetching block tx: ' + e.message || e);
            if (i === 0) {
              throw new Error('Failed to fetch Coinbase transaction: ' + txIds[i]);
            }
          }
        }
      }

      transactions.forEach(tx => {
        if (!tx.cpfpChecked) {
          Common.setRelativesAndGetCpfpInfo(tx, mempool);
        }
      });

      logger.debug(
        `${transactionsFound} of ${txIds.length} found in mempool. ${txIds.length - transactionsFound} not found.`
      );

      const blockExtended: BlockExtended = Object.assign({}, block);
      blockExtended.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
      blockExtended.coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);
      transactions.shift();
      transactions.sort((a, b) => b.effectiveFeePerVsize - a.effectiveFeePerVsize);
      blockExtended.medianFee =
        transactions.length > 1 ? Common.median(transactions.map(tx => tx.effectiveFeePerVsize)) : 0;
      blockExtended.feeRange = transactions.length > 1 ? Common.getFeesInRange(transactions, 8) : [0, 0];

      if (block.height % 2016 === 0) {
        this.lastDifficultyAdjustmentTime = block.timestamp;
      }

      this.blocks.push(blockExtended);
      if (this.blocks.length > Blocks.INITIAL_BLOCK_AMOUNT * 4) {
        this.blocks = this.blocks.slice(-Blocks.INITIAL_BLOCK_AMOUNT * 4);
      }

      if (this.newBlockCallbacks.length) {
        this.newBlockCallbacks.forEach(cb => cb(blockExtended, txIds, transactions));
      }
      if (memPool.isInSync()) {
        diskCache.$saveCacheToDisk();
      }
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
