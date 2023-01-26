import { existsSync, promises } from 'fs';
import bitcoinClient from '../../../api/bitcoin/bitcoin-client';
import { Common } from '../../../api/common';
import config from '../../../config';
import logger from '../../../logger';

const fsPromises = promises;

const BLOCKS_CACHE_MAX_SIZE = 100;  
const CACHE_FILE_NAME = config.MEMPOOL.CACHE_DIR + '/ln-funding-txs-cache.json';

class FundingTxFetcher {
  private running = false;
  private blocksCache = {};
  private channelNewlyProcessed = 0;
  public fundingTxCache = {};

  async $init(): Promise<void> {
    // Load funding tx disk cache
    if (Object.keys(this.fundingTxCache).length === 0 && existsSync(CACHE_FILE_NAME)) {
      try {
        this.fundingTxCache = JSON.parse(await fsPromises.readFile(CACHE_FILE_NAME, 'utf-8'));
      } catch (e) {
        logger.err(`Unable to parse channels funding txs disk cache. Starting from scratch`, logger.tags.ln);
        this.fundingTxCache = {};
      }
      logger.debug(`Imported ${Object.keys(this.fundingTxCache).length} funding tx amount from the disk cache`, logger.tags.ln);
    }
  }

  async $fetchChannelsFundingTxs(channelIds: string[]): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    
    const globalTimer = new Date().getTime() / 1000;
    let cacheTimer = new Date().getTime() / 1000;
    let loggerTimer = new Date().getTime() / 1000;
    let channelProcessed = 0;
    this.channelNewlyProcessed = 0;
    for (const channelId of channelIds) {
      await this.$fetchChannelOpenTx(channelId);
      ++channelProcessed;

      let elapsedSeconds = Math.round((new Date().getTime() / 1000) - loggerTimer);
      if (elapsedSeconds > config.LIGHTNING.LOGGER_UPDATE_INTERVAL) {
        elapsedSeconds = Math.round((new Date().getTime() / 1000) - globalTimer);
        logger.info(`Indexing channels funding tx ${channelProcessed + 1} of ${channelIds.length} ` +
          `(${Math.floor(channelProcessed / channelIds.length * 10000) / 100}%) | ` +
          `elapsed: ${elapsedSeconds} seconds`,
          logger.tags.ln
        );
        loggerTimer = new Date().getTime() / 1000;
      }

      elapsedSeconds = Math.round((new Date().getTime() / 1000) - cacheTimer);
      if (elapsedSeconds > 60) {
        logger.debug(`Saving ${Object.keys(this.fundingTxCache).length} funding txs cache into disk`, logger.tags.ln);
        fsPromises.writeFile(CACHE_FILE_NAME, JSON.stringify(this.fundingTxCache));
        cacheTimer = new Date().getTime() / 1000;
      }
    }

    if (this.channelNewlyProcessed > 0) {
      logger.info(`Indexed ${this.channelNewlyProcessed} additional channels funding tx`, logger.tags.ln);
      logger.debug(`Saving ${Object.keys(this.fundingTxCache).length} funding txs cache into disk`, logger.tags.ln);
      fsPromises.writeFile(CACHE_FILE_NAME, JSON.stringify(this.fundingTxCache));
    }

    this.running = false;
  }
  
  public async $fetchChannelOpenTx(channelId: string): Promise<{timestamp: number, txid: string, value: number} | null> {
    channelId = Common.channelIntegerIdToShortId(channelId);

    if (this.fundingTxCache[channelId]) {
      return this.fundingTxCache[channelId];
    }

    const parts = channelId.split('x');
    const blockHeight = parts[0];
    const txIdx = parts[1];
    const outputIdx = parts[2];

    let block = this.blocksCache[blockHeight];
    // Fetch it from core
    if (!block) {
      const blockHash = await bitcoinClient.getBlockHash(parseInt(blockHeight, 10));
      block = await bitcoinClient.getBlock(blockHash, 1);
    }
    this.blocksCache[block.height] = block;

    const blocksCacheHashes = Object.keys(this.blocksCache).sort((a, b) => parseInt(b) - parseInt(a)).reverse();
    if (blocksCacheHashes.length > BLOCKS_CACHE_MAX_SIZE) {
      for (let i = 0; i < 10; ++i) {
        delete this.blocksCache[blocksCacheHashes[i]];
      }
    }

    const txid = block.tx[txIdx];
    const rawTx = await bitcoinClient.getRawTransaction(txid);
    const tx = await bitcoinClient.decodeRawTransaction(rawTx);

    if (!tx || !tx.vout || tx.vout.length < parseInt(outputIdx, 10) + 1 || tx.vout[outputIdx].value === undefined) {
      logger.err(`Cannot find blockchain funding tx for channel id ${channelId}. Possible reasons are: bitcoin backend timeout or the channel shortId is not valid`);
      return null;
    }

    this.fundingTxCache[channelId] = {
      timestamp: block.time,
      txid: txid,
      value: tx.vout[outputIdx].value,
    };

    ++this.channelNewlyProcessed;

    return this.fundingTxCache[channelId];
  }
}

export default new FundingTxFetcher;
