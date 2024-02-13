import config from '../config';
import logger from '../logger';
import { MempoolTransactionExtended } from '../mempool.interfaces';
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import bitcoinClient from './bitcoin/bitcoin-client';
import mempool from './mempool';
import mempoolBlocks from './mempool-blocks';

/**
 * Transaction Rebroadcaster
 *
 * Automatically rebroadcasts transactions from near the top of the mempool which peers may not know about.
 *
 *  e.g:
 *   - transactions older than the default mempoolexpiry (336 hours)
 *   - transactions which previously fell below the default maxmempool purge rate
 *   - transactions we observed to be unexpectedly missing from recent mined blocks
 *
 * To avoid spamming relay peers, rebroadcasting is probabilistic, based on the target frequency
 * set in config.REBROADCAST.FREQUENCY and a "priority" derived from the reason for rebroadcast.
 */

class Rebroadcaster {
  private unpurged = new Set<string>();
  private rebroadcasted = new Set<string>();
  private missing = new Set<string>();
  private lastRun = (Date.now() / 1000);

  async $run(): Promise<void> {
    if (!config.REBROADCAST.ENABLED) {
      return;
    }

    const now = Date.now() / 1000;
    const transactions = mempool.getMempool();
    const blocks = mempoolBlocks.getMempoolBlocksWithTransactions();
    const toRebroadcast: { txid: string, priority: number }[] = [];

    const twoWeeksAgo = now - (14 * 24 * 60 * 60);
    for (const block of blocks) {
      for (const txid of block.transactionIds) {
        const tx = transactions[txid];
        if (tx && this.isRebroadcastable(tx, twoWeeksAgo)) {
          if (this.unpurged.has(tx.txid) || this.missing.has(tx.txid)) {
            toRebroadcast.push({ txid: tx.txid, priority: 1 });
          } else {
            const depth = (tx.position?.block || 0) * (config.MEMPOOL.BLOCK_WEIGHT_UNITS / 4) + (tx.position?.vsize || 0);
            // priority approaches 0.5 as mempool depth approaches zero
            // scaling factor ensures all txs in the next block have priority >= 0.4
            const priority = 0.5 / (1 + (depth / (config.MEMPOOL.BLOCK_WEIGHT_UNITS * 2)));
            toRebroadcast.push({ txid: tx.txid, priority });
          }
        }
      }
    }

    const elapsed = now - this.lastRun;
    // config.REBROADCAST.FREQUENCY is actually the target /period/
    const probabilityFactor = elapsed / config.REBROADCAST.FREQUENCY;

    let totalRebroadcast = 0;
    let totalFailed = 0;
    for (const tx of toRebroadcast) {
      // rebroadcast with probability = priority * frequency / number of txs
      const cluster = this.getAncestors(tx.txid, transactions, twoWeeksAgo);
      if (Math.random() < (tx.priority * probabilityFactor / cluster.length)) {
        for (const txid of cluster) {
          if (await this.$rebroadcastTx(txid)) {
            totalRebroadcast++;
          } else {
            totalFailed++;
          }
        }
      }
    }

    this.lastRun = (Date.now() / 1000);
    logger.debug(`${toRebroadcast.length - totalRebroadcast} candidates, ${totalRebroadcast + totalFailed} attempted, ${totalRebroadcast} successful`, logger.tags.rebroadcaster);
  }

  // allow rebroadcast of old, missing or previously purged transactions
  // within the first 7 projected blocks, that haven't been rebroadcast before
  private isRebroadcastable(tx: MempoolTransactionExtended, minAge: number): boolean {
    return !!(tx.firstSeen
      && tx.position
      && tx.position.block < 7
      && ((tx.firstSeen < minAge) || this.unpurged.has(tx.txid) || this.missing.has(tx.txid))
      && !this.rebroadcasted.has(tx.txid)
    );
  }

  private async $rebroadcastTx(txid: string): Promise<boolean> {
    try {
      const hex = await bitcoinApi.$getTransactionHex(txid);
      if (hex) {
        const txidResult = await bitcoinClient.sendRawTransaction(hex);
        if (txidResult) {
          this.rebroadcasted.add(txid);
          return true;
        }
      }
    } catch (e) {
      logger.warn('Failed to rebroadcast transaction: ' + (e instanceof Error ? e.message : e));
    }
    return false;
  }

  // find and return a list of rebroadcastable ancestors of the given txid (including itself)
  private getAncestors(txid: string, transactions: { [txid: string]: MempoolTransactionExtended }, minAge: number): string[] {
    const ancestors = new Set<string>();
    const skip = new Set<string>();
    const stack: string[] = [txid];
    let sanityBreak = 0;
    while (stack.length && sanityBreak < 100) {
      const nextTxid = stack.pop();
      if (nextTxid) {
        ancestors.add(nextTxid);
        for (const vin of transactions[nextTxid].vin) {
          if ( !skip.has(nextTxid)
            && !ancestors.has(nextTxid)
            && transactions[nextTxid]
            && this.isRebroadcastable(transactions[nextTxid], minAge)
          ) {
            stack.push(vin.txid);
          } else {
            skip.add(nextTxid);
          }
        }
      }
      sanityBreak++;
    }
    return [...ancestors.keys()].reverse();
  }

  // transaction re-entered default mempools
  public unpurge(txid: string): void {
    if (!config.REBROADCAST.ENABLED) {
      return;
    }

    this.unpurged.add(txid);
  }

  // transaction was purged from default mempools
  public purge(txid: string): void {
    if (!config.REBROADCAST.ENABLED) {
      return;
    }

    this.unpurged.delete(txid);
    this.missing.delete(txid);
    this.rebroadcasted.delete(txid);
  }

  // transactions were unexpectedly missing from a block
  public missed(txids: string[]): void {
    if (!config.REBROADCAST.ENABLED) {
      return;
    }

    for (const txid of txids) {
      this.missing.add(txid);
    }
  }

  // transactions were evicted or mined
  public remove(txids: string[]): void {
    if (!config.REBROADCAST.ENABLED) {
      return;
    }

    for (const txid of txids) {
      this.unpurged.delete(txid);
      this.missing.delete(txid);
      this.rebroadcasted.delete(txid);
    }
  }
}

export default new Rebroadcaster();