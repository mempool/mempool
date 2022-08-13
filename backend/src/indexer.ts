import { Common } from './api/common';
import blocks from './api/blocks';
import mempool from './api/mempool';
import mining from './api/mining/mining';
import logger from './logger';
import HashratesRepository from './repositories/HashratesRepository';
import bitcoinClient from './api/bitcoin/bitcoin-client';
import priceUpdater from './tasks/price-updater';
import PricesRepository from './repositories/PricesRepository';

class Indexer {
  runIndexer = true;
  indexerRunning = false;
  tasksRunning: string[] = [];

  public reindex() {
    if (Common.indexingEnabled()) {
      this.runIndexer = true;
    }
  }

  public async runSingleTask(task: 'blocksPrices') {
    if (!Common.indexingEnabled()) {
      return;
    }

    if (task === 'blocksPrices' && !this.tasksRunning.includes(task)) {
      this.tasksRunning.push(task);
      const lastestPriceId = await PricesRepository.$getLatestPriceId();
      if (priceUpdater.historyInserted === false || lastestPriceId === null) {
        logger.debug(`Blocks prices indexer is waiting for the price updater to complete`)
        setTimeout(() => {
          this.tasksRunning = this.tasksRunning.filter(runningTask => runningTask != task)
          this.runSingleTask('blocksPrices');
        }, 10000);
      } else {
        logger.debug(`Blocks prices indexer will run now`)
        await mining.$indexBlockPrices();
        this.tasksRunning = this.tasksRunning.filter(runningTask => runningTask != task)
      }
    }
  }

  public async $run() {
    if (!Common.indexingEnabled() || this.runIndexer === false ||
      this.indexerRunning === true || mempool.hasPriority()
    ) {
      return;
    }

    // Do not attempt to index anything unless Bitcoin Core is fully synced
    const blockchainInfo = await bitcoinClient.getBlockchainInfo();
    if (blockchainInfo.blocks !== blockchainInfo.headers) {
      return;
    }

    this.runIndexer = false;
    this.indexerRunning = true;

    logger.debug(`Running mining indexer`);

    try {
      await priceUpdater.$run();

      const chainValid = await blocks.$generateBlockDatabase();
      if (chainValid === false) {
        // Chain of block hash was invalid, so we need to reindex. Stop here and continue at the next iteration
        logger.warn(`The chain of block hash is invalid, re-indexing invalid data in 10 seconds.`);
        setTimeout(() => this.reindex(), 10000);
        this.indexerRunning = false;
        return;
      }

      this.runSingleTask('blocksPrices');
      await mining.$indexDifficultyAdjustments();
      await this.$resetHashratesIndexingState(); // TODO - Remove this as it's not efficient
      await mining.$generateNetworkHashrateHistory();
      await mining.$generatePoolHashrateHistory();
      await blocks.$generateBlocksSummariesDatabase();
    } catch (e) {
      this.indexerRunning = false;
      logger.err(`Indexer failed, trying again in 10 seconds. Reason: ` + (e instanceof Error ? e.message : e));
      setTimeout(() => this.reindex(), 10000);
      this.indexerRunning = false;
      return;
    }

    this.indexerRunning = false;

    const runEvery = 1000 * 3600; // 1 hour
    logger.debug(`Indexing completed. Next run planned at ${new Date(new Date().getTime() + runEvery).toUTCString()}`);
    setTimeout(() => this.reindex(), runEvery);
  }

  async $resetHashratesIndexingState() {
    try {
      await HashratesRepository.$setLatestRun('last_hashrates_indexing', 0);
      await HashratesRepository.$setLatestRun('last_weekly_hashrates_indexing', 0);
    } catch (e) {
      logger.err(`Cannot reset hashrate indexing timestamps. Reason: ` + (e instanceof Error ? e.message : e));
      throw e;
    }
  }
}

export default new Indexer();
