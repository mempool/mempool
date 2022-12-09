import { TransactionExtended } from "../mempool.interfaces";

export interface CachedRbf {
  txid: string;
  expires: Date;
}

export interface CachedRbfs {
  txids: string[];
  expires: Date;
}

class RbfCache {
  private replacedby: { [txid: string]: CachedRbf; } = {};
  private replaces: { [txid: string]: CachedRbfs } = {};
  private txs: { [txid: string]: TransactionExtended } = {};

  constructor() {
    setInterval(this.cleanup.bind(this), 1000 * 60 * 60);
  }

  public add(replacedTx: TransactionExtended, newTxId: string): void {
    const expiry = new Date(Date.now() + 1000 * 604800); // 1 week
    this.replacedby[replacedTx.txid] = {
      expires: expiry,
      txid: newTxId,
    };
    this.txs[replacedTx.txid] = replacedTx;
    if (!this.replaces[newTxId]) {
      this.replaces[newTxId] = {
        txids: [],
        expires: expiry,
      };
    }
    this.replaces[newTxId].txids.push(replacedTx.txid);
    this.replaces[newTxId].expires = expiry;
  }

  public getReplacedBy(txId: string): CachedRbf | undefined {
    return this.replacedby[txId];
  }

  public getReplaces(txId: string): CachedRbfs | undefined {
    return this.replaces[txId];
  }

  public getTx(txId: string): TransactionExtended | undefined {
    return this.txs[txId];
  }

  private cleanup(): void {
    const currentDate = new Date();
    for (const c in this.replacedby) {
      if (this.replacedby[c].expires < currentDate) {
        delete this.replacedby[c];
        delete this.txs[c];
      }
    }
    for (const c in this.replaces) {
      if (this.replaces[c].expires < currentDate) {
        delete this.replaces[c];
      }
    }
  }
}

export default new RbfCache();
