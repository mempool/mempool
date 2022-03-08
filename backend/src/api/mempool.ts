import config from '../config';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import { TransactionExtended, VbytesPerSecond } from '../mempool.interfaces';
import logger from '../logger';
import { Common } from './common';
import transactionUtils from './transaction-utils';
import { IBitcoinApi } from './bitcoin/bitcoin-api.interface';
import loadingIndicators from './loading-indicators';
import bitcoinClient from './bitcoin/bitcoin-client';
import bitcoinSecondClient from './bitcoin/bitcoin-second-client';
import rbfCache from './rbf-cache';

class Mempool {
  private static WEBSOCKET_REFRESH_RATE_MS = 10000;
  private static LAZY_DELETE_AFTER_SECONDS = 30;
  private inSync: boolean = false;
  private mempoolCacheDelta: number = -1;
  private mempoolCache: { [txId: string]: TransactionExtended } = {};
  private mempoolInfo: IBitcoinApi.MempoolInfo = { loaded: false, size: 0, bytes: 0, usage: 0, total_fee: 0,
                                                    maxmempool: 300000000, mempoolminfee: 0.00001000, minrelaytxfee: 0.00001000 };
  private mempoolChangedCallback: ((newMempool: {[txId: string]: TransactionExtended; }, newTransactions: TransactionExtended[],
    deletedTransactions: TransactionExtended[]) => void) | undefined;

  private txPerSecondArray: number[] = [];
  private txPerSecond: number = 0;

  private vBytesPerSecondArray: VbytesPerSecond[] = [];
  private vBytesPerSecond: number = 0;
  private mempoolProtection = 0;
  private latestTransactions: any[] = [];

  constructor() {
    setInterval(this.updateTxPerSecond.bind(this), 1000);
    setInterval(this.deleteExpiredTransactions.bind(this), 20000);
  }

  /**
   * Return true if we should leave resources available for mempool tx caching
   */
  public hasPriority(): boolean {
    if (this.inSync) {
      return false;
    } else {
      return this.mempoolCacheDelta == -1 || this.mempoolCacheDelta > 25;
    }
  }

  public isInSync(): boolean {
    return this.inSync;
  }

  public setOutOfSync(): void {
    this.inSync = false;
    loadingIndicators.setProgress('mempool', 99);
  }

  public getLatestTransactions() {
    return this.latestTransactions;
  }

  public setMempoolChangedCallback(fn: (newMempool: { [txId: string]: TransactionExtended; },
    newTransactions: TransactionExtended[], deletedTransactions: TransactionExtended[]) => void) {
    this.mempoolChangedCallback = fn;
  }

  public getMempool(): { [txid: string]: TransactionExtended } {
    return this.mempoolCache;
  }

  public setMempool(mempoolData: { [txId: string]: TransactionExtended }) {
    this.mempoolCache = mempoolData;
    if (this.mempoolChangedCallback) {
      this.mempoolChangedCallback(this.mempoolCache, [], []);
    }
  }

  public async $updateMemPoolInfo() {
    this.mempoolInfo = await this.$getMempoolInfo();
  }

  public getMempoolInfo(): IBitcoinApi.MempoolInfo {
    return this.mempoolInfo;
  }

  public getTxPerSecond(): number {
    return this.txPerSecond;
  }

  public getVBytesPerSecond(): number {
    return this.vBytesPerSecond;
  }

  public getFirstSeenForTransactions(txIds: string[]): number[] {
    const txTimes: number[] = [];
    txIds.forEach((txId: string) => {
      const tx = this.mempoolCache[txId];
      if (tx && tx.firstSeen) {
        txTimes.push(tx.firstSeen);
      } else {
        txTimes.push(0);
      }
    });
    return txTimes;
  }

  public async $updateMempool() {
    logger.debug('Updating mempool');
    const start = new Date().getTime();
    let hasChange: boolean = false;
    const currentMempoolSize = Object.keys(this.mempoolCache).length;
    let txCount = 0;
    const transactions = await bitcoinApi.$getRawMempool();
    const diff = transactions.length - currentMempoolSize;
    const newTransactions: TransactionExtended[] = [];

    this.mempoolCacheDelta = Math.abs(diff);

    if (!this.inSync) {
      loadingIndicators.setProgress('mempool', Object.keys(this.mempoolCache).length / transactions.length * 100);
    }

    for (const txid of transactions) {
      if (!this.mempoolCache[txid]) {
        try {
          const transaction = await transactionUtils.$getTransactionExtended(txid);
          this.mempoolCache[txid] = transaction;
          txCount++;
          if (this.inSync) {
            this.txPerSecondArray.push(new Date().getTime());
            this.vBytesPerSecondArray.push({
              unixTime: new Date().getTime(),
              vSize: transaction.vsize,
            });
          }
          hasChange = true;
          if (diff > 0) {
            logger.debug('Fetched transaction ' + txCount + ' / ' + diff);
          } else {
            logger.debug('Fetched transaction ' + txCount);
          }
          newTransactions.push(transaction);
        } catch (e) {
          logger.debug('Error finding transaction in mempool: ' + (e instanceof Error ? e.message : e));
        }
      }

      if ((new Date().getTime()) - start > Mempool.WEBSOCKET_REFRESH_RATE_MS) {
        break;
      }
    }

    // Prevent mempool from clear on bitcoind restart by delaying the deletion
    if (this.mempoolProtection === 0
      && currentMempoolSize > 20000
      && transactions.length / currentMempoolSize <= 0.80
    ) {
      this.mempoolProtection = 1;
      this.inSync = false;
      logger.warn(`Mempool clear protection triggered because transactions.length: ${transactions.length} and currentMempoolSize: ${currentMempoolSize}.`);
      setTimeout(() => {
        this.mempoolProtection = 2;
        logger.warn('Mempool clear protection resumed.');
      }, 1000 * 60 * config.MEMPOOL.CLEAR_PROTECTION_MINUTES);
    }

    const deletedTransactions: TransactionExtended[] = [];

    if (this.mempoolProtection !== 1) {
      this.mempoolProtection = 0;
      // Index object for faster search
      const transactionsObject = {};
      transactions.forEach((txId) => transactionsObject[txId] = true);

      // Flag transactions for lazy deletion
      for (const tx in this.mempoolCache) {
        if (!transactionsObject[tx] && !this.mempoolCache[tx].deleteAfter) {
          deletedTransactions.push(this.mempoolCache[tx]);
          this.mempoolCache[tx].deleteAfter = new Date().getTime() + Mempool.LAZY_DELETE_AFTER_SECONDS * 1000;
        }
      }
    }

    const newTransactionsStripped = newTransactions.map((tx) => Common.stripTransaction(tx));
    this.latestTransactions = newTransactionsStripped.concat(this.latestTransactions).slice(0, 6);

    if (!this.inSync && transactions.length === Object.keys(this.mempoolCache).length) {
      this.inSync = true;
      logger.notice('The mempool is now in sync!');
      loadingIndicators.setProgress('mempool', 100);
    }

    this.mempoolCacheDelta = Math.abs(transactions.length - Object.keys(this.mempoolCache).length);

    if (this.mempoolChangedCallback && (hasChange || deletedTransactions.length)) {
      this.mempoolChangedCallback(this.mempoolCache, newTransactions, deletedTransactions);
    }

    const end = new Date().getTime();
    const time = end - start;
    logger.debug(`New mempool size: ${Object.keys(this.mempoolCache).length} Change: ${diff}`);
    logger.debug('Mempool updated in ' + time / 1000 + ' seconds');
  }

  public handleRbfTransactions(rbfTransactions: { [txid: string]: TransactionExtended; }) {
    for (const rbfTransaction in rbfTransactions) {
      if (this.mempoolCache[rbfTransaction]) {
        // Store replaced transactions
        rbfCache.add(rbfTransaction, rbfTransactions[rbfTransaction].txid);
        // Erase the replaced transactions from the local mempool
        delete this.mempoolCache[rbfTransaction];
      }
    }
  }

  private updateTxPerSecond() {
    const nowMinusTimeSpan = new Date().getTime() - (1000 * config.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD);
    this.txPerSecondArray = this.txPerSecondArray.filter((unixTime) => unixTime > nowMinusTimeSpan);
    this.txPerSecond = this.txPerSecondArray.length / config.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD || 0;

    this.vBytesPerSecondArray = this.vBytesPerSecondArray.filter((data) => data.unixTime > nowMinusTimeSpan);
    if (this.vBytesPerSecondArray.length) {
      this.vBytesPerSecond = Math.round(
        this.vBytesPerSecondArray.map((data) => data.vSize).reduce((a, b) => a + b) / config.STATISTICS.TX_PER_SECOND_SAMPLE_PERIOD
      );
    }
  }

  private deleteExpiredTransactions() {
    const now = new Date().getTime();
    for (const tx in this.mempoolCache) {
      const lazyDeleteAt = this.mempoolCache[tx].deleteAfter;
      if (lazyDeleteAt && lazyDeleteAt < now) {
        delete this.mempoolCache[tx];
      }
    }
  }

  private $getMempoolInfo() {
    if (config.MEMPOOL.USE_SECOND_NODE_FOR_MINFEE) {
      return Promise.all([
        bitcoinClient.getMempoolInfo(),
        bitcoinSecondClient.getMempoolInfo()
      ]).then(([mempoolInfo, secondMempoolInfo]) => {
        mempoolInfo.maxmempool = secondMempoolInfo.maxmempool;
        mempoolInfo.mempoolminfee = secondMempoolInfo.mempoolminfee;
        mempoolInfo.minrelaytxfee = secondMempoolInfo.minrelaytxfee;
        return mempoolInfo;
      });
    }
    return bitcoinClient.getMempoolInfo();
  }
}

export default new Mempool();
