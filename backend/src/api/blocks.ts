import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { Block, Transaction, TransactionExtended, TransactionMinerInfo } from '../interfaces';
import { Common } from './common';
import diskCache from './disk-cache';

class Blocks {
  private static KEEP_BLOCK_AMOUNT = 8;
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

      let transactions: TransactionExtended[] = [];

      const blockHash = await bitcoinApi.getBlockHash(this.currentBlockHeight);
      const block = await bitcoinApi.getBlock(blockHash);
      let txIds: string[] = await bitcoinApi.getTxIdsForBlock(blockHash);

      const mempool = memPool.getMempool();
      let found = 0;

      for (let i = 0; i < txIds.length; i++) {
        if (mempool[txIds[i]]) {
          transactions.push(mempool[txIds[i]]);
          found++;
        } else {
          if (config.MEMPOOL.BACKEND === 'electrs') {
            logger.debug(`Fetching block tx ${i} of ${txIds.length}`);
            const tx = await memPool.getTransactionExtended(txIds[i]);
            if (tx) {
              transactions.push(tx);
            }
          } else { // When using bitcoind, just skip parsing past block tx's for now
            if (i === 0) {
              const tx = await memPool.getTransactionExtended(txIds[i], true);
              if (tx) {
                transactions.push(tx);
              }
            }
          }
        }
      }

      logger.debug(`${found} of ${txIds.length} found in mempool. ${txIds.length - found} not found.`);

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
        this.blocks = this.blocks.slice(-Blocks.KEEP_BLOCK_AMOUNT);
      }

      if (this.newBlockCallbacks.length) {
        this.newBlockCallbacks.forEach((cb) => cb(block, txIds, transactions));
      }
      diskCache.$saveCacheToDisk();
    }
  }

  public getLastDifficultyAdjustmentTime(): number {
    return this.lastDifficultyAdjustmentTime;
  }

  private stripCoinbaseTransaction(tx: TransactionExtended): TransactionMinerInfo {
    return {
      vin: [{
        scriptsig: tx.vin[0].scriptsig || tx.vin[0]['coinbase']
      }],
      vout: tx.vout
        .map((vout) => ({
          scriptpubkey_address: vout.scriptpubkey_address || (vout['scriptPubKey']['addresses'] && vout['scriptPubKey']['addresses'][0]) || null,
          value: vout.value
        }))
        .filter((vout) => vout.value)
    };
  }
}

export default new Blocks();
