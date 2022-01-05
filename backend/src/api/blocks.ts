import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, PoolTag, TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { Common } from './common';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';
import bitcoinClient from './bitcoin/bitcoin-client';
import { DB } from '../database';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import poolsRepository from '../repositories/PoolsRepository';
import blocksRepository from '../repositories/BlocksRepository';

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

  /**
   * Return the list of transaction for a block
   * @param blockHash
   * @param blockHeight
   * @param onlyCoinbase - Set to true if you only need the coinbase transaction
   * @returns Promise<TransactionExtended[]>
   */
  private async $getTransactionsExtended(blockHash: string, blockHeight: number, onlyCoinbase: boolean) : Promise<TransactionExtended[]> {
    const transactions: TransactionExtended[] = [];
    const txIds: string[] = await bitcoinApi.$getTxIdsForBlock(blockHash);

    const mempool = memPool.getMempool();
    let transactionsFound = 0;
    let transactionsFetched = 0;

    for (let i = 0; i < txIds.length; i++) {
      if (mempool[txIds[i]]) {
        // We update blocks before the mempool (index.ts), therefore we can
        // optimize here by directly fetching txs in the "outdated" mempool
        transactions.push(mempool[txIds[i]]);
        transactionsFound++;
      } else if (config.MEMPOOL.BACKEND === 'esplora' || memPool.isInSync() || i === 0) {
        // Otherwise we fetch the tx data through backend services (esplora, electrum, core rpc...)
        if (i % (Math.round((txIds.length) / 10)) === 0 || i + 1 === txIds.length) { // Avoid log spam
          logger.debug(`Indexing tx ${i + 1} of ${txIds.length} in block #${blockHeight}`);
        }
        try {
          const tx = await transactionUtils.$getTransactionExtended(txIds[i]);
          transactions.push(tx);
          transactionsFetched++;
        } catch (e) {
          logger.debug('Error fetching block tx: ' + (e instanceof Error ? e.message : e));
          if (i === 0) {
            throw new Error('Failed to fetch Coinbase transaction: ' + txIds[i]);
          }
        }
      }

      if (onlyCoinbase === true) {
        break; // Fetch the first transaction and exit
      }
    }

    transactions.forEach((tx) => {
      if (!tx.cpfpChecked) {
        Common.setRelativesAndGetCpfpInfo(tx, mempool); // Child Pay For Parent
      }
    });

    logger.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${transactionsFetched} fetched through backend service.`);

    return transactions;
  }

  /**
   * Return a block with additional data (reward, coinbase, fees...)
   * @param block
   * @param transactions
   * @returns BlockExtended
   */
  private getBlockExtended(block: IEsploraApi.Block, transactions: TransactionExtended[]) : BlockExtended {
    const blockExtended: BlockExtended = Object.assign({}, block);
    blockExtended.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
    blockExtended.coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);

    const transactionsTmp = [...transactions];
    transactionsTmp.shift();
    transactionsTmp.sort((a, b) => b.effectiveFeePerVsize - a.effectiveFeePerVsize);
    blockExtended.medianFee = transactionsTmp.length > 0 ? Common.median(transactionsTmp.map((tx) => tx.effectiveFeePerVsize)) : 0;
    blockExtended.feeRange = transactionsTmp.length > 0 ? Common.getFeesInRange(transactionsTmp, 8) : [0, 0];

    return blockExtended;
  }

  /**
   * Try to find which miner found the block
   * @param txMinerInfo
   * @returns
   */
  private async $findBlockMiner(txMinerInfo: TransactionMinerInfo | undefined) : Promise<PoolTag> {
    if (txMinerInfo === undefined) {
      return poolsRepository.getUnknownPool();
    }

    const asciiScriptSig = transactionUtils.hex2ascii(txMinerInfo.vin[0].scriptsig);
    const address = txMinerInfo.vout[0].scriptpubkey_address;

    const pools: PoolTag[] = await poolsRepository.$getPools();
    for (let i = 0; i < pools.length; ++i) {
      if (address !== undefined) {
        let addresses: string[] = JSON.parse(pools[i].addresses);
        if (addresses.indexOf(address) !== -1) {
          return pools[i];
        }
      }

      let regexes: string[] = JSON.parse(pools[i].regexes);
      for (let y = 0; y < regexes.length; ++y) {
        let match = asciiScriptSig.match(regexes[y]);
        if (match !== null) {
          return pools[i];
        }
      }
    }

    return poolsRepository.getUnknownPool();
  }

  /**
   * Index all blocks metadata for the mining dashboard
   */
  public async $generateBlockDatabase() {
    let currentBlockHeight = await bitcoinApi.$getBlockHeightTip();
    let maxBlocks = 100; // tmp

    while (currentBlockHeight-- > 0 && maxBlocks-- > 0) {
      if (await blocksRepository.$isBlockAlreadyIndexed(currentBlockHeight)) {
        // logger.debug(`Block #${currentBlockHeight} already indexed, skipping`);
        continue;
      }
      logger.debug(`Indexing block #${currentBlockHeight}`);
      const blockHash = await bitcoinApi.$getBlockHash(currentBlockHeight);
      const block = await bitcoinApi.$getBlock(blockHash);
      const transactions = await this.$getTransactionsExtended(blockHash, block.height, true);
      const blockExtended = this.getBlockExtended(block, transactions);
      const miner = await this.$findBlockMiner(blockExtended.coinbaseTx);
      const coinbase: IEsploraApi.Transaction = await bitcoinApi.$getRawTransaction(transactions[0].txid, true);
      await blocksRepository.$saveBlockInDatabase(blockExtended, blockHash, coinbase.hex, miner);
    }
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

      const blockHash = await bitcoinApi.$getBlockHash(this.currentBlockHeight);
      const block = await bitcoinApi.$getBlock(blockHash);
      const txIds: string[] = await bitcoinApi.$getTxIdsForBlock(blockHash);
      const transactions = await this.$getTransactionsExtended(blockHash, block.height, false);
      const blockExtended: BlockExtended = this.getBlockExtended(block, transactions);
      const miner = await this.$findBlockMiner(blockExtended.coinbaseTx);
      const coinbase: IEsploraApi.Transaction = await bitcoinApi.$getRawTransaction(transactions[0].txid, true);
      await blocksRepository.$saveBlockInDatabase(blockExtended, blockHash, coinbase.hex, miner);

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

      return;
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
