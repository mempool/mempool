import { Injectable } from '@angular/core';
import { firstValueFrom, Subject, Subscription} from 'rxjs';
import { Transaction } from '../interfaces/electrs.interface';
import { BlockExtended } from '../interfaces/node-api.interface';
import { StateService } from './state.service';
import { ApiService } from './api.service';

const BLOCK_CACHE_SIZE = 500;
const KEEP_RECENT_BLOCKS = 50;

@Injectable({
  providedIn: 'root'
})
export class CacheService {
  loadedBlocks$ = new Subject<BlockExtended>();
  tip: number = 0;

  txCache: { [txid: string]: Transaction } = {};

  blockCache: { [height: number]: BlockExtended } = {};
  blockLoading: { [height: number]: boolean } = {};
  copiesInBlockQueue: { [height: number]: number } = {};
  blockPriorities: number[] = [];

  constructor(
    private stateService: StateService,
    private apiService: ApiService,
  ) {
    this.stateService.blocks$.subscribe(([block]) => {
      this.addBlockToCache(block);
      this.clearBlocks();
    });
    this.stateService.chainTip$.subscribe((height) => {
      this.tip = height;
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
    this.blockCache[block.height] = block;
    this.bumpBlockPriority(block.height);
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
      for (let i = 0; i < chunkSize; i++) {
        delete this.blockLoading[maxHeight - i];
      }
      if (result && result.length) {
        result.forEach(block => {
          this.addBlockToCache(block);
          this.loadedBlocks$.next(block);
        });
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
        delete this.blockCache[height];
        delete this.copiesInBlockQueue[height];
      }
    }
  }

  getCachedBlock(height) {
    return this.blockCache[height];
  }
}