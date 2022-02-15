import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, PoolTag, TransactionExtended, TransactionMinerInfo } from '../mempool.interfaces';
import { Common } from './common';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';
import bitcoinClient from './bitcoin/bitcoin-client';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import poolsRepository from '../repositories/PoolsRepository';
import blocksRepository from '../repositories/BlocksRepository';
import loadingIndicators from './loading-indicators';

class Blocks {
  private blocks: BlockExtended[] = [];
  private currentBlockHeight = 0;
  private currentDifficulty = 0;
  private lastDifficultyAdjustmentTime = 0;
  private previousDifficultyRetarget = 0;
  private newBlockCallbacks: ((block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => void)[] = [];
  private blockIndexingStarted = false;

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
  private async $getTransactionsExtended(
    blockHash: string,
    blockHeight: number,
    onlyCoinbase: boolean,
    quiet: boolean = false,
  ): Promise<TransactionExtended[]> {
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
      } else if (config.MEMPOOL.BACKEND === 'esplora' || !memPool.hasPriority() || i === 0) {
        // Otherwise we fetch the tx data through backend services (esplora, electrum, core rpc...)
        if (!quiet && (i % (Math.round((txIds.length) / 10)) === 0 || i + 1 === txIds.length)) { // Avoid log spam
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

    if (!quiet) {
      logger.debug(`${transactionsFound} of ${txIds.length} found in mempool. ${transactionsFetched} fetched through backend service.`);
    }

    return transactions;
  }

  /**
   * Return a block with additional data (reward, coinbase, fees...)
   * @param block
   * @param transactions
   * @returns BlockExtended
   */
   private async $getBlockExtended(block: IEsploraApi.Block, transactions: TransactionExtended[]): Promise<BlockExtended> {
    const blockExtended: BlockExtended = Object.assign({extras: {}}, block);
    blockExtended.extras.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
    blockExtended.extras.coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);

    const transactionsTmp = [...transactions];
    transactionsTmp.shift();
    transactionsTmp.sort((a, b) => b.effectiveFeePerVsize - a.effectiveFeePerVsize);

    blockExtended.extras.medianFee = transactionsTmp.length > 0 ?
      Common.median(transactionsTmp.map((tx) => tx.effectiveFeePerVsize)) : 0;
    blockExtended.extras.feeRange = transactionsTmp.length > 0 ?
      Common.getFeesInRange(transactionsTmp, 8) : [0, 0];

    if (Common.indexingEnabled()) {
      let pool: PoolTag;
      if (blockExtended.extras?.coinbaseTx !== undefined) {
        pool = await this.$findBlockMiner(blockExtended.extras?.coinbaseTx);
      } else {
        pool = await poolsRepository.$getUnknownPool();
      }
      blockExtended.extras.pool = {
        id: pool.id,
        name: pool.name
      };
    }

    return blockExtended;
  }

  /**
   * Try to find which miner found the block
   * @param txMinerInfo
   * @returns
   */
  private async $findBlockMiner(txMinerInfo: TransactionMinerInfo | undefined): Promise<PoolTag> {
    if (txMinerInfo === undefined || txMinerInfo.vout.length < 1) {
      return await poolsRepository.$getUnknownPool();
    }

    const asciiScriptSig = transactionUtils.hex2ascii(txMinerInfo.vin[0].scriptsig);
    const address = txMinerInfo.vout[0].scriptpubkey_address;

    const pools: PoolTag[] = await poolsRepository.$getPools();
    for (let i = 0; i < pools.length; ++i) {
      if (address !== undefined) {
        const addresses: string[] = JSON.parse(pools[i].addresses);
        if (addresses.indexOf(address) !== -1) {
          return pools[i];
        }
      }

      const regexes: string[] = JSON.parse(pools[i].regexes);
      for (let y = 0; y < regexes.length; ++y) {
        const match = asciiScriptSig.match(regexes[y]);
        if (match !== null) {
          return pools[i];
        }
      }
    }

    return await poolsRepository.$getUnknownPool();
  }

  /**
   * Index all blocks metadata for the mining dashboard
   */
  public async $generateBlockDatabase() {
    if (this.blockIndexingStarted === true ||
      !Common.indexingEnabled() ||
      memPool.hasPriority()
    ) {
      return;
    }

    const blockchainInfo = await bitcoinClient.getBlockchainInfo();
    if (blockchainInfo.blocks !== blockchainInfo.headers) { // Wait for node to sync
      return;
    }

    this.blockIndexingStarted = true;
    const startedAt = new Date().getTime() / 1000;

    try {
      let currentBlockHeight = blockchainInfo.blocks;

      let indexingBlockAmount = config.MEMPOOL.INDEXING_BLOCKS_AMOUNT;
      if (indexingBlockAmount <= -1) {
        indexingBlockAmount = currentBlockHeight + 1;
      }

      const lastBlockToIndex = Math.max(0, currentBlockHeight - indexingBlockAmount + 1);

      logger.info(`Indexing blocks from #${currentBlockHeight} to #${lastBlockToIndex}`);

      const chunkSize = 10000;
      let totaIndexed = 0;
      while (currentBlockHeight >= lastBlockToIndex) {
        const endBlock = Math.max(0, lastBlockToIndex, currentBlockHeight - chunkSize + 1);

        const missingBlockHeights: number[] = await blocksRepository.$getMissingBlocksBetweenHeights(
          currentBlockHeight, endBlock);
        if (missingBlockHeights.length <= 0) {
          logger.debug(`No missing blocks between #${currentBlockHeight} to #${endBlock}`);
          currentBlockHeight -= chunkSize;
          continue;
        }

        logger.debug(`Indexing ${missingBlockHeights.length} blocks from #${currentBlockHeight} to #${endBlock}`);

        for (const blockHeight of missingBlockHeights) {
          if (blockHeight < lastBlockToIndex) {
            break;
          }
          try {
            if (totaIndexed % 100 === 0 || blockHeight === lastBlockToIndex) {
              const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
              const blockPerSeconds = Math.round(totaIndexed / elapsedSeconds);
              logger.debug(`Indexing block #${blockHeight} | ~${blockPerSeconds} blocks/sec | total: ${totaIndexed} | elapsed: ${elapsedSeconds} seconds`);
            }
            const blockHash = await bitcoinApi.$getBlockHash(blockHeight);
            const block = await bitcoinApi.$getBlock(blockHash);
            const transactions = await this.$getTransactionsExtended(blockHash, block.height, true, true);
            const blockExtended = await this.$getBlockExtended(block, transactions);
            await blocksRepository.$saveBlockInDatabase(blockExtended);
            ++totaIndexed;
          } catch (e) {
            logger.err(`Something went wrong while indexing blocks.` + e);
          }
        }

        currentBlockHeight -= chunkSize;
      }
      logger.info('Block indexing completed');
    } catch (e) {
      logger.err('An error occured in $generateBlockDatabase(). Skipping block indexing. ' + e);
      console.log(e);
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
      const blockExtended: BlockExtended = await this.$getBlockExtended(block, transactions);

      if (Common.indexingEnabled()) {
        await blocksRepository.$saveBlockInDatabase(blockExtended);
      }

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
      if (!memPool.hasPriority()) {
        diskCache.$saveCacheToDisk();
      }
    }
  }

  /**
   * Index a block if it's missing from the database. Returns the block after indexing
   */
   public async $indexBlock(height: number): Promise<BlockExtended> {
    const dbBlock = await blocksRepository.$getBlockByHeight(height);
    if (dbBlock != null) {
      return this.prepareBlock(dbBlock);
    }

    const blockHash = await bitcoinApi.$getBlockHash(height);
    const block = await bitcoinApi.$getBlock(blockHash);
    const transactions = await this.$getTransactionsExtended(blockHash, block.height, true);
    const blockExtended = await this.$getBlockExtended(block, transactions);

    await blocksRepository.$saveBlockInDatabase(blockExtended);

    return blockExtended;
  }

  public async $getBlocksExtras(fromHeight: number): Promise<BlockExtended[]> {
    try {
      loadingIndicators.setProgress('blocks', 0);

      let currentHeight = fromHeight ? fromHeight : this.getCurrentBlockHeight();
      const returnBlocks: BlockExtended[] = [];

      if (currentHeight < 0) {
        return returnBlocks;
      }

      // Check if block height exist in local cache to skip the hash lookup
      const blockByHeight = this.getBlocks().find((b) => b.height === currentHeight);
      let startFromHash: string | null = null;
      if (blockByHeight) {
        startFromHash = blockByHeight.id;
      } else {
        startFromHash = await bitcoinApi.$getBlockHash(currentHeight);
      }

      let nextHash = startFromHash;
      for (let i = 0; i < 10 && currentHeight >= 0; i++) {
        let block = this.getBlocks().find((b) => b.height === currentHeight);
        if (!block && Common.indexingEnabled()) {
          block = this.prepareBlock(await this.$indexBlock(currentHeight));
        } else if (!block) {
          block = this.prepareBlock(await bitcoinApi.$getBlock(nextHash));
        }
        returnBlocks.push(block);
        nextHash = block.previousblockhash;
        loadingIndicators.setProgress('blocks', i / 10 * 100);
        currentHeight--;
      }

      return returnBlocks;
    } catch (e) {
      loadingIndicators.setProgress('blocks', 100);
      throw e;
    }
  }

  private prepareBlock(block: any): BlockExtended {
    return <BlockExtended>{
      id: block.id ?? block.hash, // hash for indexed block
      timestamp: block?.timestamp ?? block?.blockTimestamp, // blockTimestamp for indexed block
      height: block?.height,
      version: block?.version,
      bits: block?.bits,
      nonce: block?.nonce,
      difficulty: block?.difficulty,
      merkle_root: block?.merkle_root,
      tx_count: block?.tx_count,
      size: block?.size,
      weight: block?.weight,
      previousblockhash: block?.previousblockhash,
      extras: {
        medianFee: block?.medianFee,
        feeRange: block?.feeRange ?? [], // TODO
        reward: block?.reward,
        pool: block?.extras?.pool ?? (block?.pool_id ? {
          id: block?.pool_id,
          name: block?.pool_name,
        } : undefined),
      }
    };
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
