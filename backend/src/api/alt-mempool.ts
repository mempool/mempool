import config from '../config';
import { TransactionExtended } from '../mempool.interfaces';
import logger from '../logger';
import { Common } from './common';
import { IBitcoinApi } from './bitcoin/bitcoin-api.interface';
import BitcoinApi from './bitcoin/bitcoin-api';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import bitcoinSecondClient from './bitcoin/bitcoin-second-client';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import { Mempool } from './mempool';

class AltMempool extends Mempool {
  private bitcoinSecondApi: BitcoinApi;

  constructor() {
    super();
    this.bitcoinSecondApi = new BitcoinApi(bitcoinSecondClient, this, bitcoinApi);
  }

  protected init(): void {
    // override
  }

  public setOutOfSync(): void {
    this.inSync = false;
  }

  public setMempool(mempoolData: { [txId: string]: TransactionExtended }): void {
    this.mempoolCache = mempoolData;
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

  public async $updateMempool(): Promise<void> {
    logger.debug(`Updating alternative mempool...`);
    const start = new Date().getTime();
    const currentMempoolSize = Object.keys(this.mempoolCache).length;
    const transactions = await this.bitcoinSecondApi.$getRawMempool();
    const diff = transactions.length - currentMempoolSize;

    this.mempoolCacheDelta = Math.abs(diff);
    const loadingMempool = this.mempoolCacheDelta > 100;

    for (const txid of transactions) {
      if (!this.mempoolCache[txid]) {
        try {
          const transaction = await this.$fetchTransaction(txid);
          this.mempoolCache[txid] = transaction;
          if (loadingMempool && Object.keys(this.mempoolCache).length % 50 === 0) {
            logger.info(`loaded ${Object.keys(this.mempoolCache).length}/${transactions.length} alternative mempool transactions`);
          }
        } catch (e) {
          logger.debug(`Error finding transaction '${txid}' in the alternative mempool: ` + (e instanceof Error ? e.message : e));
        }
      }

      if ((new Date().getTime()) - start > Mempool.WEBSOCKET_REFRESH_RATE_MS) {
        break;
      }
    }
    if (loadingMempool) {
      logger.info(`loaded ${Object.keys(this.mempoolCache).length}/${transactions.length} alternative mempool transactions`);
    }

    // Prevent mempool from clear on bitcoind restart by delaying the deletion
    if (this.mempoolProtection === 0
      && currentMempoolSize > 20000
      && transactions.length / currentMempoolSize <= 0.80
    ) {
      this.mempoolProtection = 1;
      setTimeout(() => {
        this.mempoolProtection = 2;
      }, 1000 * 60 * config.MEMPOOL.CLEAR_PROTECTION_MINUTES);
    }

    const deletedTransactions: string[] = [];

    if (this.mempoolProtection !== 1) {
      this.mempoolProtection = 0;
      // Index object for faster search
      const transactionsObject = {};
      transactions.forEach((txId) => transactionsObject[txId] = true);

      // Flag transactions for lazy deletion
      for (const tx in this.mempoolCache) {
        if (!transactionsObject[tx] && !this.mempoolCache[tx].deleteAfter) {
          deletedTransactions.push(this.mempoolCache[tx].txid);
        }
      }
      for (const txid of deletedTransactions) {
        delete this.mempoolCache[txid];
      }
    }

    this.mempoolCacheDelta = Math.abs(transactions.length - Object.keys(this.mempoolCache).length);

    const end = new Date().getTime();
    const time = end - start;
    logger.debug(`Alt mempool updated in ${time / 1000} seconds. New size: ${Object.keys(this.mempoolCache).length} (${diff > 0 ? '+' + diff : diff})`);
  }

  public getTransaction(txid: string): TransactionExtended {
    return this.mempoolCache[txid] || null;
  }

  protected async $fetchTransaction(txid: string): Promise<TransactionExtended> {
    const rawTx = await this.bitcoinSecondApi.$getRawTransaction(txid, false, true, false);
    return this.extendTransaction(rawTx);
  }

  protected extendTransaction(transaction: IEsploraApi.Transaction): TransactionExtended {
    // @ts-ignore
    if (transaction.vsize) {
      // @ts-ignore
      return transaction;
    }
    const feePerVbytes = Math.max(Common.isLiquid() ? 0.1 : 1,
      (transaction.fee || 0) / (transaction.weight / 4));
    const transactionExtended: TransactionExtended = Object.assign({
      vsize: Math.round(transaction.weight / 4),
      feePerVsize: feePerVbytes,
      effectiveFeePerVsize: feePerVbytes,
    }, transaction);
    if (!transaction.status.confirmed) {
      transactionExtended.firstSeen = Math.round((new Date().getTime() / 1000));
    }
    return transactionExtended;
  }

  public async $updateMemPoolInfo(): Promise<void> {
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

  public handleRbfTransactions(rbfTransactions: { [txid: string]: TransactionExtended; }): void {
    for (const rbfTransaction in rbfTransactions) {
      if (this.mempoolCache[rbfTransaction]) {
        // Erase the replaced transactions from the local mempool
        delete this.mempoolCache[rbfTransaction];
      }
    }
  }

  protected updateTxPerSecond(): void {}

  protected deleteExpiredTransactions(): void {}

  protected $getMempoolInfo(): any {
    return bitcoinSecondClient.getMempoolInfo();
  }
}

export default new AltMempool();
