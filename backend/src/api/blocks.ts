import config from '../config';
import bitcoinApi, { bitcoinCoreApi } from './bitcoin/bitcoin-api-factory';
import logger from '../logger';
import memPool from './mempool';
import { BlockExtended, BlockExtension, BlockSummary, PoolTag, TransactionExtended, TransactionStripped, TransactionMinerInfo, CpfpSummary } from '../mempool.interfaces';
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
import BlocksRepository from '../repositories/BlocksRepository';
import HashratesRepository from '../repositories/HashratesRepository';
import indexer from '../indexer';
import poolsParser from './pools-parser';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import BlocksAuditsRepository from '../repositories/BlocksAuditsRepository';
import cpfpRepository from '../repositories/CpfpRepository';
import mining from './mining/mining';
import DifficultyAdjustmentsRepository from '../repositories/DifficultyAdjustmentsRepository';
import PricesRepository from '../repositories/PricesRepository';
import priceUpdater from '../tasks/price-updater';
import chainTips from './chain-tips';

class Blocks {
  private blocks: BlockExtended[] = [];
  private blockSummaries: BlockSummary[] = [];
  private currentBlockHeight = 0;
  private currentDifficulty = 0;
  private lastDifficultyAdjustmentTime = 0;
  private previousDifficultyRetarget = 0;
  private newBlockCallbacks: ((block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => void)[] = [];
  private newAsyncBlockCallbacks: ((block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => Promise<void>)[] = [];

  private mainLoopTimeout: number = 120000;

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

  public setNewAsyncBlockCallback(fn: (block: BlockExtended, txIds: string[], transactions: TransactionExtended[]) => Promise<void>) {
    this.newAsyncBlockCallbacks.push(fn);
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
          try {
            if (config.MEMPOOL.BACKEND === 'esplora') {
              // Try again with core
              const tx = await transactionUtils.$getTransactionExtended(txIds[i], false, false, true);
              transactions.push(tx);
              transactionsFetched++;
            } else {
              throw e;
            }
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
  public summarizeBlock(block: IBitcoinApi.VerboseBlock): BlockSummary {
    if (Common.isLiquid()) {
      block = this.convertLiquidFees(block);
    }
    const stripped = block.tx.map((tx: IBitcoinApi.VerboseTransaction) => {
      return {
        txid: tx.txid,
        vsize: tx.weight / 4,
        fee: tx.fee ? Math.round(tx.fee * 100000000) : 0,
        value: Math.round(tx.vout.reduce((acc, vout) => acc + (vout.value ? vout.value : 0), 0) * 100000000)
      };
    });

    return {
      id: block.hash,
      transactions: stripped
    };
  }

  private convertLiquidFees(block: IBitcoinApi.VerboseBlock): IBitcoinApi.VerboseBlock {
    block.tx.forEach(tx => {
      tx.fee = Object.values(tx.fee || {}).reduce((total, output) => total + output, 0);
    });
    return block;
  }

  /**
   * Return a block with additional data (reward, coinbase, fees...)
   * @param block
   * @param transactions
   * @returns BlockExtended
   */
  private async $getBlockExtended(block: IEsploraApi.Block, transactions: TransactionExtended[]): Promise<BlockExtended> {
    const coinbaseTx = transactionUtils.stripCoinbaseTransaction(transactions[0]);
    
    const blk: Partial<BlockExtended> = Object.assign({}, block);
    const extras: Partial<BlockExtension> = {};

    extras.reward = transactions[0].vout.reduce((acc, curr) => acc + curr.value, 0);
    extras.coinbaseRaw = coinbaseTx.vin[0].scriptsig;
    extras.orphans = chainTips.getOrphanedBlocksAtHeight(blk.height);

    if (block.height === 0) {
      extras.medianFee = 0; // 50th percentiles
      extras.feeRange = [0, 0, 0, 0, 0, 0, 0];
      extras.totalFees = 0;
      extras.avgFee = 0;
      extras.avgFeeRate = 0;
      extras.utxoSetChange = 0;
      extras.avgTxSize = 0;
      extras.totalInputs = 0;
      extras.totalOutputs = 1;
      extras.totalOutputAmt = 0;
      extras.segwitTotalTxs = 0;
      extras.segwitTotalSize = 0;
      extras.segwitTotalWeight = 0;
    } else {
      const stats: IBitcoinApi.BlockStats = await bitcoinClient.getBlockStats(block.id);
      let feeStats = {
        medianFee: stats.feerate_percentiles[2], // 50th percentiles
        feeRange: [stats.minfeerate, stats.feerate_percentiles, stats.maxfeerate].flat(),
      };
      if (transactions?.length > 1) {
        feeStats = Common.calcEffectiveFeeStatistics(transactions);
      }
      extras.medianFee = feeStats.medianFee;
      extras.feeRange = feeStats.feeRange;
      extras.totalFees = stats.totalfee;
      extras.avgFee = stats.avgfee;
      extras.avgFeeRate = stats.avgfeerate;
      extras.utxoSetChange = stats.utxo_increase;
      extras.avgTxSize = Math.round(stats.total_size / stats.txs * 100) * 0.01;
      extras.totalInputs = stats.ins;
      extras.totalOutputs = stats.outs;
      extras.totalOutputAmt = stats.total_out;
      extras.segwitTotalTxs = stats.swtxs;
      extras.segwitTotalSize = stats.swtotal_size;
      extras.segwitTotalWeight = stats.swtotal_weight;
    }

    if (Common.blocksSummariesIndexingEnabled()) {
      extras.feePercentiles = await BlocksSummariesRepository.$getFeePercentilesByBlockId(block.id);
      if (extras.feePercentiles !== null) {
        extras.medianFeeAmt = extras.feePercentiles[3];
      }
    }
  
    extras.virtualSize = block.weight / 4.0;
    if (coinbaseTx?.vout.length > 0) {
      extras.coinbaseAddress = coinbaseTx.vout[0].scriptpubkey_address ?? null;
      extras.coinbaseSignature = coinbaseTx.vout[0].scriptpubkey_asm ?? null;
      extras.coinbaseSignatureAscii = transactionUtils.hex2ascii(coinbaseTx.vin[0].scriptsig) ?? null;
    } else {
      extras.coinbaseAddress = null;
      extras.coinbaseSignature = null;
      extras.coinbaseSignatureAscii = null;
    }

    const header = await bitcoinClient.getBlockHeader(block.id, false);
    extras.header = header;

    const coinStatsIndex = indexer.isCoreIndexReady('coinstatsindex');
    if (coinStatsIndex !== null && coinStatsIndex.best_block_height >= block.height) {
      const txoutset = await bitcoinClient.getTxoutSetinfo('none', block.height);
      extras.utxoSetSize = txoutset.txouts,
      extras.totalInputAmt = Math.round(txoutset.block_info.prevout_spent * 100000000);
    } else {
      extras.utxoSetSize = null;
      extras.totalInputAmt = null;
    }

    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK)) {
      let pool: PoolTag;
      if (coinbaseTx !== undefined) {
        pool = await this.$findBlockMiner(coinbaseTx);
      } else {
        if (config.DATABASE.ENABLED === true) {
          pool = await poolsRepository.$getUnknownPool();
        } else {
          pool = poolsParser.unknownPool;
        }
      }

      if (!pool) { // We should never have this situation in practise
        logger.warn(`Cannot assign pool to block ${blk.height} and 'unknown' pool does not exist. ` +
          `Check your "pools" table entries`);
      } else {
        extras.pool = {
          id: pool.uniqueId,
          name: pool.name,
          slug: pool.slug,
        };
      }

      extras.matchRate = null;
      if (config.MEMPOOL.AUDIT) {
        const auditScore = await BlocksAuditsRepository.$getBlockAuditScore(block.id);
        if (auditScore != null) {
          extras.matchRate = auditScore.matchRate;
        }
      }
    }

    blk.extras = <BlockExtension>extras;
    return <BlockExtended>blk;
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
        const addresses: string[] = typeof pools[i].addresses === 'string' ?
          JSON.parse(pools[i].addresses) : pools[i].addresses;
        if (addresses.indexOf(address) !== -1) {
          return pools[i];
        }
      }

      const regexes: string[] = typeof pools[i].regexes === 'string' ?
        JSON.parse(pools[i].regexes) : pools[i].regexes;
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
  public async $generateBlocksSummariesDatabase(): Promise<void> {
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
          logger.debug(`Indexing block summary for #${block.height} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexedBlocks.length} (${progress}%) | elapsed: ${runningFor} seconds`, logger.tags.mining);
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
        logger.notice(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      } else {
        logger.debug(`Blocks summaries indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      }
    } catch (e) {
      logger.err(`Blocks summaries indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`, logger.tags.mining);
      throw e;
    }
  }

  /**
   * [INDEXING] Index transaction CPFP data for all blocks
   */
   public async $generateCPFPDatabase(): Promise<void> {
    if (Common.cpfpIndexingEnabled() === false) {
      return;
    }

    try {
      // Get all indexed block hash
      const unindexedBlockHeights = await blocksRepository.$getCPFPUnindexedBlocks();

      if (!unindexedBlockHeights?.length) {
        return;
      }

      logger.info(`Indexing cpfp data for ${unindexedBlockHeights.length} blocks`);

      // Logging
      let count = 0;
      let countThisRun = 0;
      let timer = new Date().getTime() / 1000;
      const startedAt = new Date().getTime() / 1000;
      for (const height of unindexedBlockHeights) {
        // Logging
        const hash = await bitcoinApi.$getBlockHash(height);
        const elapsedSeconds = Math.max(1, new Date().getTime() / 1000 - timer);
        if (elapsedSeconds > 5) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const blockPerSeconds = (countThisRun / elapsedSeconds);
          const progress = Math.round(count / unindexedBlockHeights.length * 10000) / 100;
          logger.debug(`Indexing cpfp clusters for #${height} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${count}/${unindexedBlockHeights.length} (${progress}%) | elapsed: ${runningFor} seconds`);
          timer = new Date().getTime() / 1000;
          countThisRun = 0;
        }

        await this.$indexCPFP(hash, height); // Calculate and save CPFP data for transactions in this block

        // Logging
        count++;
        countThisRun++;
      }
      logger.notice(`CPFP indexing completed: indexed ${count} blocks`);
    } catch (e) {
      logger.err(`CPFP indexing failed. Trying again in 10 seconds. Reason: ${(e instanceof Error ? e.message : e)}`);
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

      logger.debug(`Indexing blocks from #${currentBlockHeight} to #${lastBlockToIndex}`, logger.tags.mining);
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

        logger.info(`Indexing ${missingBlockHeights.length} blocks from #${currentBlockHeight} to #${endBlock}`, logger.tags.mining);

        for (const blockHeight of missingBlockHeights) {
          if (blockHeight < lastBlockToIndex) {
            break;
          }
          ++indexedThisRun;
          ++totalIndexed;
          const elapsedSeconds = Math.max(1, new Date().getTime() / 1000 - timer);
          if (elapsedSeconds > 5 || blockHeight === lastBlockToIndex) {
            const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
            const blockPerSeconds = Math.max(1, indexedThisRun / elapsedSeconds);
            const progress = Math.round(totalIndexed / indexingBlockAmount * 10000) / 100;
            logger.debug(`Indexing block #${blockHeight} | ~${blockPerSeconds.toFixed(2)} blocks/sec | total: ${totalIndexed}/${indexingBlockAmount} (${progress}%) | elapsed: ${runningFor} seconds`, logger.tags.mining);
            timer = new Date().getTime() / 1000;
            indexedThisRun = 0;
            loadingIndicators.setProgress('block-indexing', progress, false);
          }
          const blockHash = await bitcoinApi.$getBlockHash(blockHeight);
          const block: IEsploraApi.Block = await bitcoinCoreApi.$getBlock(blockHash);
          const transactions = await this.$getTransactionsExtended(blockHash, block.height, true, true);
          const blockExtended = await this.$getBlockExtended(block, transactions);

          newlyIndexed++;
          await blocksRepository.$saveBlockInDatabase(blockExtended);
        }

        currentBlockHeight -= chunkSize;
      }
      if (newlyIndexed > 0) {
        logger.notice(`Block indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      } else {
        logger.debug(`Block indexing completed: indexed ${newlyIndexed} blocks`, logger.tags.mining);
      }
      loadingIndicators.setProgress('block-indexing', 100);
    } catch (e) {
      logger.err('Block indexing failed. Trying again in 10 seconds. Reason: ' + (e instanceof Error ? e.message : e), logger.tags.mining);
      loadingIndicators.setProgress('block-indexing', 100);
      throw e;
    }

    return await BlocksRepository.$validateChain();
  }

  public async $updateBlocks(): Promise<number> {
    // warn if this run stalls the main loop for more than 2 minutes
    const timer = this.startTimer();

    diskCache.lock();

    let fastForwarded = false;
    let handledBlocks = 0;
    const blockHeightTip = await bitcoinApi.$getBlockHeightTip();
    this.updateTimerProgress(timer, 'got block height tip');

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
      this.updateTimerProgress(timer, 'got blockchain info for initial difficulty adjustment');
      if (blockchainInfo.blocks === blockchainInfo.headers) {
        const heightDiff = blockHeightTip % 2016;
        const blockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff);
        this.updateTimerProgress(timer, 'got block hash for initial difficulty adjustment');
        const block: IEsploraApi.Block = await bitcoinCoreApi.$getBlock(blockHash);
        this.updateTimerProgress(timer, 'got block for initial difficulty adjustment');
        this.lastDifficultyAdjustmentTime = block.timestamp;
        this.currentDifficulty = block.difficulty;

        if (blockHeightTip >= 2016) {
          const previousPeriodBlockHash = await bitcoinApi.$getBlockHash(blockHeightTip - heightDiff - 2016);
          this.updateTimerProgress(timer, 'got previous block hash for initial difficulty adjustment');
          const previousPeriodBlock: IEsploraApi.Block = await bitcoinCoreApi.$getBlock(previousPeriodBlockHash);
          this.updateTimerProgress(timer, 'got previous block for initial difficulty adjustment');
          this.previousDifficultyRetarget = (block.difficulty - previousPeriodBlock.difficulty) / previousPeriodBlock.difficulty * 100;
          logger.debug(`Initial difficulty adjustment data set.`);
        }
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
        this.updateTimerProgress(timer, `getting orphaned blocks for ${this.currentBlockHeight}`);
        await chainTips.updateOrphanedBlocks();
      }

      this.updateTimerProgress(timer, `getting block data for ${this.currentBlockHeight}`);
      const blockHash = await bitcoinApi.$getBlockHash(this.currentBlockHeight);
      const verboseBlock = await bitcoinClient.getBlock(blockHash, 2);
      const block = BitcoinApi.convertBlock(verboseBlock);
      const txIds: string[] = await bitcoinApi.$getTxIdsForBlock(blockHash);
      const transactions = await this.$getTransactionsExtended(blockHash, block.height, false);
      const cpfpSummary: CpfpSummary = Common.calculateCpfp(block.height, transactions);
      const blockExtended: BlockExtended = await this.$getBlockExtended(block, cpfpSummary.transactions);
      const blockSummary: BlockSummary = this.summarizeBlock(verboseBlock);
      this.updateTimerProgress(timer, `got block data for ${this.currentBlockHeight}`);

      // start async callbacks
      this.updateTimerProgress(timer, `starting async callbacks for ${this.currentBlockHeight}`);
      const callbackPromises = this.newAsyncBlockCallbacks.map((cb) => cb(blockExtended, txIds, transactions));

      if (Common.indexingEnabled()) {
        if (!fastForwarded) {
          const lastBlock = await blocksRepository.$getBlockByHeight(blockExtended.height - 1);
          this.updateTimerProgress(timer, `got block by height for ${this.currentBlockHeight}`);
          if (lastBlock !== null && blockExtended.previousblockhash !== lastBlock.id) {
            logger.warn(`Chain divergence detected at block ${lastBlock.height}, re-indexing most recent data`, logger.tags.mining);
            // We assume there won't be a reorg with more than 10 block depth
            this.updateTimerProgress(timer, `rolling back diverged chain from ${this.currentBlockHeight}`);
            await BlocksRepository.$deleteBlocksFrom(lastBlock.height - 10);
            await HashratesRepository.$deleteLastEntries();
            await cpfpRepository.$deleteClustersFrom(lastBlock.height - 10);
            this.updateTimerProgress(timer, `rolled back chain divergence from ${this.currentBlockHeight}`);
            for (let i = 10; i >= 0; --i) {
              const newBlock = await this.$indexBlock(lastBlock.height - i);
              this.updateTimerProgress(timer, `reindexed block`);
              await this.$getStrippedBlockTransactions(newBlock.id, true, true);
              this.updateTimerProgress(timer, `reindexed block summary`);
              if (config.MEMPOOL.CPFP_INDEXING) {
                await this.$indexCPFP(newBlock.id, lastBlock.height - i);
                this.updateTimerProgress(timer, `reindexed block cpfp`);
              }
            }
            await mining.$indexDifficultyAdjustments();
            await DifficultyAdjustmentsRepository.$deleteLastAdjustment();
            this.updateTimerProgress(timer, `reindexed difficulty adjustments`);
            logger.info(`Re-indexed 10 blocks and summaries. Also re-indexed the last difficulty adjustments. Will re-index latest hashrates in a few seconds.`, logger.tags.mining);
            indexer.reindex();
          }
          await blocksRepository.$saveBlockInDatabase(blockExtended);
          this.updateTimerProgress(timer, `saved ${this.currentBlockHeight} to database`);

          const lastestPriceId = await PricesRepository.$getLatestPriceId();
          this.updateTimerProgress(timer, `got latest price id ${this.currentBlockHeight}`);
          if (priceUpdater.historyInserted === true && lastestPriceId !== null) {
            await blocksRepository.$saveBlockPrices([{
              height: blockExtended.height,
              priceId: lastestPriceId,
            }]);
            this.updateTimerProgress(timer, `saved prices for ${this.currentBlockHeight}`);
          } else {
            logger.debug(`Cannot save block price for ${blockExtended.height} because the price updater hasnt completed yet. Trying again in 10 seconds.`, logger.tags.mining);
            setTimeout(() => {
              indexer.runSingleTask('blocksPrices');
            }, 10000);
          }

          // Save blocks summary for visualization if it's enabled
          if (Common.blocksSummariesIndexingEnabled() === true) {
            await this.$getStrippedBlockTransactions(blockExtended.id, true);
            this.updateTimerProgress(timer, `saved block summary for ${this.currentBlockHeight}`);
          }
          if (config.MEMPOOL.CPFP_INDEXING) {
            this.$saveCpfp(blockExtended.id, this.currentBlockHeight, cpfpSummary);
            this.updateTimerProgress(timer, `saved cpfp for ${this.currentBlockHeight}`);
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
          this.updateTimerProgress(timer, `saved difficulty adjustment for ${this.currentBlockHeight}`);
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
      if (!memPool.hasPriority() && (block.height % config.MEMPOOL.DISK_CACHE_BLOCK_INTERVAL === 0)) {
        diskCache.$saveCacheToDisk();
      }

      // wait for pending async callbacks to finish
      this.updateTimerProgress(timer, `waiting for async callbacks to complete for ${this.currentBlockHeight}`);
      await Promise.all(callbackPromises);
      this.updateTimerProgress(timer, `async callbacks completed for ${this.currentBlockHeight}`);

      handledBlocks++;
    }

    diskCache.unlock();

    this.clearTimer(timer);

    return handledBlocks;
  }

  private startTimer() {
    const state: any = {
      start: Date.now(),
      progress: 'begin $updateBlocks',
      timer: null,
    };
    state.timer = setTimeout(() => {
      logger.err(`$updateBlocks stalled at "${state.progress}"`);
    }, this.mainLoopTimeout);
    return state;
  }

  private updateTimerProgress(state, msg) {
    state.progress = msg;
  }

  private clearTimer(state) {
    if (state.timer) {
      clearTimeout(state.timer);
    }
  }

  /**
   * Index a block if it's missing from the database. Returns the block after indexing
   */
  public async $indexBlock(height: number): Promise<BlockExtended> {
    if (Common.indexingEnabled()) {
      const dbBlock = await blocksRepository.$getBlockByHeight(height);
      if (dbBlock !== null) {
        return dbBlock;
      }
    }

    const blockHash = await bitcoinApi.$getBlockHash(height);
    const block: IEsploraApi.Block = await bitcoinCoreApi.$getBlock(blockHash);
    const transactions = await this.$getTransactionsExtended(blockHash, block.height, true);
    const blockExtended = await this.$getBlockExtended(block, transactions);

    if (Common.indexingEnabled()) {
      await blocksRepository.$saveBlockInDatabase(blockExtended);
    }

    return blockExtended;
  }

  /**
   * Get one block by its hash
   */
  public async $getBlock(hash: string): Promise<BlockExtended | IEsploraApi.Block> {
    // Check the memory cache
    const blockByHash = this.getBlocks().find((b) => b.id === hash);
    if (blockByHash) {
      return blockByHash;
    }

    // Not Bitcoin network, return the block as it from the bitcoin backend
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK) === false) {
      return await bitcoinCoreApi.$getBlock(hash);
    }

    // Bitcoin network, add our custom data on top
    const block: IEsploraApi.Block = await bitcoinCoreApi.$getBlock(hash);
    return await this.$indexBlock(block.height);
  }

  public async $getStrippedBlockTransactions(hash: string, skipMemoryCache = false,
    skipDBLookup = false): Promise<TransactionStripped[]>
  {
    if (skipMemoryCache === false) {
      // Check the memory cache
      const cachedSummary = this.getBlockSummaries().find((b) => b.id === hash);
      if (cachedSummary?.transactions?.length) {
        return cachedSummary.transactions;
      }
    }

    // Check if it's indexed in db
    if (skipDBLookup === false && Common.blocksSummariesIndexingEnabled() === true) {
      const indexedSummary = await BlocksSummariesRepository.$getByBlockId(hash);
      if (indexedSummary !== undefined && indexedSummary?.transactions?.length) {
        return indexedSummary.transactions;
      }
    }

    // Call Core RPC
    const block = await bitcoinClient.getBlock(hash, 2);
    const summary = this.summarizeBlock(block);

    // Index the response if needed
    if (Common.blocksSummariesIndexingEnabled() === true) {
      await BlocksSummariesRepository.$saveTransactions(block.height, block.hash, summary.transactions);
    }

    return summary.transactions;
  }

  /**
   * Get 15 blocks
   * 
   * Internally this function uses two methods to get the blocks, and
   * the method is automatically selected:
   *  - Using previous block hash links
   *  - Using block height
   * 
   * @param fromHeight 
   * @param limit 
   * @returns 
   */
  public async $getBlocks(fromHeight?: number, limit: number = 15): Promise<BlockExtended[]> {
    let currentHeight = fromHeight !== undefined ? fromHeight : this.currentBlockHeight;
    if (currentHeight > this.currentBlockHeight) {
      limit -= currentHeight - this.currentBlockHeight;
      currentHeight = this.currentBlockHeight;
    }
    const returnBlocks: BlockExtended[] = [];

    if (currentHeight < 0) {
      return returnBlocks;
    }

    for (let i = 0; i < limit && currentHeight >= 0; i++) {
      let block = this.getBlocks().find((b) => b.height === currentHeight);
      if (block) {
        // Using the memory cache (find by height)
        returnBlocks.push(block);
      } else {
        // Using indexing (find by height, index on the fly, save in database)
        block = await this.$indexBlock(currentHeight);
        returnBlocks.push(block);
      }
      currentHeight--;
    }

    return returnBlocks;
  }

  /**
   * Used for bulk block data query
   * 
   * @param fromHeight 
   * @param toHeight 
   */
  public async $getBlocksBetweenHeight(fromHeight: number, toHeight: number): Promise<any> {
    if (!Common.indexingEnabled()) {
      return [];
    }

    const blocks: any[] = [];

    while (fromHeight <= toHeight) {
      let block: BlockExtended | null = await blocksRepository.$getBlockByHeight(fromHeight);
      if (!block) {
        await this.$indexBlock(fromHeight);
        block = await blocksRepository.$getBlockByHeight(fromHeight);
        if (!block) {
          continue;
        }
      }

      // Cleanup fields before sending the response
      const cleanBlock: any = {
        height: block.height ?? null,
        hash: block.id ?? null,
        timestamp: block.timestamp ?? null,
        median_timestamp: block.mediantime ?? null,
        previous_block_hash: block.previousblockhash ?? null,
        difficulty: block.difficulty ?? null,
        header: block.extras.header ?? null,
        version: block.version ?? null,
        bits: block.bits ?? null,
        nonce: block.nonce ?? null,
        size: block.size ?? null,
        weight: block.weight ?? null,
        tx_count: block.tx_count ?? null,
        merkle_root: block.merkle_root ?? null,
        reward: block.extras.reward ?? null,
        total_fee_amt: block.extras.totalFees ?? null,
        avg_fee_amt: block.extras.avgFee ?? null,
        median_fee_amt: block.extras.medianFeeAmt ?? null,
        fee_amt_percentiles: block.extras.feePercentiles ?? null,
        avg_fee_rate: block.extras.avgFeeRate ?? null,
        median_fee_rate: block.extras.medianFee ?? null,
        fee_rate_percentiles: block.extras.feeRange ?? null,
        total_inputs: block.extras.totalInputs ?? null,
        total_input_amt: block.extras.totalInputAmt ?? null,
        total_outputs: block.extras.totalOutputs ?? null,
        total_output_amt: block.extras.totalOutputAmt ?? null,
        segwit_total_txs: block.extras.segwitTotalTxs ?? null,
        segwit_total_size: block.extras.segwitTotalSize ?? null,
        segwit_total_weight: block.extras.segwitTotalWeight ?? null,
        avg_tx_size: block.extras.avgTxSize ?? null,
        utxoset_change: block.extras.utxoSetChange ?? null,
        utxoset_size: block.extras.utxoSetSize ?? null,
        coinbase_raw: block.extras.coinbaseRaw ?? null,
        coinbase_address: block.extras.coinbaseAddress ?? null,
        coinbase_signature: block.extras.coinbaseSignature ?? null,
        coinbase_signature_ascii: block.extras.coinbaseSignatureAscii ?? null,
        pool_slug: block.extras.pool.slug ?? null,
        pool_id: block.extras.pool.id ?? null,
      };

      if (Common.blocksSummariesIndexingEnabled() && cleanBlock.fee_amt_percentiles === null) {
        cleanBlock.fee_amt_percentiles = await BlocksSummariesRepository.$getFeePercentilesByBlockId(cleanBlock.hash);
        if (cleanBlock.fee_amt_percentiles === null) {
          const block = await bitcoinClient.getBlock(cleanBlock.hash, 2);
          const summary = this.summarizeBlock(block);
          await BlocksSummariesRepository.$saveTransactions(cleanBlock.height, cleanBlock.hash, summary.transactions);
          cleanBlock.fee_amt_percentiles = await BlocksSummariesRepository.$getFeePercentilesByBlockId(cleanBlock.hash);
        }
        if (cleanBlock.fee_amt_percentiles !== null) {
          cleanBlock.median_fee_amt = cleanBlock.fee_amt_percentiles[3];
          await blocksRepository.$updateFeeAmounts(cleanBlock.hash, cleanBlock.fee_amt_percentiles, cleanBlock.median_fee_amt);
        }
      }

      cleanBlock.fee_amt_percentiles = {
        'min': cleanBlock.fee_amt_percentiles[0],
        'perc_10': cleanBlock.fee_amt_percentiles[1],
        'perc_25': cleanBlock.fee_amt_percentiles[2],
        'perc_50': cleanBlock.fee_amt_percentiles[3],
        'perc_75': cleanBlock.fee_amt_percentiles[4],
        'perc_90': cleanBlock.fee_amt_percentiles[5],
        'max': cleanBlock.fee_amt_percentiles[6],
      };
      cleanBlock.fee_rate_percentiles = {
        'min': cleanBlock.fee_rate_percentiles[0],
        'perc_10': cleanBlock.fee_rate_percentiles[1],
        'perc_25': cleanBlock.fee_rate_percentiles[2],
        'perc_50': cleanBlock.fee_rate_percentiles[3],
        'perc_75': cleanBlock.fee_rate_percentiles[4],
        'perc_90': cleanBlock.fee_rate_percentiles[5],
        'max': cleanBlock.fee_rate_percentiles[6],
      };

      // Re-org can happen after indexing so we need to always get the
      // latest state from core
      cleanBlock.orphans = chainTips.getOrphanedBlocksAtHeight(cleanBlock.height);

      blocks.push(cleanBlock);
      fromHeight++;
    }

    return blocks;
  }

  public async $getBlockAuditSummary(hash: string): Promise<any> {
    let summary;
    if (['mainnet', 'testnet', 'signet'].includes(config.MEMPOOL.NETWORK)) {
      summary = await BlocksAuditsRepository.$getBlockAudit(hash);
    }

    // fallback to non-audited transaction summary
    if (!summary?.transactions?.length) {
      const strippedTransactions = await this.$getStrippedBlockTransactions(hash);
      summary = {
        transactions: strippedTransactions
      };
    }
    return summary;
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

  public async $indexCPFP(hash: string, height: number): Promise<void> {
    const block = await bitcoinClient.getBlock(hash, 2);
    const transactions = block.tx.map(tx => {
      tx.fee *= 100_000_000;
      return tx;
    });

    const summary = Common.calculateCpfp(height, transactions);

    await this.$saveCpfp(hash, height, summary);

    const effectiveFeeStats = Common.calcEffectiveFeeStatistics(summary.transactions);
    await blocksRepository.$saveEffectiveFeeStats(hash, effectiveFeeStats);
  }

  public async $saveCpfp(hash: string, height: number, cpfpSummary: CpfpSummary): Promise<void> {
    const result = await cpfpRepository.$batchSaveClusters(cpfpSummary.clusters);
    if (!result) {
      await cpfpRepository.$insertProgressMarker(height);
    }
  }
}

export default new Blocks();
