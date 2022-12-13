import { TransactionExtended, TransactionStripped } from "../mempool.interfaces";
import { Common } from "./common";

interface RbfTransaction extends TransactionStripped {
  rbf?: boolean;
}

class RbfCache {
  private replacedBy: { [txid: string]: string; } = {};
  private replaces: { [txid: string]: string[] } = {};
  private rbfChains: { [root: string]: { tx: TransactionStripped, time: number, mined?: boolean }[] } = {}; // sequences of consecutive replacements
  private chainMap: { [txid: string]: string } = {}; // map of txids to sequence ids
  private txs: { [txid: string]: TransactionExtended } = {};
  private expiring: { [txid: string]: Date } = {};

  constructor() {
    setInterval(this.cleanup.bind(this), 1000 * 60 * 60);
  }

  public add(replacedTxExtended: TransactionExtended, newTxExtended: TransactionExtended): void {
    const replacedTx = Common.stripTransaction(replacedTxExtended) as RbfTransaction;
    replacedTx.rbf = replacedTxExtended.vin.some((v) => v.sequence < 0xfffffffe);
    const newTx = Common.stripTransaction(newTxExtended) as RbfTransaction;
    newTx.rbf = newTxExtended.vin.some((v) => v.sequence < 0xfffffffe);

    this.replacedBy[replacedTx.txid] = newTx.txid;
    this.txs[replacedTx.txid] = replacedTxExtended;
    if (!this.replaces[newTx.txid]) {
      this.replaces[newTx.txid] = [];
    }
    this.replaces[newTx.txid].push(replacedTx.txid);

    // maintain rbf chains
    if (this.chainMap[replacedTx.txid]) {
      // add to an existing chain
      const chainRoot = this.chainMap[replacedTx.txid];
      this.rbfChains[chainRoot].push({ tx: newTx, time: newTxExtended.firstSeen || Date.now() });
      this.chainMap[newTx.txid] = chainRoot;
    } else {
      // start a new chain
      this.rbfChains[replacedTx.txid] = [
        { tx: replacedTx, time: replacedTxExtended.firstSeen || Date.now() },
        { tx: newTx, time: newTxExtended.firstSeen || Date.now() },
      ];
      this.chainMap[replacedTx.txid] = replacedTx.txid;
      this.chainMap[newTx.txid] = replacedTx.txid;
    }
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

  public getRbfChain(txId: string): { tx: TransactionStripped, time: number }[] {
    return this.rbfChains[this.chainMap[txId]] || [];
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
    // don't remove a transaction if a newer version remains in the mempool
    if (!this.replacedBy[txid]) {
      const replaces = this.replaces[txid];
      delete this.replaces[txid];
      delete this.chainMap[txid];
      delete this.txs[txid];
      delete this.expiring[txid];
      for (const tx of replaces) {
        // recursively remove prior versions from the cache
        delete this.replacedBy[tx];
        // if this is the root of a chain, remove that too
        if (this.chainMap[tx] === tx) {
          delete this.rbfChains[tx];
        }
        this.remove(tx);
      }
    }
  }
}

export default new RbfCache();
