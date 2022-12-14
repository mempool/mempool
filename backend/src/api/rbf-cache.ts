import { TransactionExtended, TransactionStripped } from "../mempool.interfaces";
import { Common } from "./common";

interface RbfTransaction extends TransactionStripped {
  rbf?: boolean;
}

type RbfChain = {
  tx: RbfTransaction,
  time: number,
  mined?: boolean,
}[];

class RbfCache {
  private replacedBy: Map<string, string> = new Map();
  private replaces: Map<string, string[]> = new Map();
  private rbfChains: Map<string, RbfChain> = new Map(); // sequences of consecutive replacements
  private dirtyChains: Set<string> = new Set();
  private chainMap: Map<string, string> = new Map(); // map of txids to sequence ids
  private txs: Map<string, TransactionExtended> = new Map();
  private expiring: Map<string, Date> = new Map();

  constructor() {
    setInterval(this.cleanup.bind(this), 1000 * 60 * 60);
  }

  public add(replacedTxExtended: TransactionExtended, newTxExtended: TransactionExtended): void {
    const replacedTx = Common.stripTransaction(replacedTxExtended) as RbfTransaction;
    replacedTx.rbf = replacedTxExtended.vin.some((v) => v.sequence < 0xfffffffe);
    const newTx = Common.stripTransaction(newTxExtended) as RbfTransaction;
    newTx.rbf = newTxExtended.vin.some((v) => v.sequence < 0xfffffffe);

    this.replacedBy.set(replacedTx.txid, newTx.txid);
    this.txs.set(replacedTx.txid, replacedTxExtended);
    this.txs.set(newTx.txid, newTxExtended);
    if (!this.replaces.has(newTx.txid)) {
      this.replaces.set(newTx.txid, []);
    }
    this.replaces.get(newTx.txid)?.push(replacedTx.txid);

    // maintain rbf chains
    if (this.chainMap.has(replacedTx.txid)) {
      // add to an existing chain
      const chainRoot = this.chainMap.get(replacedTx.txid) || '';
      this.rbfChains.get(chainRoot)?.push({ tx: newTx, time: newTxExtended.firstSeen || Date.now() });
      this.chainMap.set(newTx.txid, chainRoot);
      this.dirtyChains.add(chainRoot);
    } else {
      // start a new chain
      this.rbfChains.set(replacedTx.txid, [
        { tx: replacedTx, time: replacedTxExtended.firstSeen || Date.now() },
        { tx: newTx, time: newTxExtended.firstSeen || Date.now() },
      ]);
      this.chainMap.set(replacedTx.txid, replacedTx.txid);
      this.chainMap.set(newTx.txid, replacedTx.txid);
      this.dirtyChains.add(replacedTx.txid);
    }
  }

  public getReplacedBy(txId: string): string | undefined {
    return this.replacedBy.get(txId);
  }

  public getReplaces(txId: string): string[] | undefined {
    return this.replaces.get(txId);
  }

  public getTx(txId: string): TransactionExtended | undefined {
    return this.txs.get(txId);
  }

  public getRbfChain(txId: string): RbfChain {
    return this.rbfChains.get(this.chainMap.get(txId) || '') || [];
  }

  // get a paginated list of RbfChains
  // ordered by most recent replacement time
  public getRbfChains(onlyFullRbf: boolean, after?: string): RbfChain[] {
    const limit = 25;
    const chains: RbfChain[] = [];
    const used = new Set<string>();
    const replacements: string[][] = Array.from(this.replacedBy).reverse();
    const afterChain = after ? this.chainMap.get(after) : null;
    let ready = !afterChain;
    for (let i = 0; i < replacements.length && chains.length <= limit - 1; i++) {
      const txid = replacements[i][1];
      const chainRoot = this.chainMap.get(txid) || '';
      if (chainRoot === afterChain) {
        ready = true;
      } else if (ready) {
        if (!used.has(chainRoot)) {
          const chain = this.rbfChains.get(chainRoot);
          used.add(chainRoot);
          if (chain && (!onlyFullRbf || chain.slice(0, -1).some(entry => !entry.tx.rbf))) {
            chains.push(chain);
          }
        }
      }
    }
    return chains;
  }

  // get map of rbf chains that have been updated since the last call
  public getRbfChanges(): { chains: {[root: string]: RbfChain }, map: { [txid: string]: string }} {
    const changes: { chains: {[root: string]: RbfChain }, map: { [txid: string]: string }} = {
      chains: {},
      map: {},
    };
    this.dirtyChains.forEach(root => {
      const chain = this.rbfChains.get(root);
      if (chain) {
        changes.chains[root] = chain;
        chain.forEach(entry => {
          changes.map[entry.tx.txid] = root;
        });
      }
    });
    this.dirtyChains = new Set();
    return changes;
  }

  public mined(txid): void {
    const chainRoot = this.chainMap.get(txid)
    if (chainRoot && this.rbfChains.has(chainRoot)) {
      const chain = this.rbfChains.get(chainRoot);
      if (chain) {
        const chainEntry = chain.find(entry => entry.tx.txid === txid);
        if (chainEntry) {
          chainEntry.mined = true;
        }
        this.dirtyChains.add(chainRoot);
      }
    }
    this.evict(txid);
  }

  // flag a transaction as removed from the mempool
  public evict(txid): void {
    this.expiring.set(txid, new Date(Date.now() + 1000 * 86400)); // 24 hours
  }

  private cleanup(): void {
    const currentDate = new Date();
    for (const txid in this.expiring) {
      if ((this.expiring.get(txid) || 0) < currentDate) {
        this.expiring.delete(txid);
        this.remove(txid);
      }
    }
  }

  // remove a transaction & all previous versions from the cache
  private remove(txid): void {
    // don't remove a transaction if a newer version remains in the mempool
    if (!this.replacedBy.has(txid)) {
      const replaces = this.replaces.get(txid);
      this.replaces.delete(txid);
      this.chainMap.delete(txid);
      this.txs.delete(txid);
      this.expiring.delete(txid);
      for (const tx of (replaces || [])) {
        // recursively remove prior versions from the cache
        this.replacedBy.delete(tx);
        // if this is the root of a chain, remove that too
        if (this.chainMap.get(tx) === tx) {
          this.rbfChains.delete(tx);
        }
        this.remove(tx);
      }
    }
  }
}

export default new RbfCache();
