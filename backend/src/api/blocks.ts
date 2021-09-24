import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, TransactionExtended } from '../mempool.interfaces';
import { Common } from './common';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';
import bitcoinClient from './bitcoin/bitcoin-client';

class Blocks {
  private blocks: BlockExtended[] = [];
  private currentBlockHeight = 0;
  private currentDifficulty = 0;
  private lastDifficultyAdjustmentTime = 0;
  private previousDifficultyRetarget = 0;
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
      this.currentBlockHeight = blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT;
    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
    }

    if (blockHeightTip - this.currentBlockHeight > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 2) {
      logger.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${config.MEMPOOL.INITIAL_BLOCKS_AMOUNT} recent blocks`);
      this.currentBlockHeight = blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT;
    }

    if (!this.lastDifficultyAdjustmentTime) {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      if (blockchainInfo.blocks === blockchainInfo.headers) {
        const heightDiff = blockHeightTip % 2016;
        const blockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff);
        const block = await bitcoinApi.$getBlock(blockHash);
        this.lastDifficultyAdjustmentTime = block.timestamp;
        this.currentDifficulty = block.difficulty;

        const previousPeriodBlockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff - 2016);
        const previousPeriodBlock = await bitcoinApi.$getBlock(previousPeriodBlockHash);
        this.previousDifficultyRetarget = (block.difficulty - previousPeriodBlock.difficulty) / previousPeriodBlock.difficulty * 100;
        logger.debug(`Initial difficulty adjustment data set.`);
      } else {
        logger.debug(`Blockchain headers (${blockchainInfo.headers}) and blocks (${blockchainInfo.blocks}) not in sync. Waiting...`);
      }
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
            logger.debug('Error fetching block tx: ' + (e instanceof Error ? e.message : e));
            if (i === 0) {
              throw new Error('Failed to fetch Coinbase transaction: ' + txIds[i]);
            }
          }
        }
      }

      transactions.forEach((tx) => {
        if (!tx.cpfpChecked) {
          Common.setRelativesAndGetCpfpInfo(tx, mempool);
        }
      });

      logger.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${txIds.length - transactionsFound} not found.`);

      const blockExtended: BlockExtended = Object.assign({}, block);
      blockExtended.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
      blockExtended.coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);
      transactions.shift();
      transactions.sort((a, b) => b.effectiveFeePerVsize - a.effectiveFeePerVsize);
      blockExtended.medianFee = transactions.length > 0 ? Common.median(transactions.map((tx) => tx.effectiveFeePerVsize)) : 0;
      blockExtended.feeRange = transactions.length > 0 ? Common.getFeesInRange(transactions, 8) : [0, 0];

      if (block.height % 2016 === 0) {
        this.previousDifficultyRetarget = (block.difficulty - this.currentDifficulty) / this.currentDifficulty * 100;
        this.lastDifficultyAdjustmentTime = block.timestamp;
        this.currentDifficulty = block.difficulty;
      }

      this.blocks.push(blockExtended);
      if (this.blocks.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blocks = this.blocks.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
      }

      if (this.newBlockCallbacks.length) {
        this.newBlockCallbacks.forEach((cb) => cb(blockExtended, txIds, transactions));
      }
      if (memPool.isInSync()) {
        diskCache.$saveCacheToDisk();
      }
    }
  }

  public getLastDifficultyAdjustmentTime(): number {
    return this.lastDifficultyAdjustmentTime;
  }

  public getPreviousDifficultyRetarget(): number {
    return this.previousDifficultyRetarget;
  }

  public getCurrentBlockHeight(): number {
    return this.currentBlockHeight;
  }
}

export default new Blocks();
