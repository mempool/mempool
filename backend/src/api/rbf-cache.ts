export interface CachedRbf {
  txid: string;
  expires: Date;
}

class RbfCache {
  private cache: { [txid: string]: CachedRbf; } = {};

  constructor() {
    setInterval(this.cleanup.bind(this), 1000 * 60 * 60);
  }

  public add(replacedTxId: string, newTxId: string): void {
    this.cache[replacedTxId] = {
      expires: new Date(Date.now() + 1000 * 604800), // 1 week
      txid: newTxId,
    };
  }

  public get(txId: string): CachedRbf | undefined {
    return this.cache[txId];
  }

  private cleanup(): void {
    const currentDate = new Date();
    for (const c in this.cache) {
      if (this.cache[c].expires < currentDate) {
        delete this.cache[c];
      }
    }
  }
}

export default new RbfCache();
