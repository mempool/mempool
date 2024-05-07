import logger from '../logger';
import bitcoinClient from './bitcoin/bitcoin-client';

export interface ChainTip {
  height: number;
  hash: string;
  branchlen: number;
  status: 'invalid' | 'active' | 'valid-fork' | 'valid-headers' | 'headers-only';
};

export interface OrphanedBlock {
  height: number;
  hash: string;
  status: 'valid-fork' | 'valid-headers' | 'headers-only';
  prevhash: string;
}

class ChainTips {
  private chainTips: ChainTip[] = [];
  private orphanedBlocks: { [hash: string]: OrphanedBlock } = {};
  private blockCache: { [hash: string]: OrphanedBlock } = {};
  private orphansByHeight: { [height: number]: OrphanedBlock[] } = {};

  public async updateOrphanedBlocks(): Promise<void> {
    try {
      this.chainTips = await bitcoinClient.getChainTips();

      const start = Date.now();
      const breakAt = start + 10000;
      let newOrphans = 0;
      this.orphanedBlocks = {};

      for (const chain of this.chainTips) {
        if (chain.status === 'valid-fork' || chain.status === 'valid-headers') {
          const orphans: OrphanedBlock[] = [];
          let hash = chain.hash;
          do {
            let orphan = this.blockCache[hash];
            if (!orphan) {
              const block = await bitcoinClient.getBlock(hash);
              if (block && block.confirmations === -1) {
                newOrphans++;
                orphan = {
                  height: block.height,
                  hash: block.hash,
                  status: chain.status,
                  prevhash: block.previousblockhash,
                };
                this.blockCache[hash] = orphan;
              }
            }
            if (orphan) {
              orphans.push(orphan);
            }
            hash = orphan?.prevhash;
          } while (hash && (Date.now() < breakAt));
          for (const orphan of orphans) {
            this.orphanedBlocks[orphan.hash] = orphan;
          }
        }
        if (Date.now() >= breakAt) {
          logger.debug(`Breaking orphaned blocks updater after 10s, will continue next block`);
          break;
        }
      }

      this.orphansByHeight = {};
      const allOrphans = Object.values(this.orphanedBlocks);
      for (const orphan of allOrphans) {
        if (!this.orphansByHeight[orphan.height]) {
          this.orphansByHeight[orphan.height] = [];
        }
        this.orphansByHeight[orphan.height].push(orphan);
      }

      logger.debug(`Updated orphaned blocks cache. Fetched ${newOrphans} new orphaned blocks. Total ${allOrphans.length}`);
    } catch (e) {
      logger.err(`Cannot get fetch orphaned blocks. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  public getOrphanedBlocksAtHeight(height: number | undefined): OrphanedBlock[] {
    if (height === undefined) {
      return [];
    }

    return this.orphansByHeight[height] || [];
  }
}

export default new ChainTips();