import config from '../../config';
import { IBDProgress } from '../../mempool.interfaces';
import indexer from '../../indexer';
import { Common } from '../common';
import loadingIndicators from '../loading-indicators';
import mempool from '../mempool';
import bitcoinApi from './bitcoin-api-factory';
import bitcoinClient from './bitcoin-client';

const CACHE_MS = 5000;
const ELECTRS_TIMEOUT_MS = 3000;
const ELECTRS_LAG_TOLERANCE = 10;

class ProgressEstimate {
  private baseline: { time: number; progress: number } | null = null;

  constructor(private windowMs: number) {}

  update(progress: number | null): number | null {
    const now = Date.now();
    if (progress === null || !Number.isFinite(progress) || progress >= 1) {
      this.baseline = null;
      return null;
    }
    if (!this.baseline || progress < this.baseline.progress || now <= this.baseline.time) {
      this.baseline = { time: now, progress };
      return null;
    }
    const elapsed = (now - this.baseline.time) / 1000;
    const delta = progress - this.baseline.progress;
    const eta = delta > 0 ? Math.round((1 - progress) * elapsed / delta) : null;
    if (now - this.baseline.time >= this.windowMs) {
      this.baseline = { time: now, progress };
    }
    return eta !== null && Number.isFinite(eta) ? eta : null;
  }
}

export class SyncProgress {
  // Each worker samples independently. Share requests and briefly cache both
  // successes and failures so browser polling cannot fan out into RPC calls.
  private pending: Promise<IBDProgress> | null = null;
  private expires = 0;
  private electrsRequest: Promise<number> | null = null;
  private ibdEstimate = new ProgressEstimate(30 * 60 * 1000);
  private blockEstimate = new ProgressEstimate(2 * 60 * 1000);

  public $get(): Promise<IBDProgress> {
    if (!this.pending || Date.now() >= this.expires) {
      this.expires = Infinity;
      this.pending = this.$sample().finally(() => {
        this.expires = Date.now() + CACHE_MS;
      });
    }
    return this.pending;
  }

  /** @asyncUnsafe */
  private async $getElectrsTip(): Promise<number> {
    // Electrum has no per-request deadline. Keep a single outstanding request
    // even after timing out, until the client receives a reply or disconnects.
    if (!this.electrsRequest) {
      this.electrsRequest = bitcoinApi.$getElectrsHeightTip().finally(() => {
        this.electrsRequest = null;
      });
    }
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        this.electrsRequest,
        new Promise<never>((resolve, reject) => {
          timer = setTimeout(() => reject(new Error('Index tip request timed out')), ELECTRS_TIMEOUT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** @asyncUnsafe */
  private async $sample(): Promise<IBDProgress> {
    const info = await bitcoinClient.getBlockchainInfo();
    // Idle development chains can retain Core's IBD flag despite having all
    // known blocks. A fresh node with no headers must still report IBD.
    const ibd = info.initialblockdownload && (info.blocks !== info.headers || info.headers === 0);
    const indicators = loadingIndicators.getLoadingIndicators();
    const inSync = mempool.isInSync();
    const indexed = !Common.indexingEnabled() || indexer.isInitialIndexingComplete();
    const blockProgress = !indexed ? indicators['block-indexing'] ?? null : null;
    const result: IBDProgress = {
      ibd,
      bitcoind: {
        blocks: info.blocks,
        headers: info.headers,
        verificationprogress: info.verificationprogress,
        estimatedTimeRemaining: this.ibdEstimate.update(ibd ? info.verificationprogress : null),
      },
      mempool: {
        inSync,
        indexed,
        progress: inSync ? blockProgress : indicators['mempool'] ?? null,
        estimatedTimeRemaining: this.blockEstimate.update(inSync && blockProgress !== null ? blockProgress / 100 : null),
      },
    };

    if (config.MEMPOOL.BACKEND === 'esplora' || config.MEMPOOL.BACKEND === 'electrum') {
      result.electrs = { reachable: false, indexed: false };
      try {
        const tip = await this.$getElectrsTip();
        if (Number.isSafeInteger(tip) && tip >= 0) {
          result.electrs = {
            reachable: true,
            indexed: !ibd && tip >= info.blocks - ELECTRS_LAG_TOLERANCE,
          };
        }
      } catch (e) {
        // Initial indexing and outages both prevent the server from answering.
      }
    }
    return result;
  }
}

export default new SyncProgress();
