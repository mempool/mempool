import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, BlockSummary, PoolTag, TransactionExtended, TransactionStripped, TransactionMinerInfo } from '../mempool.interfaces';
import { Common } from './common';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';
import bitcoinClient from './bitcoin/bitcoin-client';
import { IBitcoinApi } from './bitcoin/bitcoin-api.interface';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import poolsRepository from '../repositories/PoolsRepository';
import blocksRepository from '../repositories/BlocksRepository';
import loadingIndicators from './loading-indicators';
import BitcoinApi from './bitcoin/bitcoin-api';
import { prepareBlock } from '../utils/blocks-utils';
import BlocksRepository from '../repositories/BlocksRepository';
import HashratesRepository from '../repositories/HashratesRepository';
import indexer from '../indexer';
import fiatConversion from './fiat-conversion';
import poolsParser from './pools-parser';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import mining from './mining/mining';
import DifficultyAdjustmentsRepository from '../repositories/DifficultyAdjustmentsRepository';

class Blocks {
  private blocks: BlockExtended[] = [];
  private blockSummaries: BlockSummary[] = [];
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

  public getBlockSummaries(): BlockSummary[] {
    return this.blockSummaries;
  }

  public setBlockSummaries(blockSummaries: BlockSummary[]) {
    this.blockSummaries = blockSummaries;
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
          if (i === 0) {
            const msg = `Cannot fetch coinbase tx ${txIds[i]}. Reason: ` + (e instanceof Error ? e.message : e); 
            logger.err(msg);
            throw new Error(msg);
          } else {
            logger.err(`Cannot fetch tx ${txIds[i]}. Reason: ` + (e instanceof Error ? e.message : e));
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
   * Return a block summary (list of stripped transactions)
   * @param block
   * @returns BlockSummary
   */
  private summarizeBlock(block: IBitcoinApi.VerboseBlock): BlockSummary {
    const stripped = block.tx.map((tx) => {
      return {
        txid: tx.txid,
        vsize: tx.vsize,
        fee: tx.fee ? Math.round(tx.fee * 100000000) : 0,
        value: Math.round(tx.vout.reduce((acc, vout) => acc + (vout.value ? vout.value : 0), 0) * 100000000)
      };
    });

    return {
      id: block.hash,
      transactions: stripped
    };
  }

  /**
   * Return a block with additional data (reward, coinbase, fees...)
   * @param block
   * @param transactions
   * @returns BlockExtended
   */
  private async $getBlockExtended(block: IEsploraApi.Block, transactions: TransactionExtended[]): Promise<BlockExtended> {
    const blockExtended: BlockExtended = Object.assign({ extras: {} }, block);
    blockExtended.extras.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
    blockExtended.extras.coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);
    blockExtended.extras.coinbaseRaw = blockExtended.extras.coinbaseTx.vin[0].scriptsig;
    blockExtended.extras.usd = fiatConversion.getConversionRates().USD;

    if (block.height === 0) {
      blockExtended.extras.medianFee = 0; // 50th percentiles
      blockExtended.extras.feeRange = [0, 0, 0, 0, 0, 0, 0];
      blockExtended.extras.totalFees = 0;
      blockExtended.extras.avgFee = 0;
      blockExtended.extras.avgFeeRate = 0;
    } else {
      const stats = await bitcoinClient.getBlockStats(block.id, [
        'feerate_percentiles', 'minfeerate', 'maxfeerate', 'totalfee', 'avgfee', 'avgfeerate'
      ]);
      blockExtended.extras.medianFee = stats.feerate_percentiles[2]; // 50th percentiles
      blockExtended.extras.feeRange = [stats.minfeerate, stats.feerate_percentiles, stats.maxfeerate].flat();
      blockExtended.extras.totalFees = stats.totalfee;
      blockExtended.extras.avgFee = stats.avgfee;
      blockExtended.extras.avgFeeRate = stats.avgfeerate;
    }

    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK)) {
      let pool: PoolTag;
      if (blockExtended.extras?.coinbaseTx !== undefined) {
        pool = await this.$findBlockMiner(blockExtended.extras?.coinbaseTx);
      } else {
        if (config.DATABASE.ENABLED === true) {
          pool = await poolsRepository.$getUnknownPool();
        } else {
          pool = poolsParser.unknownPool;
        }
      }

      if (!pool) { // We should never have this situation in practise
        logger.warn(`Cannot assign pool to block ${blockExtended.height} and 'unknown' pool does not exist. ` +
          `Check your "pools" table entries`);
        return blockExtended;
      }

      blockExtended.extras.pool = {
        id: pool.id,
        name: pool.name,
        slug: pool.slug,
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
      if (config.DATABASE.ENABLED === true) {
        return await poolsRepository.$getUnknownPool();
      } else {
        return poolsParser.unknownPool;
      }
    }

    const asciiScriptSig = transactionUtils.hex2ascii(txMinerInfo.vin[0].scriptsig);
    const address = txMinerInfo.vout[0].scriptpubkey_address;

    let pools: PoolTag[] = [];
    if (config.DATABASE.ENABLED === true) {
      pools = await poolsRepository.$getPools();
    } else {
      pools = poolsParser.miningPools;
    }
    for (let i = 0; i < pools.length; ++i) {
      if (address !== undefined) {
        const addresses: string[] = JSON.parse(pools[i].addresses);
        if (addresses.indexOf(address) !== -1) {
          return pools[i];
        }
      }

      const regexes: string[] = JSON.parse(pools[i].regexes);
      for (let y = 0; y < regexes.length; ++y) {
        const regex = new RegExp(regexes[y], 'i');
        const match = asciiScriptSig.match(regex);
        if (match !== null) {
          return pools[i];
        }
      }
    }

    if (config.DATABASE.ENABLED === true) {
      return await poolsRepository.$getUnknownPool();
    } else {
      return poolsParser.unknownPool;
    }
  }

  /**
   * [INDEXING] Index all blocks summaries for the block txs visualization
   */
  public async $generateBlocksSummariesDatabase() {
    if (Common.blocksSummariesIndexingEnabled() === false) {
      return;
    }

    try {
      // Get all indexed block hash
      const indexedBlocks = await blocksRepository.$getIndexedBlocks();
      const indexedBlockSummariesHashesArray = await BlocksSummariesRepository.$getIndexedSummariesId();

      const indexedBlockSummariesHashes = {}; // Use a map for faster seek during the indexing loop
      for (const hash of indexedBlockSummariesHashesArray) {
        indexedBlockSummariesHashes[hash] = true;
      }

      // Logging
      let newlyIndexed = 0;
      let totalIndexed = indexedBlockSummariesHashesArray.length;
      let indexedThisRun = 0;
      let timer = new Date().getTime() / 1000;
      const startedAt = new Date().getTime() / 1000;

      for (const block of indexedBlocks) {
        if (indexedBlockSummariesHashes[block.hash] === true) {
          continue;
        }

        // Logging
        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 5) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const blockPerSeconds = Math.max(1, indexedThisRun / elapsedSeconds);
          const progress = Math.round(totalIndexed / indexedBlocks.length * 10000) / 100;
          logger.debug(`Indexing block summary for #${block.height} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexedBlocks.length} (${progress}%) | elapsed: ${runningFor} seconds`);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
        }

        await this.$getStrippedBlockTransactions(block.hash, true, true); // This will index the block summary

        // Logging
        indexedThisRun++;
        totalIndexed++;
        newlyIndexed++;
      }
      if (newlyIndexed > 0) {
        logger.notice(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`);
      } else {
        logger.debug(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`);
      }
    } catch (e) {
      logger.err(`Blocks summaries indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`);
      throw e;
    }
  }

  /**
   * [INDEXING] Index all blocks metadata for the mining dashboard
   */
  public async $generateBlockDatabase(): Promise<boolean> {
    try {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      let currentBlockHeight = blockchainInfo.blocks;

      let indexingBlockAmount = Math.min(config.MEMPOOL.INDEXING_BLOCKS_AMOUNT, blockchainInfo.blocks);
      if (indexingBlockAmount <= -1) {
        indexingBlockAmount = currentBlockHeight + 1;
      }

      const lastBlockToIndex = Math.max(0, currentBlockHeight - indexingBlockAmount + 1);

      logger.debug(`Indexing blocks from #${currentBlockHeight} to #${lastBlockToIndex}`);
      loadingIndicators.setProgress('block-indexing', 0);

      const chunkSize = 10000;
      let totalIndexed = await blocksRepository.$blockCountBetweenHeight(currentBlockHeight, lastBlockToIndex);
      let indexedThisRun = 0;
      let newlyIndexed = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      while (currentBlockHeight >= lastBlockToIndex) {
        const endBlock = Math.max(0, lastBlockToIndex, currentBlockHeight - chunkSize + 1);

        const missingBlockHeights: number[] = await blocksRepository.$getMissingBlocksBetweenHeights(
          currentBlockHeight, endBlock);
        if (missingBlockHeights.length <= 0) {
          currentBlockHeight -= chunkSize;
          continue;
        }

        logger.info(`Indexing ${missingBlockHeights.length} blocks from #${currentBlockHeight} to #${endBlock}`);

        for (const blockHeight of missingBlockHeights) {
          if (blockHeight < lastBlockToIndex) {
            break;
          }
          ++indexedThisRun;
          ++totalIndexed;
          const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
          if (elapsedSeconds > 5 || blockHeight === lastBlockToIndex) {
            const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
            const blockPerSeconds = Math.max(1, indexedThisRun / elapsedSeconds);
            const progress = Math.round(totalIndexed / indexingBlockAmount * 10000) / 100;
            logger.debug(`Indexing block #${blockHeight} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexingBlockAmount} (${progress}%) | elapsed: ${runningFor} seconds`);
            timer = new Date().getTime() / 1000;
            indexedThisRun = 0;
            loadingIndicators.setProgress('block-indexing', progress, false);
          }
          const blockHash = await bitcoinApi.$getBlockHash(blockHeight);
          const block = BitcoinApi.convertBlock(await bitcoinClient.getBlock(blockHash));
          const transactions = await this.$getTransactionsExtended(blockHash, block.height, true, true);
          const blockExtended = await this.$getBlockExtended(block, transactions);

          newlyIndexed++;
          await blocksRepository.$saveBlockInDatabase(blockExtended);
        }

        currentBlockHeight -= chunkSize;
      }
      if (newlyIndexed > 0) {
        logger.notice(`Block indexing completed: indexed ${newlyIndexed} blocks`);
      } else {
        logger.debug(`Block indexing completed: indexed ${newlyIndexed} blocks`);
      }
      loadingIndicators.setProgress('block-indexing', 100);
    } catch (e) {
      logger.err('Block indexing failed. Trying again in 10 seconds. Reason: ' + (e instanceof Error ? e.message : e));
      loadingIndicators.setProgress('block-indexing', 100);
      throw e;
    }

    return await BlocksRepository.$validateChain();
  }

  public async $updateBlocks() {
    let fastForwarded = false;
    const blockHeightTip = await bitcoinApi.$getBlockHeightTip();

    if (this.blocks.length === 0) {
      this.currentBlockHeight = Math.max(blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT, -1);
    } else {
      this.currentBlockHeight = this.blocks[this.blocks.length - 1].height;
    }

    if (blockHeightTip - this.currentBlockHeight > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 2) {
      logger.info(`${blockHeightTip - this.currentBlockHeight} blocks since tip. Fast forwarding to the ${config.MEMPOOL.INITIAL_BLOCKS_AMOUNT} recent blocks`);
      this.currentBlockHeight = blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT;
      fastForwarded = true;
      logger.info(`Re-indexing skipped blocks and corresponding hashrates data`);
      indexer.reindex(); // Make sure to index the skipped blocks #1619
    }

    if (!this.lastDifficultyAdjustmentTime) {
      const blockchainInfo = await bitcoinClient.getBlockchainInfo();
      if (blockchainInfo.blocks === blockchainInfo.headers) {
        const heightDiff = blockHeightTip % 2016;
        const blockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff);
        const block = BitcoinApi.convertBlock(await bitcoinClient.getBlock(blockHash));
        this.lastDifficultyAdjustmentTime = block.timestamp;
        this.currentDifficulty = block.difficulty;

        if (blockHeightTip >= 2016) {
          const previousPeriodBlockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff - 2016);
          const previousPeriodBlock = await bitcoinClient.getBlock(previousPeriodBlockHash)
          this.previousDifficultyRetarget = (block.difficulty - previousPeriodBlock.difficulty) / previousPeriodBlock.difficulty * 100;
          logger.debug(`Initial difficulty adjustment data set.`);
        }
      } else {
        logger.debug(`Blockchain headers (${blockchainInfo.headers}) and blocks (${blockchainInfo.blocks}) not in sync. Waiting...`);
      }
    }

    while (this.currentBlockHeight < blockHeightTip) {
      if (this.currentBlockHeight < blockHeightTip - config.MEMPOOL.INITIAL_BLOCKS_AMOUNT) {
        this.currentBlockHeight = blockHeightTip;
      } else {
        this.currentBlockHeight++;
        logger.debug(`New block found (#${this.currentBlockHeight})!`);
      }

      const blockHash = await bitcoinApi.$getBlockHash(this.currentBlockHeight);
      const verboseBlock = await bitcoinClient.getBlock(blockHash, 2);
      const block = BitcoinApi.convertBlock(verboseBlock);
      const txIds: string[] = await bitcoinApi.$getTxIdsForBlock(blockHash);
      const transactions = await this.$getTransactionsExtended(blockHash, block.height, false);
      const blockExtended: BlockExtended = await this.$getBlockExtended(block, transactions);
      const blockSummary: BlockSummary = this.summarizeBlock(verboseBlock);

      if (Common.indexingEnabled()) {
        if (!fastForwarded) {
          const lastBlock = await blocksRepository.$getBlockByHeight(blockExtended.height - 1);
          if (lastBlock !== null && blockExtended.previousblockhash !== lastBlock['hash']) {
            logger.warn(`Chain divergence detected at block ${lastBlock['height']}, re-indexing most recent data`);
            // We assume there won't be a reorg with more than 10 block depth
            await BlocksRepository.$deleteBlocksFrom(lastBlock['height'] - 10);
            await HashratesRepository.$deleteLastEntries();
            await BlocksSummariesRepository.$deleteBlocksFrom(lastBlock['height'] - 10);
            for (let i = 10; i >= 0; --i) {
              const newBlock = await this.$indexBlock(lastBlock['height'] - i);
              await this.$getStrippedBlockTransactions(newBlock.id, true, true);
            }
            await mining.$indexDifficultyAdjustments();
            await DifficultyAdjustmentsRepository.$deleteLastAdjustment();
            logger.info(`Re-indexed 10 blocks and summaries. Also re-indexed the last difficulty adjustments. Will re-index latest hashrates in a few seconds.`);
            indexer.reindex();
          }
          await blocksRepository.$saveBlockInDatabase(blockExtended);

          // Save blocks summary for visualization if it's enabled
          if (Common.blocksSummariesIndexingEnabled() === true) {
            await this.$getStrippedBlockTransactions(blockExtended.id, true);
          }
        }
      }

      if (block.height % 2016 === 0) {
        if (Common.indexingEnabled()) {
          await DifficultyAdjustmentsRepository.$saveAdjustments({
            time: block.timestamp,
            height: block.height,
            difficulty: block.difficulty,
            adjustment: Math.round((block.difficulty / this.currentDifficulty) * 1000000) / 1000000, // Remove float point noise
          });
        }

        this.previousDifficultyRetarget = (block.difficulty - this.currentDifficulty) / this.currentDifficulty * 100;
        this.lastDifficultyAdjustmentTime = block.timestamp;
        this.currentDifficulty = block.difficulty;
      }

      this.blocks.push(blockExtended);
      if (this.blocks.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blocks = this.blocks.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
      }
      this.blockSummaries.push(blockSummary);
      if (this.blockSummaries.length > config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4) {
        this.blockSummaries = this.blockSummaries.slice(-config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4);
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
      return prepareBlock(dbBlock);
    }

    const blockHash = await bitcoinApi.$getBlockHash(height);
    const block = BitcoinApi.convertBlock(await bitcoinClient.getBlock(blockHash));
    const transactions = await this.$getTransactionsExtended(blockHash, block.height, true);
    const blockExtended = await this.$getBlockExtended(block, transactions);

    await blocksRepository.$saveBlockInDatabase(blockExtended);

    return prepareBlock(blockExtended);
  }

  /**
   * Index a block by hash if it's missing from the database. Returns the block after indexing
   */
  public async $getBlock(hash: string): Promise<BlockExtended | IEsploraApi.Block> {
    // Check the memory cache
    const blockByHash = this.getBlocks().find((b) => b.id === hash);
    if (blockByHash) {
      return blockByHash;
    }

    // Block has already been indexed
    if (Common.indexingEnabled()) {
      const dbBlock = await blocksRepository.$getBlockByHash(hash);
      if (dbBlock != null) {
        return prepareBlock(dbBlock);
      }
    }

    // Not Bitcoin network, return the block as it
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) === false) {
      return await bitcoinApi.$getBlock(hash);
    }

    let block = await bitcoinClient.getBlock(hash);
    block = prepareBlock(block);

    // Bitcoin network, add our custom data on top
    const transactions = await this.$getTransactionsExtended(hash, block.height, true);
    const blockExtended = await this.$getBlockExtended(block, transactions);
    if (Common.indexingEnabled()) {
      delete(blockExtended['coinbaseTx']);
      await blocksRepository.$saveBlockInDatabase(blockExtended);
    }

    return blockExtended;
  }

  public async $getStrippedBlockTransactions(hash: string, skipMemoryCache = false,
    skipDBLookup = false): Promise<TransactionStripped[]>
  {
    if (skipMemoryCache === false) {
      // Check the memory cache
      const cachedSummary = this.getBlockSummaries().find((b) => b.id === hash);
      if (cachedSummary) {
        return cachedSummary.transactions;
      }
    }

    // Check if it's indexed in db
    if (skipDBLookup === false && Common.blocksSummariesIndexingEnabled() === true) {
      const indexedSummary = await BlocksSummariesRepository.$getByBlockId(hash);
      if (indexedSummary !== undefined) {
        return indexedSummary.transactions;
      }
    }

    // Call Core RPC
    const block = await bitcoinClient.getBlock(hash, 2);
    const summary = this.summarizeBlock(block);

    // Index the response if needed
    if (Common.blocksSummariesIndexingEnabled() === true) {
      await BlocksSummariesRepository.$saveSummary(block.height, summary);
    }

    return summary.transactions;
  }

  public async $getBlocks(fromHeight?: number, limit: number = 15): Promise<BlockExtended[]> {
    let currentHeight = fromHeight !== undefined ? fromHeight : await blocksRepository.$mostRecentBlockHeight();
    const returnBlocks: BlockExtended[] = [];

    if (currentHeight < 0) {
      return returnBlocks;
    }

    // Check if block height exist in local cache to skip the hash lookup
    const blockByHeight = this.getBlocks().find((b) => b.height === currentHeight);
    let startFromHash: string | null = null;
    if (blockByHeight) {
      startFromHash = blockByHeight.id;
    } else if (!Common.indexingEnabled()) {
      startFromHash = await bitcoinApi.$getBlockHash(currentHeight);
    }

    let nextHash = startFromHash;
    for (let i = 0; i < limit && currentHeight >= 0; i++) {
      let block = this.getBlocks().find((b) => b.height === currentHeight);
      if (block) {
        returnBlocks.push(block);
      } else if (Common.indexingEnabled()) {
        block = await this.$indexBlock(currentHeight);
        returnBlocks.push(block);
      } else if (nextHash != null) {
        block = prepareBlock(await bitcoinClient.getBlock(nextHash));
        nextHash = block.previousblockhash;
        returnBlocks.push(block);
      }
      currentHeight--;
    }

    return returnBlocks;
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
