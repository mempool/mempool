import { TransactionExtended } from "../mempool.interfaces";

class RbfCache {
  private replacedBy: { [txid: string]: string; } = {};
  private replaces: { [txid: string]: string[] } = {};
  private txs: { [txid: string]: TransactionExtended } = {};
  private expiring: { [txid: string]: Date } = {};

  constructor() {
    setInterval(this.cleanup.bind(this), 1000 * 60 * 60);
  }

  public add(replacedTx: TransactionExtended, newTxId: string): void {
    this.replacedBy[replacedTx.txid] = newTxId;
    this.txs[replacedTx.txid] = replacedTx;
    if (!this.replaces[newTxId]) {
      this.replaces[newTxId] = [];
    }
    this.replaces[newTxId].push(replacedTx.txid);
  }

  public getReplacedBy(txId: string): string | undefined {
    return this.replacedBy[txId];
  }

  public getReplaces(txId: string): string[] | undefined {
    return this.replaces[txId];
  }

  public getTx(txId: string): TransactionExtended | undefined {
    return this.txs[txId];
  }

  // flag a transaction as removed from the mempool
  public evict(txid): void {
    this.expiring[txid] = new Date(Date.now() + 1000 * 86400); // 24 hours
  }

  private cleanup(): void {
    const currentDate = new Date();
    for (const txid in this.expiring) {
      if (this.expiring[txid] < currentDate) {
        delete this.expiring[txid];
        this.remove(txid);
      }
    }
  }

  // remove a transaction & all previous versions from the cache
  private remove(txid): void {
    // don't remove a transaction while a newer version remains in the mempool
    if (this.replaces[txid] && !this.replacedBy[txid]) {
      const replaces = this.replaces[txid];
      delete this.replaces[txid];
      for (const tx of replaces) {
        // recursively remove prior versions from the cache
        delete this.replacedBy[tx];
        delete this.txs[tx];
        this.remove(tx);
      }
    }
  }
}

export default new RbfCache();
