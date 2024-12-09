import config from "../config";
import logger from "../logger";
import { MempoolTransactionExtended, TransactionStripped } from "../mempool.interfaces";
import bitcoinApi from './bitcoin/bitcoin-api-factory';
import { IEsploraApi } from "./bitcoin/esplora-api.interface";
import { Common } from "./common";
import redisCache from "./redis-cache";

export interface RbfTransaction extends TransactionStripped {
  rbf?: boolean;
  mined?: boolean;
  fullRbf?: boolean;
}

export interface RbfTree {
  tx: RbfTransaction;
  time: number;
  interval?: number;
  mined?: boolean;
  fullRbf: boolean;
  replaces: RbfTree[];
}

export interface ReplacementInfo {
  mined: boolean;
  fullRbf: boolean;
  txid: string;
  oldFee: number;
  oldVsize: number;
  newFee: number;
  newVsize: number;
}

enum CacheOp {
  Remove = 0,
  Add = 1,
  Change = 2,
}

interface CacheEvent {
  op: CacheOp;
  type: 'tx' | 'tree' | 'exp';
  txid: string,
  value?: any,
}

/**
 * Singleton for tracking RBF trees
 *
 * Maintains a set of RBF trees, where each tree represents a sequence of
 * consecutive RBF replacements.
 *
 * Trees are identified by the txid of the root transaction.
 *
 * To maintain consistency, the following invariants must be upheld:
 *  - Symmetry: replacedBy(A) = B <=> A in replaces(B)
 *  - Unique id: treeMap(treeMap(X)) = treeMap(X)
 *  - Unique tree: A in replaces(B) => treeMap(A) == treeMap(B)
 *  - Existence: X in treeMap => treeMap(X) in rbfTrees
 *  - Completeness: X in replacedBy => X in treeMap, Y in replaces => Y in treeMap
 */

class RbfCache {
  private replacedBy: Map<string, string> = new Map();
  private replaces: Map<string, string[]> = new Map();
  private rbfTrees: Map<string, RbfTree> = new Map(); // sequences of consecutive replacements
  private dirtyTrees: Set<string> = new Set();
  private treeMap: Map<string, string> = new Map(); // map of txids to sequence ids
  private txs: Map<string, MempoolTransactionExtended> = new Map();
  private expiring: Map<string, number> = new Map();
  private cacheQueue: CacheEvent[] = [];

  private evictionCount = 0;
  private staleCount = 0;

  constructor() {
    setInterval(this.cleanup.bind(this), 1000 * 60 * 10);
  }

  /**
   * Low level cache operations
   */

  private addTx(txid: string, tx: MempoolTransactionExtended): void {
    this.txs.set(txid, tx);
    this.cacheQueue.push({ op: CacheOp.Add, type: 'tx', txid });
  }

  private addTree(txid: string, tree: RbfTree): void {
    this.rbfTrees.set(txid, tree);
    this.dirtyTrees.add(txid);
    this.cacheQueue.push({ op: CacheOp.Add, type: 'tree', txid });
  }

  private addExpiration(txid: string, expiry: number): void {
    this.expiring.set(txid, expiry);
    this.cacheQueue.push({ op: CacheOp.Add, type: 'exp', txid, value: expiry });
  }

  private removeTx(txid: string): void {
    this.txs.delete(txid);
    this.cacheQueue.push({ op: CacheOp.Remove, type: 'tx', txid });
  }

  private removeTree(txid: string): void {
    this.rbfTrees.delete(txid);
    this.cacheQueue.push({ op: CacheOp.Remove, type: 'tree', txid });
  }

  private removeExpiration(txid: string): void {
    this.expiring.delete(txid);
    this.cacheQueue.push({ op: CacheOp.Remove, type: 'exp', txid });
  }

  /**
   * Basic data structure operations
   * must uphold tree invariants
   */


  public add(replaced: MempoolTransactionExtended[], newTxExtended: MempoolTransactionExtended): void {
    if (!newTxExtended || !replaced?.length || this.txs.has(newTxExtended.txid)) {
      return;
    }

    newTxExtended.replacement = true;

    const newTx = Common.stripTransaction(newTxExtended) as RbfTransaction;
    const newTime = newTxExtended.firstSeen || (Date.now() / 1000);
    newTx.rbf = newTxExtended.vin.some((v) => v.sequence < 0xfffffffe);
    this.addTx(newTx.txid, newTxExtended);

    // maintain rbf trees
    let txFullRbf = false;
    let treeFullRbf = false;
    const replacedTrees: RbfTree[] = [];
    for (const replacedTxExtended of replaced) {
      const replacedTx = Common.stripTransaction(replacedTxExtended) as RbfTransaction;
      replacedTx.rbf = replacedTxExtended.vin.some((v) => v.sequence < 0xfffffffe);
      if (!replacedTx.rbf) {
        txFullRbf = true;
      }
      if (this.replacedBy.has(replacedTx.txid)) {
        // should never happen
        continue;
      }
      this.replacedBy.set(replacedTx.txid, newTx.txid);
      if (this.treeMap.has(replacedTx.txid)) {
        const treeId = this.treeMap.get(replacedTx.txid);
        if (treeId) {
          const tree = this.rbfTrees.get(treeId);
          this.removeTree(treeId);
          if (tree) {
            tree.interval = newTime - tree?.time;
            replacedTrees.push(tree);
            treeFullRbf = treeFullRbf || tree.fullRbf || !tree.tx.rbf;
          }
        }
      } else {
        const replacedTime = replacedTxExtended.firstSeen || (Date.now() / 1000);
        replacedTrees.push({
          tx: replacedTx,
          time: replacedTime,
          interval: newTime - replacedTime,
          fullRbf: !replacedTx.rbf,
          replaces: [],
        });
        treeFullRbf = treeFullRbf || !replacedTx.rbf;
        this.addTx(replacedTx.txid, replacedTxExtended);
      }
    }
    newTx.fullRbf = txFullRbf;
    const newTree = {
      tx: newTx,
      time: newTime,
      fullRbf: treeFullRbf,
      replaces: replacedTrees
    };
    this.addTree(newTree.tx.txid, newTree);
    this.updateTreeMap(newTree.tx.txid, newTree);
    this.replaces.set(newTx.txid, replacedTrees.map(tree => tree.tx.txid));
  }

  public mined(txid): void {
    if (!this.txs.has(txid)) {
      return;
    }
    const treeId = this.treeMap.get(txid);
    if (treeId && this.rbfTrees.has(treeId)) {
      const tree = this.rbfTrees.get(treeId);
      if (tree) {
        this.setTreeMined(tree, txid);
        tree.mined = true;
        this.dirtyTrees.add(treeId);
        this.cacheQueue.push({ op: CacheOp.Change, type: 'tree', txid: treeId });
      }
    }
    this.evict(txid);
  }

  // flag a transaction as removed from the mempool
  public evict(txid: string, fast: boolean = false): void {
    this.evictionCount++;
    if (this.txs.has(txid) && (fast || !this.expiring.has(txid))) {
      const expiryTime = fast ? Date.now() + (1000 * 60 * 10) : Date.now() + (1000 * 86400); // 24 hours
      this.addExpiration(txid, expiryTime);
    }
  }

  /**
   * Read-only public interface
   */

  public has(txId: string): boolean {
    return this.txs.has(txId);
  }

  public anyInSameTree(txId: string, predicate: (tx: RbfTransaction) => boolean): boolean {
    const tree = this.getRbfTree(txId);
    if (!tree) {
      return false;
    }
    const txs = this.getTransactionsInTree(tree);
    for (const tx of txs) {
      if (predicate(tx)) {
        return true;
      }
    }
    return false;
  }

  public getReplacedBy(txId: string): string | undefined {
    return this.replacedBy.get(txId);
  }

  public getReplaces(txId: string): string[] | undefined {
    return this.replaces.get(txId);
  }

  public getTx(txId: string): MempoolTransactionExtended | undefined {
    return this.txs.get(txId);
  }

  public getRbfTree(txId: string): RbfTree | void {
    return this.rbfTrees.get(this.treeMap.get(txId) || '');
  }

  // get a paginated list of RbfTrees
  // ordered by most recent replacement time
  public getRbfTrees(onlyFullRbf: boolean, after?: string): RbfTree[] {
    const limit = 25;
    const trees: RbfTree[] = [];
    const used = new Set<string>();
    const replacements: string[][] = Array.from(this.replacedBy).reverse();
    const afterTree = after ? this.treeMap.get(after) : null;
    let ready = !afterTree;
    for (let i = 0; i < replacements.length && trees.length <= limit - 1; i++) {
      const txid = replacements[i][1];
      const treeId = this.treeMap.get(txid) || '';
      if (treeId === afterTree) {
        ready = true;
      } else if (ready) {
        if (!used.has(treeId)) {
          const tree = this.rbfTrees.get(treeId);
          used.add(treeId);
          if (tree && (!onlyFullRbf || tree.fullRbf)) {
            trees.push(tree);
          }
        }
      }
    }
    return trees;
  }

  // get map of rbf trees that have been updated since the last call
  public getRbfChanges(): { trees: {[id: string]: RbfTree }, map: { [txid: string]: string }} {
    const changes: { trees: {[id: string]: RbfTree }, map: { [txid: string]: string }} = {
      trees: {},
      map: {},
    };
    this.dirtyTrees.forEach(id => {
      const tree = this.rbfTrees.get(id);
      if (tree) {
        changes.trees[id] = tree;
        this.getTransactionsInTree(tree).forEach(tx => {
          changes.map[tx.txid] = id;
        });
      }
    });
    this.dirtyTrees = new Set();
    return changes;
  }

  // is the transaction involved in a full rbf replacement?
  public isFullRbf(txid: string): boolean {
    const treeId = this.treeMap.get(txid);
    if (!treeId) {
      return false;
    }
    const tree = this.rbfTrees.get(treeId);
    if (!tree) {
      return false;
    }
    return tree?.fullRbf;
  }

  /**
   * Cache maintenance & utility functions
   */

  private cleanup(): void {
    const now = Date.now();
    for (const txid of this.expiring.keys()) {
      if ((this.expiring.get(txid) || 0) < now) {
        this.removeExpiration(txid);
        this.remove(txid);
      }
    }
    logger.debug(`rbf cache contains ${this.txs.size} txs, ${this.rbfTrees.size} trees, ${this.expiring.size} due to expire (${this.evictionCount} newly expired)`);
    this.evictionCount = 0;
  }

  // remove a transaction & all previous versions from the cache
  private remove(txid): void {
    // don't remove a transaction if a newer version remains in the mempool
    if (!this.replacedBy.has(txid)) {
      const root = this.treeMap.get(txid);
      const replaces = this.replaces.get(txid);
      this.replaces.delete(txid);
      this.treeMap.delete(txid);
      this.removeTx(txid);
      this.removeExpiration(txid);
      if (root === txid) {
        this.removeTree(txid);
      }
      for (const tx of (replaces || [])) {
        // recursively remove prior versions from the cache
        this.replacedBy.delete(tx);
        this.remove(tx);
      }
    }
  }

  private updateTreeMap(newId: string, tree: RbfTree): void {
    this.treeMap.set(tree.tx.txid, newId);
    tree.replaces.forEach(subtree => {
      this.updateTreeMap(newId, subtree);
    });
  }

  private getTransactionsInTree(tree: RbfTree, txs: RbfTransaction[] = []): RbfTransaction[] {
    txs.push(tree.tx);
    tree.replaces.forEach(subtree => {
      this.getTransactionsInTree(subtree, txs);
    });
    return txs;
  }

  private setTreeMined(tree: RbfTree, txid: string): void {
    if (tree.tx.txid === txid) {
      tree.tx.mined = true;
    } else {
      tree.replaces.forEach(subtree => {
        this.setTreeMined(subtree, txid);
      });
    }
  }

  public async updateCache(): Promise<void> {
    if (!config.REDIS.ENABLED) {
      return;
    }
    // Update the Redis cache by replaying queued events
    for (const e of this.cacheQueue) {
      if (e.op === CacheOp.Add || e.op === CacheOp.Change) {
        let value = e.value;
          switch(e.type) {
            case 'tx': {
              value = this.txs.get(e.txid);
            } break;
            case 'tree': {
              const tree = this.rbfTrees.get(e.txid);
              value = tree ? this.exportTree(tree) : null;
            } break;
          }
          if (value != null) {
            await redisCache.$setRbfEntry(e.type, e.txid, value);
          }
      } else if (e.op === CacheOp.Remove) {
        await redisCache.$removeRbfEntry(e.type, e.txid);
      }
    }
    this.cacheQueue = [];
  }

  public dump(): any {
    const trees = Array.from(this.rbfTrees.values()).map((tree: RbfTree) => { return this.exportTree(tree); });

    return {
      txs: Array.from(this.txs.entries()),
      trees,
      expiring: Array.from(this.expiring.entries()),
    };
  }

  public async load({ txs, trees, expiring, mempool, spendMap }): Promise<void> {
    try {
      txs.forEach(txEntry => {
        this.txs.set(txEntry.value.txid, txEntry.value);
      });
      this.staleCount = 0;
      for (const deflatedTree of trees.sort((a, b) => Object.keys(b).length - Object.keys(a).length)) {
        const tree = await this.importTree(mempool, deflatedTree.root, deflatedTree.root, deflatedTree, this.txs);
        if (tree) {
          this.addTree(tree.tx.txid, tree);
          this.updateTreeMap(tree.tx.txid, tree);
          if (tree.mined) {
            this.evict(tree.tx.txid);
          }
        }
      }
      expiring.forEach(expiringEntry => {
        if (this.txs.has(expiringEntry.key)) {
          this.expiring.set(expiringEntry.key, new Date(expiringEntry.value).getTime());
        }
      });
      this.staleCount = 0;

      // connect cached trees to current mempool transactions
      const conflicts: Record<string, { replacedBy: MempoolTransactionExtended, replaces: Set<MempoolTransactionExtended> }> = {};
      for (const tree of this.rbfTrees.values()) {
        const tx = this.getTx(tree.tx.txid);
        if (!tx || tree.mined) {
          continue;
        }
        for (const vin of tx.vin) {
          const conflict = spendMap.get(`${vin.txid}:${vin.vout}`);
          if (conflict && conflict.txid !== tx.txid) {
            if (!conflicts[conflict.txid]) {
              conflicts[conflict.txid] = {
                replacedBy: conflict,
                replaces: new Set(),
              };
            }
            conflicts[conflict.txid].replaces.add(tx);
          }
        }
      }
      for (const { replacedBy, replaces } of Object.values(conflicts)) {
        this.add([...replaces.values()], replacedBy);
      }

      await this.checkTrees();
      logger.debug(`loaded ${txs.length} txs, ${trees.length} trees into rbf cache, ${expiring.length} due to expire, ${this.staleCount} were stale`);
      this.cleanup();

    } catch (e) {
      logger.err('failed to restore RBF cache: ' + (e instanceof Error ? e.message : e));
    }
  }

  exportTree(tree: RbfTree, deflated: any = null) {
    if (!deflated) {
      deflated = {
        root: tree.tx.txid,
      };
    }
    deflated[tree.tx.txid] = {
      tx: tree.tx.txid,
      txMined: tree.tx.mined,
      time: tree.time,
      interval: tree.interval,
      mined: tree.mined,
      fullRbf: tree.fullRbf,
      replaces: tree.replaces.map(child => child.tx.txid),
    };
    tree.replaces.forEach(child => {
      this.exportTree(child, deflated);
    });
    return deflated;
  }

  async importTree(mempool, root, txid, deflated, txs: Map<string, MempoolTransactionExtended>, mined: boolean = false): Promise<RbfTree | void> {
    const treeInfo = deflated[txid];
    const replaces: RbfTree[] = [];

    // if the root tx is unknown, remove this tree and return early
    if (root === txid && !txs.has(txid)) {
      this.staleCount++;
      this.removeTree(deflated.key);
      return;
    }

    // if this tx is already in the cache, return early
    if (this.treeMap.has(txid)) {
      this.removeTree(deflated.key);
      return;
    }

    // recursively reconstruct child trees
    for (const childId of treeInfo.replaces) {
      const replaced = await this.importTree(mempool, root, childId, deflated, txs, mined);
      if (replaced) {
        this.replacedBy.set(replaced.tx.txid, txid);
        if (mempool[replaced.tx.txid]) {
          mempool[replaced.tx.txid].replacement = true;
        }
        replaces.push(replaced);
        if (replaced.mined) {
          mined = true;
        }
      }
    }
    this.replaces.set(txid, replaces.map(t => t.tx.txid));

    const tx = txs.get(txid);
    if (!tx) {
      return;
    }
    const strippedTx = Common.stripTransaction(tx) as RbfTransaction;
    strippedTx.rbf = tx.vin.some((v) => v.sequence < 0xfffffffe);
    strippedTx.mined = treeInfo.txMined;
    const tree = {
      tx: strippedTx,
      time: treeInfo.time,
      interval: treeInfo.interval,
      mined: mined,
      fullRbf: treeInfo.fullRbf,
      replaces,
    };
    return tree;
  }

  private async checkTrees(): Promise<void> {
    const found: { [txid: string]: boolean } = {};
    const txids = Array.from(this.txs.values()).map(tx => tx.txid).filter(txid => {
      return !this.expiring.has(txid) && !this.getRbfTree(txid)?.mined;
    });

    const processTxs = (txs: IEsploraApi.Transaction[]): void => {
      for (const tx of txs) {
        found[tx.txid] = true;
        if (tx.status?.confirmed) {
          const tree = this.getRbfTree(tx.txid);
          if (tree) {
            this.setTreeMined(tree, tx.txid);
            tree.mined = true;
            this.evict(tx.txid, false);
          }
        }
      }
    };

    if (config.MEMPOOL.BACKEND === 'esplora') {
      let processedCount = 0;
      const sliceLength = Math.ceil(config.ESPLORA.BATCH_QUERY_BASE_SIZE / 40);
      for (let i = 0; i < Math.ceil(txids.length / sliceLength); i++) {
        const slice = txids.slice(i * sliceLength, (i + 1) * sliceLength);
        processedCount += slice.length;
        try {
          const txs = await bitcoinApi.$getRawTransactions(slice);
          processTxs(txs);
          logger.debug(`fetched and processed ${processedCount} of ${txids.length} cached rbf transactions (${(processedCount / txids.length * 100).toFixed(2)}%)`);
        } catch (err) {
          logger.err(`failed to fetch or process ${slice.length} cached rbf transactions`);
        }
      }
    } else {
      const txs: IEsploraApi.Transaction[] = [];
      for (const txid of txids) {
        try {
          const tx = await bitcoinApi.$getRawTransaction(txid, true, false);
          txs.push(tx);
        } catch (err) {
          // some 404s are expected, so continue quietly
        }
      }
      processTxs(txs);
    }

    // evict missing transactions
    for (const txid of txids) {
      if (!found[txid]) {
        this.evict(txid, false);
      }
    }
  }

  public getLatestRbfSummary(): ReplacementInfo[] {
    const rbfList = this.getRbfTrees(false);
    return rbfList.slice(0, 6).map(rbfTree => {
      let oldFee = 0;
      let oldVsize = 0;
      for (const replaced of rbfTree.replaces) {
        oldFee += replaced.tx.fee;
        oldVsize += replaced.tx.vsize;
      }
      return {
        txid: rbfTree.tx.txid,
        mined: !!rbfTree.tx.mined,
        fullRbf: !!rbfTree.tx.fullRbf,
        oldFee,
        oldVsize,
        newFee: rbfTree.tx.fee,
        newVsize: rbfTree.tx.vsize,
      };
    });
  }
}

export default new RbfCache();
