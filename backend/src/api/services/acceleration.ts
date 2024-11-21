import { WebSocket } from 'ws';
import config from '../../config';
import logger from '../../logger';
import { BlockExtended } from '../../mempool.interfaces';
import axios from 'axios';
import mempool from '../mempool';
import websocketHandler from '../websocket-handler';

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
  private ws: WebSocket | null = null;
  private useWebsocket: boolean = config.MEMPOOL.OFFICIAL && config.MEMPOOL_SERVICES.ACCELERATIONS;
  private startedWebsocketLoop: boolean = false;
  private websocketConnected: boolean = false;
  private onDemandPollingEnabled = !config.MEMPOOL_SERVICES.ACCELERATIONS;
  private apiPath = config.MEMPOOL.OFFICIAL ? (config.MEMPOOL_SERVICES.API + '/accelerator/accelerations') : (config.EXTERNAL_DATA_SERVER.MEMPOOL_API + '/accelerations');
  private websocketPath = config.MEMPOOL_SERVICES?.API ? `${config.MEMPOOL_SERVICES.API.replace('https://', 'wss://').replace('http://', 'ws://')}/accelerator/ws` : '/';
  private _accelerations: Record<string, Acceleration> = {};
  private lastPoll = 0;
  private lastPing = Date.now();
  private lastPong = Date.now();
  private forcePoll = false;
  private myAccelerations: Record<string, { status: MyAccelerationStatus, added: number, acceleration?: Acceleration }> = {};

  public constructor() {}

  public getAccelerations(): Record<string, Acceleration> {
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

  public async $updateAccelerations(): Promise<Record<string, Acceleration> | null> {
    if (this.useWebsocket && this.websocketConnected) {
      return this._accelerations;
    }
    if (!this.onDemandPollingEnabled) {
      const accelerations = await this.$fetchAccelerations();
      if (accelerations) {
        const latestAccelerations = {};
        for (const acc of accelerations) {
          latestAccelerations[acc.txid] = acc;
        }
        this._accelerations = latestAccelerations;
        return this._accelerations;
      }
    } else {
      return this.$updateAccelerationsOnDemand();
    }
    return null;
  }

  private async $updateAccelerationsOnDemand(): Promise<Record<string, Acceleration> | null> {
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

    const latestAccelerations = {};
    for (const acc of Object.values(this.myAccelerations).map(({ acceleration }) => acceleration).filter(acc => acc) as Acceleration[]) {
      latestAccelerations[acc.txid] = acc;
    }
    this._accelerations = latestAccelerations;
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

  // get a list of accelerations that have changed between two sets of accelerations
  public getAccelerationDelta(oldAccelerationMap: Record<string, Acceleration>, newAccelerationMap: Record<string, Acceleration>): string[] {
    const changed: string[] = [];
    const mempoolCache = mempool.getMempool();

    for (const acceleration of Object.values(newAccelerationMap)) {
      // skip transactions we don't know about
      if (!mempoolCache[acceleration.txid]) {
        continue;
      }
      if (oldAccelerationMap[acceleration.txid] == null) {
        // new acceleration
        changed.push(acceleration.txid);
      } else {
        if (oldAccelerationMap[acceleration.txid].feeDelta !== acceleration.feeDelta) {
          // feeDelta changed
          changed.push(acceleration.txid);
        } else if (oldAccelerationMap[acceleration.txid].pools?.length) {
          let poolsChanged = false;
          const pools = new Set();
            oldAccelerationMap[acceleration.txid].pools.forEach(pool => {
            pools.add(pool);
          });
          acceleration.pools.forEach(pool => {
            if (!pools.has(pool)) {
              poolsChanged = true;
            } else {
              pools.delete(pool);
            }
          });
          if (pools.size > 0) {
            poolsChanged = true;
          }
          if (poolsChanged) {
            // pools changed
            changed.push(acceleration.txid);
          }
        }
      }
    }

    for (const oldTxid of Object.keys(oldAccelerationMap)) {
      if (!newAccelerationMap[oldTxid]) {
        // removed
        changed.push(oldTxid);
      }
    }

    return changed;
  }

  private handleWebsocketMessage(msg: any): void {
    if (msg?.accelerations !== null) {
      const latestAccelerations = {};
      for (const acc of msg?.accelerations || []) {
        latestAccelerations[acc.txid] = acc;
      }
      this._accelerations = latestAccelerations;
      websocketHandler.handleAccelerationsChanged(this._accelerations);
    }
  }

  public async connectWebsocket(): Promise<void> {
    if (this.startedWebsocketLoop) {
      return;
    }
    while (this.useWebsocket) {
      this.startedWebsocketLoop = true;
      if (!this.ws) {
        this.ws = new WebSocket(this.websocketPath);
        this.lastPing = 0;

        this.ws.on('open', () => {
          logger.info(`Acceleration websocket opened to ${this.websocketPath}`);
          this.websocketConnected = true;
          this.ws?.send(JSON.stringify({
            'watch-accelerations': true
          }));
        });

        this.ws.on('error', (error) => {
          let errMsg = `Acceleration websocket error on ${this.websocketPath}: ${error['code']}`;
          if (error['errors']) {
            errMsg += ' - ' + error['errors'].join(' - ');
          }
          logger.err(errMsg);
          this.ws = null;
          this.websocketConnected = false;
        });

        this.ws.on('close', () => {
          logger.info('Acceleration websocket closed');
          this.ws = null;
          this.websocketConnected = false;
        });

        this.ws.on('message', (data, isBinary) => {
          try {
            const msg = (isBinary ? data : data.toString()) as string;
            const parsedMsg = msg?.length ? JSON.parse(msg) : null;
            this.handleWebsocketMessage(parsedMsg);
          } catch (e) {
            logger.warn('Failed to parse acceleration websocket message: ' + (e instanceof Error ? e.message : e));
          }
        });

        this.ws.on('ping', () => {
          logger.debug('received ping from acceleration websocket server');
        });

        this.ws.on('pong', () => {
          logger.debug('received pong from acceleration websocket server');
          this.lastPong = Date.now();
        });
      } else if (this.websocketConnected) {
        if (this.lastPing && this.lastPing > this.lastPong && (Date.now() - this.lastPing > 10000)) {
          logger.warn('No pong received within 10 seconds, terminating connection');
          try {
            this.ws?.terminate();
          } catch (e) {
            logger.warn('failed to terminate acceleration websocket connection: ' + (e instanceof Error ? e.message : e));
          } finally {
            this.ws = null;
            this.websocketConnected = false;
            this.lastPing = 0;
          }
        } else if (!this.lastPing || (Date.now() - this.lastPing > 30000)) {
          logger.debug('sending ping to acceleration websocket server');
          if (this.ws?.readyState === WebSocket.OPEN) {
            try {
              this.ws?.ping();
              this.lastPing = Date.now();
            } catch (e) {
              logger.warn('failed to send ping to acceleration websocket server: ' + (e instanceof Error ? e.message : e));
            }
          }
        }
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

export default new AccelerationApi();