import config from '../config';
import logger from '../logger';
import { BlockExtended } from '../mempool.interfaces';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
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

export interface StaleTip extends ChainTip {
  stale: BlockExtended;
  canonical: BlockExtended;
}

export interface OrphanedBlock {
  height: number;
  hash: string;
  status: 'valid-fork' | 'valid-headers' | 'headers-only';
  prevhash: string;
}

class ChainTips {
  private chainTips: ChainTip[] = [];
  private staleTips: Record<number, StaleTip> = {};
  private orphanedBlocks: { [hash: string]: OrphanedBlock } = {};
  private blockCache: { [hash: string]: OrphanedBlock } = {};
  private orphansByHeight: { [height: number]: OrphanedBlock[] } = {};
  private indexingOrphanedBlocks = false;
  private indexingQueue: { blockhash?: string, block?: IEsploraApi.Block, tip: OrphanedBlock }[] = [];

  private staleTipsCacheSize = 50;
  private maxIndexingQueueSize = 100;

  public async updateOrphanedBlocks(): Promise<void> {
    try {
      this.chainTips = await bitcoinClient.getChainTips();

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

      const heightsToKeep = new Set(this.chainTips.filter(tip => tip.status !== 'active').map(tip => tip.height));
      const heightsToRemove: number[] = Object.keys(this.staleTips).map(Number).filter(height => !heightsToKeep.has(height));
      for (const height of heightsToRemove) {
        delete this.staleTips[height];
      }

      this.trimStaleTipsCache();

      // index new orphaned blocks in the background
      void this.$indexOrphanedBlocks();

      logger.debug(`Updated orphaned blocks cache. Fetched ${newOrphans} new orphaned blocks. Total ${allOrphans.length}`);
    } catch (e) {
      logger.err(`Cannot get fetch orphaned blocks. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

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
      if (blockhash && !block) {
        block = await bitcoinCoreApi.$getBlock(blockhash);
      }
      if (!block) {
        continue;
      }
      try {
        let staleBlock: BlockExtended | undefined;
        const alreadyIndexed = await BlocksSummariesRepository.$isSummaryIndexed(block.id);
        const needToCache = Object.keys(this.staleTips).length < this.staleTipsCacheSize || block.height > Object.keys(this.staleTips).map(Number).sort((a, b) => b - a)[this.staleTipsCacheSize - 1];
        if (!alreadyIndexed) {
          staleBlock = await blocks.$indexBlock(block.id, block, true);
          await blocks.$indexBlockSummary(block.id, block.height, true);
          // don't DDOS core by indexing too fast
          await Common.sleep$(5000);
        } else if (needToCache) {
          staleBlock = await blocks.$getBlock(block.id, true) as BlockExtended;
        }

        if (staleBlock && needToCache) {
          const canonicalBlock = await blocks.$indexBlockByHeight(staleBlock.height);
          this.staleTips[staleBlock.height] = {
            height: staleBlock.height,
            hash: staleBlock.id,
            branchlen: tip.height - staleBlock.height,
            status: tip.status,
            stale: staleBlock,
            canonical: canonicalBlock,
          };
          this.trimStaleTipsCache();
        }
      } catch (e) {
        logger.err(`Failed to index orphaned block ${block.id} at height ${block.height}. Reason: ${e instanceof Error ? e.message : e}`);
      }
    }
    this.indexingOrphanedBlocks = false;
  }

  private trimStaleTipsCache(): void {
    const staleTipHeights = Object.keys(this.staleTips).map(Number).sort((a, b) => b - a);
    if (staleTipHeights.length > this.staleTipsCacheSize) {
      const heightsToDiscard = staleTipHeights.slice(this.staleTipsCacheSize);
      for (const height of heightsToDiscard) {
        delete this.staleTips[height];
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

  public getStaleTips(): StaleTip[] {
    return Object.values(this.staleTips).sort((a, b) => b.height - a.height);
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

export default new ChainTips();