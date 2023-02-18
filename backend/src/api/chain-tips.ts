import logger from "../logger";
import bitcoinClient from "./bitcoin/bitcoin-client";

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
}

class ChainTips {
  private chainTips: ChainTip[] = [];
  private orphanedBlocks: OrphanedBlock[] = [];

  public async updateOrphanedBlocks(): Promise<void> {
    this.chainTips = await bitcoinClient.getChainTips();
    this.orphanedBlocks = [];

    for (const chain of this.chainTips) {
      if (chain.status === 'valid-fork' || chain.status === 'valid-headers' || chain.status === 'headers-only') {
        let block = await bitcoinClient.getBlock(chain.hash);
        while (block && block.confirmations === -1) {
          this.orphanedBlocks.push({
            height: block.height,
            hash: block.hash,
            status: chain.status
          });
          block = await bitcoinClient.getBlock(block.previousblockhash);
        }
      }
    }

    logger.debug(`Updated orphaned blocks cache. Found ${this.orphanedBlocks.length} orphaned blocks`);
  }

  public getOrphanedBlocksAtHeight(height: number): OrphanedBlock[] {
    const orphans: OrphanedBlock[] = [];
    for (const block of this.orphanedBlocks) {
      if (block.height === height) {
        orphans.push(block);
      }
    }
    return orphans;
  }
}

export default new ChainTips();