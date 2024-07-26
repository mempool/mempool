import config from '../../config';
import logger from '../../logger';
import { BlockExtended } from '../../mempool.interfaces';
import axios from 'axios';

type MyAccelerationStatus = 'requested' | 'accelerating' | 'done';

export interface Acceleration {
  txid: string,
  added: number,
  effectiveVsize: number,
  effectiveFee: number,
  feeDelta: number,
  pools: number[],
  positions?: {
    [pool: number]: {
      block: number,
      vbytes: number,
    },
  },
};

export interface AccelerationHistory {
  txid: string,
  status: string,
  feePaid: number,
  added: number,
  lastUpdated: number,
  baseFee: number,
  vsizeFee: number,
  effectiveFee: number,
  effectiveVsize: number,
  feeDelta: number,
  blockHash: string,
  blockHeight: number,
  pools: number[];
};

class AccelerationApi {
  private onDemandPollingEnabled = !config.MEMPOOL_SERVICES.ACCELERATIONS;
  private apiPath = config.MEMPOOL.OFFICIAL ? (config.MEMPOOL_SERVICES.API + '/accelerator/accelerations') : (config.EXTERNAL_DATA_SERVER.MEMPOOL_API + '/accelerations');
  private _accelerations: Acceleration[] | null = null;
  private lastPoll = 0;
  private forcePoll = false;
  private myAccelerations: Record<string, { status: MyAccelerationStatus, added: number, acceleration?: Acceleration }> = {};

  public get accelerations(): Acceleration[] | null {
    return this._accelerations;
  }

  public countMyAccelerationsWithStatus(filter: MyAccelerationStatus): number {
    return Object.values(this.myAccelerations).reduce((count, {status}) => { return count + (status === filter ? 1 : 0); }, 0);
  }

  public accelerationRequested(txid: string): void {
    if (this.onDemandPollingEnabled) {
      this.myAccelerations[txid] = { status: 'requested', added: Date.now() };
    }
  }

  public accelerationConfirmed(): void {
    this.forcePoll = true;
  }

  private async $fetchAccelerations(): Promise<Acceleration[] | null> {
    try {
      const response = await axios.get(this.apiPath, { responseType: 'json', timeout: 10000 });
      return response?.data || [];
    } catch (e) {
      logger.warn('Failed to fetch current accelerations from the mempool services backend: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  public async $updateAccelerations(): Promise<Acceleration[] | null> {
    if (!this.onDemandPollingEnabled) {
      const accelerations = await this.$fetchAccelerations();
      if (accelerations) {
        this._accelerations = accelerations;
        return this._accelerations;
      }
    } else {
      return this.$updateAccelerationsOnDemand();
    }
    return null;
  }

  private async $updateAccelerationsOnDemand(): Promise<Acceleration[] | null> {
    const shouldUpdate = this.forcePoll
      || this.countMyAccelerationsWithStatus('requested') > 0
      || (this.countMyAccelerationsWithStatus('accelerating') > 0 && this.lastPoll < (Date.now() - (10 * 60 * 1000)));

    // update accelerations if necessary
    if (shouldUpdate) {
      const accelerations = await this.$fetchAccelerations();
      this.lastPoll = Date.now();
      this.forcePoll = false;
      if (accelerations) {
        const latestAccelerations: Record<string, Acceleration> = {};
        // set relevant accelerations to 'accelerating'
        for (const acc of accelerations) {
          if (this.myAccelerations[acc.txid]) {
            latestAccelerations[acc.txid] = acc;
            this.myAccelerations[acc.txid] = { status: 'accelerating', added: Date.now(), acceleration: acc };
          }
        }
        // txs that are no longer accelerating are either confirmed or canceled, so mark for expiry
        for (const [txid, { status, acceleration }] of Object.entries(this.myAccelerations)) {
          if (status === 'accelerating' && !latestAccelerations[txid]) {
            this.myAccelerations[txid] = { status: 'done', added: Date.now(), acceleration };
          }
        }
      }
    }

    // clear expired accelerations (confirmed / failed / not accepted) after 10 minutes
    for (const [txid, { status, added }] of Object.entries(this.myAccelerations)) {
      if (['requested', 'done'].includes(status) && added < (Date.now() - (1000 * 60 * 10))) {
        delete this.myAccelerations[txid];
      }
    }

    this._accelerations = Object.values(this.myAccelerations).map(({ acceleration }) => acceleration).filter(acc => acc) as Acceleration[];
    return this._accelerations;
  }

  public async $fetchAccelerationHistory(page?: number, status?: string): Promise<AccelerationHistory[] | null> {
    if (config.MEMPOOL_SERVICES.ACCELERATIONS) {
      try {
        const response = await axios.get(`${config.MEMPOOL_SERVICES.API}/accelerator/accelerations/history`, {
          responseType: 'json',
          timeout: 10000,
          params: {
            page,
            status,
          }
        });
        return response.data as AccelerationHistory[];
      } catch (e) {
        logger.warn('Failed to fetch acceleration history from the mempool services backend: ' + (e instanceof Error ? e.message : e));
        return null;
      }
    } else {
      return [];
    }
  }

  public isAcceleratedBlock(block: BlockExtended, accelerations: Acceleration[]): boolean {
    let anyAccelerated = false;
    for (let i = 0; i < accelerations.length && !anyAccelerated; i++) {
      anyAccelerated = anyAccelerated || accelerations[i].pools?.includes(block.extras.pool.id);
    }
    return anyAccelerated;
  }
}

export default new AccelerationApi();