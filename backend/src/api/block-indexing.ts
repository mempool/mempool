import config from '../config';
import logger from '../logger';
import { BlockExtended, PoolTag, TransactionMinerInfo } from '../mempool.interfaces';
import BlocksRepository from '../repositories/BlocksRepository';
import PoolsRepository from '../repositories/PoolsRepository';
import bitcoinClient from './bitcoin/bitcoin-client';
import transactionUtils from './transaction-utils';
import { workerData } from 'worker_threads';

const { offsetStart, offsetEnd } = workerData;

class BlockIndexing {
  blockIndexingStarted = false;
  blockIndexingCompleted = false;

  constructor() {
    this.$generateBlockDatabase();
  }

  public async $generateBlockDatabase() {
    if (this.blockIndexingStarted) {
      return;
    }

    const blockchainInfo = await bitcoinClient.getBlockchainInfo();
    if (blockchainInfo.blocks !== blockchainInfo.headers) { // Wait for node to sync
      return;
    }

    this.blockIndexingStarted = true;

    try {
      let currentBlockHeight = blockchainInfo.blocks;

      // let indexingBlockAmount = config.MEMPOOL.INDEXING_BLOCKS_AMOUNT;
      // if (indexingBlockAmount <= -1) {
      //   indexingBlockAmount = currentBlockHeight + 1;
      // }

      currentBlockHeight = currentBlockHeight - offsetStart;
      const lastBlockToIndex = Math.max(0, currentBlockHeight - offsetEnd);
      const indexingBlockAmount = currentBlockHeight - lastBlockToIndex;

      // const lastBlockToIndex = Math.max(0, currentBlockHeight - indexingBlockAmount + 1);
      logger.info(`Indexing blocks from #${currentBlockHeight} to #${lastBlockToIndex}`);

      let totaIndexed = await BlocksRepository.$blockCount(null, null);
      let indexedThisRun = 0;
      const startedAt = new Date().getTime() / 1000;
      let timer = new Date().getTime() / 1000;

      const chunkSize = 100;
      while (currentBlockHeight >= lastBlockToIndex) {
        const endBlock = Math.max(0, lastBlockToIndex, currentBlockHeight - chunkSize + 1);
        const missingBlockHeights: number[] = await BlocksRepository.$getMissingBlocksBetweenHeights(
          currentBlockHeight, endBlock);

        if (missingBlockHeights.length <= 0) {
          currentBlockHeight -= chunkSize;
          continue;
        }

        logger.debug(`Indexing ${missingBlockHeights.length} blocks from #${currentBlockHeight} to #${endBlock}`);

        const blocks = {}; // We will build our BlockExtended object step by step
        let batchRPC: any[] = [];

        // Collect blocks hash
        for (const blockHeight of missingBlockHeights) {
          batchRPC.push({
            method: 'getblockhash',
            params: [blockHeight],
            id: `${blockHeight}`,
          });
        }
        let res = await bitcoinClient.cmd(batchRPC);

        for (const entry in res) {
          blocks[res[entry]['id']] = {
            'hash': res[entry]['result'],
            extras: {},
          }
        }

        // Collect blocks header and block stats
        batchRPC = [];
        for (const blockHeight in blocks) {
          batchRPC.push({
            method: 'getblock',
            params: [blocks[blockHeight].hash],
            id: `block-${blockHeight}`,
          });
          batchRPC.push({
            method: 'getblockstats',
            params: [blocks[blockHeight].hash],
            id: `stats-${blockHeight}`,
          });
        }
        res = await bitcoinClient.cmd(batchRPC);

        for (const entry in res) {
          const tmp = res[entry]['result'];
          const id: string = res[entry]['id'];
          if (id.includes('block')) {
            const height = id.replace('block-', '');
            blocks[height].id = tmp.hash;
            blocks[height].height = tmp.height;
            blocks[height].version = tmp.version;
            blocks[height].timestamp = tmp.time;
            blocks[height].bits = parseInt(tmp.bits, 16);
            blocks[height].nonce = tmp.nonce;
            blocks[height].difficulty = tmp.difficulty;
            blocks[height].merkle_root = tmp.merkleroot;
            blocks[height].tx_count = tmp.nTx;
            blocks[height].size = tmp.size;
            blocks[height].weight = tmp.weight;
            blocks[height].previousblockhash = tmp.previousblockhash;
            blocks[height].coinbaseTxId = tmp.tx[0];
          } else if (id.includes('stats')) {
            const height = id.replace('stats-', '');
            blocks[height].extras.medianFee = tmp.feerate_percentiles[2];
            blocks[height].extras.feeRange = JSON.stringify([tmp.minfeerate, ...tmp.feerate_percentiles, tmp.maxfeerate]);
            blocks[height].extras.totalFees = tmp.totalfee;
            blocks[height].extras.avgFee = tmp.avgfee;
            blocks[height].extras.avgFeeRate = tmp.avgfeerate;
          }
        }

        // Collect coinbase tx
        batchRPC = [];
        for (const height in blocks) {
          batchRPC.push({
            method: 'getrawtransaction',
            params: [blocks[height]['coinbaseTxId'], 1],
            id: `${blocks[height]['height']}`,
          });
        }
        res = await bitcoinClient.cmd(batchRPC);

        for (const entry in res) {
          const tmp = res[entry]['result'];
          const id: string = res[entry]['id'];
          const coinbase = transactionUtils.stripCoinbaseTransaction(tmp);
          blocks[id].extras.coinbaseRaw = transactionUtils.hex2ascii(coinbase.vin[0].scriptsig);
          blocks[id].extras.reward = 100000000 * coinbase.vout.reduce((acc, curr) => acc + curr.value, 0);

          // Find miner
          let pool: PoolTag;
          if (coinbase !== undefined) {
            pool = await this.$findBlockMiner(coinbase);
          } else {
            pool = await PoolsRepository.$getUnknownPool();
          }
          blocks[id].extras.pool = {
            id: pool.id,
            name: pool.name
          };
        }

        const blocksArray: BlockExtended[] = [];
        Object.keys(blocks).forEach(key => blocksArray.push(blocks[key]));

        await BlocksRepository.$saveBlocks(blocksArray);

        // #region logging
        indexedThisRun += blocksArray.length;
        totaIndexed += blocksArray.length;
        const elapsedSeconds = Math.max(1, Math.round((new Date().getTime() / 1000) - timer));
        if (elapsedSeconds > 5) {
          const runningFor = Math.max(1, Math.round((new Date().getTime() / 1000) - startedAt));
          const blockPerSeconds = Math.max(1, Math.round(indexedThisRun / elapsedSeconds));
          const progress = Math.round(totaIndexed / indexingBlockAmount * 100);
          const timeLeft = Math.round((indexingBlockAmount - totaIndexed) / blockPerSeconds);
          logger.debug(`Indexing blocks | ~${blockPerSeconds} blocks/sec | total: ${totaIndexed}/${indexingBlockAmount} (${progress}%) | elapsed: ${runningFor} seconds | left: ~${timeLeft} seconds`);
          timer = new Date().getTime() / 1000;
          indexedThisRun = 0;
        }
        // #endregion logging
        currentBlockHeight -= chunkSize;
      }
      logger.info('Block indexing completed');
    } catch (e) {
      logger.err('An error occured in $generateBlockDatabase(). Trying again later. ' + e);
      this.blockIndexingStarted = false;
      return;
    }

    this.blockIndexingCompleted = true;
  }

  /**
   * Try to find which miner found the block
   * @param txMinerInfo
   * @returns
   */
  private async $findBlockMiner(txMinerInfo: TransactionMinerInfo | undefined): Promise<PoolTag> {
    if (txMinerInfo === undefined || txMinerInfo.vout.length < 1) {
      return await PoolsRepository.$getUnknownPool();
    }

    const asciiScriptSig = transactionUtils.hex2ascii(txMinerInfo.vin[0].scriptsig);
    const address = txMinerInfo.vout[0].scriptpubkey_address;

    const pools: PoolTag[] = await PoolsRepository.$getPools();
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

    return await PoolsRepository.$getUnknownPool();
  }
}

export default new BlockIndexing();
