import { Injectable } from '@angular/core';
import { firstValueFrom, Subject, Subscription} from 'rxjs';
import { Transaction } from '@interfaces/electrs.interface';
import { BlockExtended } from '@interfaces/node-api.interface';
import { StateService } from '@app/services/state.service';
import { ApiService } from '@app/services/api.service';

const BLOCK_CACHE_SIZE = 500;
const KEEP_RECENT_BLOCKS = 50;

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  loadedBlocks$ = new Subject<BlockExtended>();
  tip: number = 0;

  txCache: { [txid: string]: Transaction } = {};

  network: string;
  blockHashCache: { [hash: string]: BlockExtended } = {};
  blockCache: { [height: number]: BlockExtended } = {};
  blockLoading: { [height: number]: boolean } = {};
  copiesInBlockQueue: { [height: number]: number } = {};
  blockPriorities: number[] = [];

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
  ) {
    this.stateService.blocks$.subscribe((blocks) => {
      for (const block of blocks) {
        this.addBlockToCache(block);
      }
      this.clearBlocks();
    });
    this.stateService.chainTip$.subscribe((height) => {
      this.tip = height;
    });
    this.stateService.networkChanged$.subscribe((network) => {
      this.network = network;
      this.resetBlockCache();
      this.txCache = {};
    });
  }

  setTxCache(transactions) {
    this.txCache = {};
    transactions.forEach(tx => {
      this.txCache[tx.txid] = tx;
    });
  }
 
  getTxFromCache(txid) {
    if (this.txCache && this.txCache[txid]) {
      return this.txCache[txid];
    } else {
      return null;
    }
  }

  addBlockToCache(block: BlockExtended) {
    if (!this.blockHashCache[block.id]) {
      this.blockHashCache[block.id] = block;
      this.blockCache[block.height] = block;
      this.bumpBlockPriority(block.height);
    }
  }

  async loadBlock(height) {
    if (!this.blockCache[height] && !this.blockLoading[height]) {
      const chunkSize = 10;
      const maxHeight = Math.ceil(height / chunkSize) * chunkSize;
      for (let i = 0; i < chunkSize; i++) {
        this.blockLoading[maxHeight - i] = true;
      }
      let result;
      try {
        result = await firstValueFrom(this.apiService.getBlocks$(maxHeight));
      } catch (e) {
        console.log("failed to load blocks: ", e.message);
      }
      if (result && result.length) {
        result.forEach(block => {
          if (this.blockLoading[block.height]) {
            this.addBlockToCache(block);
            this.loadedBlocks$.next(block);
          }
        });
      }
      for (let i = 0; i < chunkSize; i++) {
        delete this.blockLoading[maxHeight - i];
      }
      this.clearBlocks();
    } else {
      this.bumpBlockPriority(height);
    }
  }

  // increase the priority of a block, to delay removal
  bumpBlockPriority(height) {
    this.blockPriorities.push(height);
    this.copiesInBlockQueue[height] = (this.copiesInBlockQueue[height] || 0) + 1;
  }

  // remove lowest priority blocks from the cache
  clearBlocks() {
    while (Object.keys(this.blockCache).length > (BLOCK_CACHE_SIZE + KEEP_RECENT_BLOCKS) && this.blockPriorities.length > KEEP_RECENT_BLOCKS) {
      const height = this.blockPriorities.shift();
      if (this.copiesInBlockQueue[height] > 1) {
        this.copiesInBlockQueue[height]--;
      } else if ((this.tip - height) < KEEP_RECENT_BLOCKS) {
        this.bumpBlockPriority(height);
      } else {
        const block = this.blockCache[height];
        delete this.blockCache[height];
        delete this.blockHashCache[block.id];
        delete this.copiesInBlockQueue[height];
      }
    }
  }

  // remove all blocks from the cache
  resetBlockCache() {
    this.blockHashCache = {};
    this.blockCache = {};
    this.apiService.blockAuditLoaded = {};
    this.blockLoading = {};
    this.copiesInBlockQueue = {};
    this.blockPriorities = [];
  }

  getCachedBlock(height) {
    return this.blockCache[height];
  }
}
