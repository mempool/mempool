import config from '../config';
import logger from '../logger';
import { BlockExtended, StaleTipBlock } from '../mempool.interfaces';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import BlocksRepository from '../repositories/BlocksRepository';
import bitcoinApi, { bitcoinCoreApi } from './bitcoin/bitcoin-api-factory';
import bitcoinClient from './bitcoin/bitcoin-client';
import { IEsploraApi } from './bitcoin/esplora-api.interface';
import blocks from './blocks';
import { Common } from './common';

export interface ChainTip {
  height: number;
  hash: string;
  branchlen: number;
  status: 'invalid' | 'active' | 'valid-fork' | 'valid-headers' | 'headers-only';
};

export interface TxOverlap {
  shared: number;
  staleOnly: number;
  canonicalOnly: number;
}

export interface StaleTip extends ChainTip {
  stale: StaleTipBlock;
  canonical: StaleTipBlock;
  resolvedBy?: StaleTipBlock;
  txOverlap?: TxOverlap;
}

export interface OrphanedBlock {
  height: number;
  hash: string;
  branchlen: number;
  status: 'valid-fork' | 'valid-headers' | 'headers-only';
  prevhash: string;
}

class ChainTips {
  private chainTips: ChainTip[] = [];
  private validChainTips: ChainTip[] = []; // 'valid-fork' and 'valid-headers' only, in descending height order
  private staleBlocks: Record<string, BlockExtended> = {};
  private txOverlaps = new Map<string, TxOverlap>();
  private txOverlapRequests = new Map<string, Promise<TxOverlap | undefined>>();
  private orphanedBlocks: { [hash: string]: OrphanedBlock } = {};
  private blockCache: { [hash: string]: OrphanedBlock } = {};
  private orphansByHeight: { [height: number]: OrphanedBlock[] } = {};
  private indexingOrphanedBlocks = false;
  private indexingQueue: { blockhash?: string, block?: IEsploraApi.Block, tip: OrphanedBlock }[] = [];

  private staleBlocksCacheSize = 50;
  private txOverlapsCacheSize = 200;
  private maxIndexingQueueSize = 100;

  /** @asyncSafe */
  public async updateOrphanedBlocks(): Promise<void> {
    try {
      this.chainTips = await bitcoinClient.getChainTips();
      this.validChainTips = this.chainTips.filter(tip => tip.status === 'valid-fork' || tip.status === 'valid-headers').sort((a, b) => b.height - a.height);

      const activeTipHeight = this.chainTips.find(tip => tip.status === 'active')?.height || (await bitcoinApi.$getBlockHeightTip());
      let minIndexHeight = 0;
      const indexedBlockAmount = Math.min(config.MEMPOOL.INDEXING_BLOCKS_AMOUNT, activeTipHeight);
      if (indexedBlockAmount > 0) {
        minIndexHeight = Math.max(0, activeTipHeight - indexedBlockAmount + 1);
      }

      const start = Date.now();
      const breakAt = start + 10000;
      let newOrphans = 0;
      const newOrphanedBlocks = {};

      for (const chain of this.chainTips) {
        if (chain.status === 'valid-fork' || chain.status === 'valid-headers') {
          const orphans: OrphanedBlock[] = [];
          let hash = chain.hash;
          do {
            let orphan = this.blockCache[hash];
            if (!orphan) {
              const block = await bitcoinCoreApi.$getBlock(hash);
              if (block && block.stale) {
                newOrphans++;
                orphan = {
                  height: block.height,
                  hash: block.id,
                  branchlen: chain.branchlen,
                  status: chain.status,
                  prevhash: block.previousblockhash,
                };
                this.blockCache[hash] = orphan;
                // don't index stale blocks below the INDEXING_BLOCKS_AMOUNT cutoff
                if (block.height >= minIndexHeight) {
                  if (this.indexingQueue.length < this.maxIndexingQueueSize) {
                    this.indexingQueue.push({ block, tip: orphan });
                  } else {
                    // re-fetch blocks lazily if the queue is big to keep memory usage sane
                    this.indexingQueue.push({ blockhash: hash, tip: orphan });
                  }
                }
                // make sure the cached canonical block at this height is correct & up to date
                if (block.height >= (activeTipHeight - (config.MEMPOOL.INITIAL_BLOCKS_AMOUNT * 4))) {
                  const cachedBlocks = blocks.getBlocks();
                  for (const cachedBlock of cachedBlocks) {
                    if (cachedBlock.height === block.height) {
                      // ensure this stale block is included in the orphans list
                      cachedBlock.extras.orphans = Array.from(new Set([...(cachedBlock.extras.orphans || []), orphan]));
                    }
                  }
                }
              }
            }
            if (orphan) {
              orphans.push(orphan);
            }
            hash = orphan?.prevhash;
          } while (hash && (Date.now() < breakAt));
          for (const orphan of orphans) {
            newOrphanedBlocks[orphan.hash] = orphan;
          }
        }
        if (Date.now() >= breakAt) {
          logger.debug(`Breaking orphaned blocks updater after 10s, will continue next block`);
          break;
        }
      }

      this.orphansByHeight = {};
      this.orphanedBlocks = newOrphanedBlocks;
      const allOrphans = Object.values(this.orphanedBlocks);
      for (const orphan of allOrphans) {
        if (!this.orphansByHeight[orphan.height]) {
          this.orphansByHeight[orphan.height] = [];
        }
        this.orphansByHeight[orphan.height].push(orphan);
      }

      this.trimStaleBlocksCache();

      // index new orphaned blocks in the background
      void this.$indexOrphanedBlocks();

      logger.debug(`Updated orphaned blocks cache. Fetched ${newOrphans} new orphaned blocks. Total ${allOrphans.length}`);
    } catch (e) {
      logger.err(`Cannot get fetch orphaned blocks. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  /** @asyncSafe */
  private async $indexOrphanedBlocks(): Promise<void> {
    if (this.indexingOrphanedBlocks) {
      return;
    }
    this.indexingOrphanedBlocks = true;
    while (this.indexingQueue.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, prefer-const
      let { blockhash, block, tip } = this.indexingQueue.shift()!;
      if (!block && !blockhash) {
        continue;
      }
      try {
        if (blockhash && !block) {
          block = await bitcoinCoreApi.$getBlock(blockhash);
        }
        if (!block) {
          continue;
        }
        let staleBlock: BlockExtended | undefined;
        const alreadyIndexed = await BlocksSummariesRepository.$isSummaryIndexed(block.id);
        const needToCache = this.shouldCacheStaleBlock(block.id, block.height);
        if (!alreadyIndexed) {
          staleBlock = await blocks.$indexBlock(block.id, block, true);
          await blocks.$indexBlockSummary(block.id, block.height, true);
          // don't DDOS core by indexing too fast
          await Common.sleep$(5000);
        } else if (needToCache) {
          staleBlock = await blocks.$getBlock(block.id, true) as BlockExtended;
        }

        if (staleBlock && needToCache) {
          // ensure the canonical block is correctly indexed
          await blocks.$indexBlockByHeight(staleBlock.height);
          this.cacheStaleBlock(staleBlock);
          // warm the overlap cache so the stale tips page doesn't compute it on demand
          const canonicalHash = await bitcoinApi.$getBlockHash(staleBlock.height);
          await this.$getTxOverlap(staleBlock.id, canonicalHash);
        }
      } catch (e) {
        logger.err(`Failed to index orphaned block ${block?.id} at height ${block?.height}. Reason: ${e instanceof Error ? e.message : e}`);
      }
    }
    this.indexingOrphanedBlocks = false;
  }

  private shouldCacheStaleBlock(hash: string, height: number): boolean {
    // already cached
    if (this.staleBlocks[hash]) {
      return false;
    }

    // cache is not full
    const cachedBlocks = Object.values(this.staleBlocks);
    if (cachedBlocks.length < this.staleBlocksCacheSize) {
      return true;
    }

    // otherwise cache if this block is newer than the oldest in the cache
    const oldestCachedHeight = cachedBlocks.reduce((min, block) => Math.min(min, block.height), Infinity);
    return height >= oldestCachedHeight;
  }

  private cacheStaleBlock(block: BlockExtended): void {
    this.staleBlocks[block.id] = block;
    this.trimStaleBlocksCache();
  }

  // evict the oldest stale blocks until the cache is within the size limit
  private trimStaleBlocksCache(): void {
    // sort by height
    const cachedBlocks = Object.values(this.staleBlocks).sort((a, b) => {
      if (b.height !== a.height) {
        return b.height - a.height;
      }
      // tie-break by hash
      return a.id.localeCompare(b.id);
    });
    // delete everything beyond the size limit
    if (cachedBlocks.length > this.staleBlocksCacheSize) {
      for (const block of cachedBlocks.slice(this.staleBlocksCacheSize)) {
        delete this.staleBlocks[block.id];
      }
    }
  }

  public getOrphanedBlocksAtHeight(height: number | undefined): OrphanedBlock[] {
    if (height === undefined) {
      return [];
    }

    return this.orphansByHeight[height] || [];
  }

  public getChainTips(): ChainTip[] {
    return this.chainTips;
  }

  /**
   * get paginated stale chain tips
   * @param fromHeight - start height (exclusive)
   * @param count - requested page size (target, but not strictly enforced)
   *
   * @asyncSafe
   */
  public async $getStaleTipsPage(fromHeight: number | undefined, count: number): Promise<StaleTip[]> {
    let index = fromHeight === undefined ? 0 : this.validChainTips.findIndex(tip => tip.height < fromHeight);
    // no tips beyond the requested height, we can return early
    if (index === -1) {
      return [];
    }

    // tips with missing block data are skipped, so keep fetching until the page is full
    const tips: StaleTip[] = [];
    while (tips.length < count && index < this.validChainTips.length) {
      let end = Math.min(index + count - tips.length, this.validChainTips.length);
      // stretch the batch to include any remaining blocks at the last included height to avoid pagination gaps with a height-based cursor
      while (end < this.validChainTips.length && this.validChainTips[end].height === this.validChainTips[end - 1].height) {
        end++;
      }
      tips.push(...await this.$hydrateStaleTips(this.validChainTips.slice(index, end)));
      index = end;
    }

    return tips;
  }

  /** @asyncSafe */
  private async $hydrateStaleTips(staleTips: ChainTip[]): Promise<StaleTip[]> {
    // use the in-memory caches when possible, and fetch everything else in a single query
    const recentBlocks = new Map(blocks.getBlocks().map(block => [block.height, block]));
    const canonicalByHeight = new Map<number, StaleTipBlock>();
    const staleByHash = new Map<string, StaleTipBlock>();
    const missingHeights = new Set<number>();
    const missingHashes = new Set<string>();
    for (const staleTip of staleTips) {
      for (const height of [staleTip.height, staleTip.height + 1]) {
        const recentBlock = recentBlocks.get(height);
        if (recentBlock) {
          canonicalByHeight.set(height, toStaleTipBlock(recentBlock));
        } else {
          missingHeights.add(height);
        }
      }
      const cachedStale = this.staleBlocks[staleTip.hash];
      if (cachedStale) {
        staleByHash.set(staleTip.hash, toStaleTipBlock(cachedStale));
      } else {
        missingHashes.add(staleTip.hash);
      }
    }

    const indexedBlocks = await BlocksRepository.$getStaleTipBlocks([...missingHeights], [...missingHashes]);
    for (const block of indexedBlocks) {
      if (missingHashes.has(block.id)) {
        staleByHash.set(block.id, block);
      } else {
        canonicalByHeight.set(block.height, block);
      }
    }

    const tips: StaleTip[] = [];
    for (const staleTip of staleTips) {
      const stale = staleByHash.get(staleTip.hash);
      const canonical = canonicalByHeight.get(staleTip.height);
      // skip tips with missing block data
      if (!stale || !canonical) {
        continue;
      }
      tips.push({
        ...staleTip,
        stale,
        canonical,
        resolvedBy: canonicalByHeight.get(staleTip.height + 1),
        txOverlap: await this.$getTxOverlap(stale.id, canonical.id),
      });
    }
    return tips;
  }

  /** @asyncSafe */
  private async $getTxOverlap(staleHash: string, canonicalHash: string): Promise<TxOverlap | undefined> {
    const key = `${staleHash}:${canonicalHash}`;
    const cached = this.txOverlaps.get(key);
    if (cached) {
      return cached;
    }

    // share the computation between concurrent requests for the same tips
    let request = this.txOverlapRequests.get(key);
    if (!request) {
      request = this.$computeTxOverlap(staleHash, canonicalHash).finally(() => this.txOverlapRequests.delete(key));
      this.txOverlapRequests.set(key, request);
    }
    return request;
  }

  /** @asyncSafe */
  private async $computeTxOverlap(staleHash: string, canonicalHash: string): Promise<TxOverlap | undefined> {
    let staleTxids: string[];
    let canonicalTxids: string[];
    try {
      // the esplora backend doesn't index stale blocks, so go straight to Core
      staleTxids = await bitcoinCoreApi.$getTxIdsForBlock(staleHash);
      canonicalTxids = await bitcoinApi.$getTxIdsForBlock(canonicalHash);
    } catch (e) {
      logger.warn(`Cannot compare transactions of stale block ${staleHash} and canonical block ${canonicalHash}. Reason: ${e instanceof Error ? e.message : e}`);
      return undefined;
    }

    // skip the coinbase, which always differs between competing blocks
    const staleSet = new Set(staleTxids.slice(1));
    const shared = canonicalTxids.slice(1).filter(txid => staleSet.has(txid)).length;
    const txOverlap: TxOverlap = {
      shared,
      staleOnly: staleSet.size - shared,
      canonicalOnly: canonicalTxids.length - 1 - shared,
    };

    const key = `${staleHash}:${canonicalHash}`;
    this.txOverlaps.set(key, txOverlap);
    if (this.txOverlaps.size > this.txOverlapsCacheSize) {
      const oldestKey = this.txOverlaps.keys().next().value;
      if (oldestKey !== undefined) {
        this.txOverlaps.delete(oldestKey);
      }
    }
    return txOverlap;
  }

  clearOrphanCacheAboveHeight(height: number): void {
    for (const h in this.orphansByHeight) {
      if (Number(h) > height) {
        const orphans = this.orphansByHeight[h];
        delete this.orphansByHeight[h];
        for (const o of orphans) {
          delete this.orphanedBlocks[o.hash];
          delete this.blockCache[o.hash];
        }
      }
    }
  }

  public isOrphaned(hash: string): boolean {
    return !!this.orphanedBlocks[hash] || this.blockCache[hash]?.status === 'valid-fork' || this.blockCache[hash]?.status === 'valid-headers';
  }

  public getOrphanedBlock(hash: string): OrphanedBlock | undefined {
    return this.orphanedBlocks[hash] || this.blockCache[hash];
  }
}

function toStaleTipBlock({ id, height, timestamp, size, weight, tx_count, extras }: BlockExtended): StaleTipBlock {
  return {
    id,
    height,
    timestamp,
    size,
    weight,
    tx_count,
    extras: {
      medianFee: extras.medianFee,
      feeRange: extras.feeRange,
      pool: extras.pool,
      firstSeen: extras.firstSeen,
    },
  };
}

export default new ChainTips();
