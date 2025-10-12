import logger from '../logger';
import { BlockExtended } from '../mempool.interfaces';
import BlocksSummariesRepository from '../repositories/BlocksSummariesRepository';
import { bitcoinCoreApi } from './bitcoin/bitcoin-api-factory';
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
  private indexingQueue: { block: IEsploraApi.Block, tip: OrphanedBlock }[] = [];

  public async updateOrphanedBlocks(): Promise<void> {
    try {
      this.chainTips = await bitcoinClient.getChainTips();

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
                this.indexingQueue.push({ block, tip: orphan });
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
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { block, tip } = this.indexingQueue.shift()!;
      if (!block) {
        continue;
      }
      try {
        let staleBlock: BlockExtended | undefined;
        const alreadyIndexed = await BlocksSummariesRepository.$isSummaryIndexed(block.id);
        if (!alreadyIndexed) {
          staleBlock = await blocks.$indexBlock(block.id, block, true);
          await blocks.$indexBlockSummary(block.id, block.height, true);
          // don't DDOS core by indexing too fast
          await Common.sleep$(5000);
        } else {
          staleBlock = await blocks.$getBlock(block.id) as BlockExtended;
        }
        const canonicalBlock = await blocks.$indexBlockByHeight(staleBlock.height);
        this.staleTips[staleBlock.height] = {
          height: staleBlock.height,
          hash: staleBlock.id,
          branchlen: tip.height - staleBlock.height,
          status: tip.status,
          stale: staleBlock,
          canonical: canonicalBlock,
        };
      } catch (e) {
        logger.err(`Failed to index orphaned block ${block.id} at height ${block.height}. Reason: ${e instanceof Error ? e.message : e}`);
      }
    }
    this.indexingOrphanedBlocks = false;
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